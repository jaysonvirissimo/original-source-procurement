import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, posix } from "node:path";
import type { Connect, Plugin } from "vite";
import {
  PSYQ_WASM_RELEASE,
  type PsyqWasmRelease,
} from "./psyq-wasm-release.ts";

/** A file shipped under the vendor directory, by name inside that directory. */
export interface VendorFile {
  readonly name: string;
  readonly source: string;
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const RELATIVE_IMPORT = /\b(?:from|import)\s*["'](\.\/[^"']+)["']/g;

/**
 * Lists the worker entry and every module it reaches through relative
 * static imports, as file names inside `distDirectory`.
 */
export async function workerModules(
  distDirectory: string,
  entry = "worker.js",
): Promise<string[]> {
  const found = new Set<string>();
  const pending = [entry];

  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (found.has(name)) {
      continue;
    }
    found.add(name);
    const code = await readFile(join(distDirectory, name), "utf8");
    for (const [, specifier = ""] of code.matchAll(RELATIVE_IMPORT)) {
      pending.push(posix.join(posix.dirname(name), specifier));
    }
  }

  return [...found].sort();
}

/**
 * The browser runtime, compiler artifacts, license texts, and provenance
 * records the site ships from the installed psyq-wasm package.
 */
export async function vendorFiles(packageRoot: string): Promise<VendorFile[]> {
  const dist = join(packageRoot, "dist");
  const fromDist = [
    ...(await workerModules(dist)),
    "cc1psx.wasm",
    "cccp.wasm",
    "SHA256SUMS",
    "build-info.json",
  ];
  const fromRoot = [
    "LICENSE",
    "LICENSES/GPL-2.0-only.txt",
    "LICENSES/MIT.txt",
    "PROVENANCE.md",
  ];
  return [
    ...fromDist.map((name) => ({ name, source: join(dist, name) })),
    ...fromRoot.map((name) => ({ name, source: join(packageRoot, name) })),
  ];
}

export function parseSha256Sums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      sums.set(match[2], match[1]);
    }
  }
  return sums;
}

function field(value: unknown, ...keys: readonly string[]): unknown {
  let current = value;
  for (const key of keys) {
    current =
      typeof current === "object" && current !== null
        ? (current as Record<string, unknown>)[key]
        : undefined;
  }
  return current;
}

/**
 * Fails unless the installed package is the pinned release: its version, the
 * artifact bytes, `SHA256SUMS`, and `build-info.json` must all agree with the
 * pins.
 */
export async function verifyInstalledRelease(
  packageRoot: string,
  release: PsyqWasmRelease,
): Promise<void> {
  const problems: string[] = [];
  const readJson = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(join(packageRoot, path), "utf8"));

  const version = field(await readJson("package.json"), "version");
  if (version !== release.version) {
    problems.push(
      `the installed version is ${JSON.stringify(version)}, not ${release.version}`,
    );
  }

  const sums = parseSha256Sums(
    await readFile(join(packageRoot, "dist/SHA256SUMS"), "utf8"),
  );
  const buildInfo = await readJson("dist/build-info.json");
  const recorded: Readonly<Record<string, unknown>> = {
    "cc1psx.wasm": field(buildInfo, "wasmSha256"),
    "cc1psx.js": field(buildInfo, "glueSha256"),
    "cccp.wasm": field(buildInfo, "preprocessor", "wasmSha256"),
    "cccp.js": field(buildInfo, "preprocessor", "glueSha256"),
  };

  for (const [name, expected] of Object.entries(release.artifacts)) {
    const actual = sha256Hex(await readFile(join(packageRoot, "dist", name)));
    if (actual !== expected) {
      problems.push(`${name} has SHA-256 ${actual}, not ${expected}`);
    }
    if (sums.get(name) !== expected) {
      problems.push(`SHA256SUMS does not record ${expected} for ${name}`);
    }
    if (recorded[name] !== expected) {
      problems.push(`build-info.json does not record ${expected} for ${name}`);
    }
  }

  const { compilerSource } = release;
  for (const [key, expected] of [
    ["homebrewPsyqRepo", compilerSource.repository],
    ["homebrewPsyqSha", compilerSource.commit],
    ["gccSubdir", compilerSource.subdirectory],
  ] as const) {
    if (field(buildInfo, key) !== expected) {
      problems.push(`build-info.json does not record ${key} ${expected}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `The installed psyq-wasm package does not match the pinned release:\n- ${problems.join("\n- ")}`,
    );
  }
}

const DEFAULT_ASSET_URL =
  /new URL\((["'])\.\/(worker\.js|cc1psx\.wasm|cccp\.wasm)\1, import\.meta\.url\)/g;
const EXPECTED_DEFAULT_ASSET_URLS = 4;

export function isPlatformBrowserModule(id: string): boolean {
  const [path = ""] = id.split("?");
  return path
    .replaceAll("\\", "/")
    .endsWith("/psyq-wasm/dist/platform-browser.js");
}

/**
 * Points psyq-wasm's default worker and compiler URLs at the vendor
 * directory. Without this, the bundler follows those URLs and emits a
 * minified copy of the GPL-2.0-only glue code inside a worker chunk.
 */
export function rewriteDefaultAssetUrls(
  code: string,
  vendorDirectory: string,
): string {
  let count = 0;
  const rewritten = code.replace(
    DEFAULT_ASSET_URL,
    (_match, _quote, file: string) => {
      count += 1;
      return `new URL(${JSON.stringify(`${vendorDirectory}/${file}`)}, document.baseURI)`;
    },
  );

  if (count !== EXPECTED_DEFAULT_ASSET_URLS) {
    throw new Error(
      `Expected ${String(EXPECTED_DEFAULT_ASSET_URLS)} default asset URLs in psyq-wasm's browser platform module, found ${String(count)}. Check how the installed psyq-wasm version creates its worker before shipping it.`,
    );
  }
  return rewritten;
}

/**
 * Returns the release's corresponding-source archive, downloading it into
 * `cacheDirectory` the first time. The bytes always match the pinned hash.
 */
export async function sourceArchive(
  release: PsyqWasmRelease,
  cacheDirectory: string,
  fetchArchive: (url: string) => Promise<Response> = fetch,
): Promise<Uint8Array> {
  const { fileName, url, sha256 } = release.sourceArchive;
  const cached = join(cacheDirectory, fileName);

  try {
    const bytes = await readFile(cached);
    if (sha256Hex(bytes) === sha256) {
      return bytes;
    }
  } catch {
    // Not cached yet.
  }

  let response: Response;
  try {
    response = await fetchArchive(url);
  } catch (error) {
    throw new Error(
      `Could not download the psyq-wasm corresponding-source archive from ${url}. The build needs network access once to fetch it.`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Error(
      `Downloading ${url} failed with HTTP ${String(response.status)}.`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = sha256Hex(bytes);
  if (actual !== sha256) {
    throw new Error(
      `${fileName} from ${url} has SHA-256 ${actual}, not the pinned ${sha256}.`,
    );
  }

  await mkdir(cacheDirectory, { recursive: true });
  const partial = `${cached}.partial`;
  await writeFile(partial, bytes);
  await rename(partial, cached);
  return bytes;
}

/**
 * The notices section that identifies each compiler artifact, its
 * provenance records, and its corresponding source.
 */
export function renderCompilerProvenance(release: PsyqWasmRelease): string {
  const rule = "=".repeat(78);
  const directory = release.vendorDirectory;
  const { compilerSource, sourceArchive: archive } = release;

  return [
    rule,
    `Compiler artifacts from psyq-wasm ${release.version}`,
    rule,
    "",
    `These files are distributed unmodified in ${directory}/. They are`,
    "licensed GPL-2.0-only; the full license text is in the psyq-wasm entry",
    `above and in ${directory}/LICENSES/.`,
    "",
    ...Object.entries(release.artifacts).map(
      ([name, hash]) => `SHA-256 ${hash}  ${name}`,
    ),
    "",
    `Provenance: ${directory}/PROVENANCE.md, SHA256SUMS, and build-info.json.`,
    `Built from ${compilerSource.repository}`,
    `at commit ${compilerSource.commit}, subdirectory ${compilerSource.subdirectory}.`,
    "",
    `Corresponding source: ${directory}/${archive.fileName}`,
    `SHA-256 ${archive.sha256}`,
    `Also published at ${archive.url}`,
    "",
  ].join("\n");
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

/** Serves the vendor files during development. */
export function vendorMiddleware(
  release: PsyqWasmRelease,
  files: () => Promise<readonly VendorFile[]>,
): Connect.NextHandleFunction {
  const prefix = `/${release.vendorDirectory}/`;

  return (request, response, next) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (!pathname.startsWith(prefix)) {
      next();
      return;
    }

    const name = pathname.slice(prefix.length);
    files()
      .then(async (list) => {
        const file = list.find((entry) => entry.name === name);
        if (file === undefined) {
          next();
          return;
        }
        const extension = posix.extname(name);
        response.setHeader(
          "content-type",
          CONTENT_TYPES[extension] ?? "text/plain; charset=utf-8",
        );
        response.end(await readFile(file.source));
      })
      .catch(next);
  };
}

export interface PsyqWasmDistributionOptions {
  readonly release?: PsyqWasmRelease;
  readonly packageRoot?: string;
  readonly cacheDirectory?: string;
  readonly fetchArchive?: (url: string) => Promise<Response>;
}

function installedPackageRoot(): string {
  const require = createRequire(import.meta.url);
  return dirname(require.resolve("psyq-wasm/package.json"));
}

/**
 * Ships psyq-wasm's browser runtime byte-for-byte under the vendor directory,
 * with its license texts, provenance records, and corresponding-source
 * archive, and keeps the bundler from emitting transformed copies of the
 * compiler artifacts.
 */
export function psyqWasmDistribution(
  options: PsyqWasmDistributionOptions = {},
): Plugin {
  const release = options.release ?? PSYQ_WASM_RELEASE;
  let cacheDirectory =
    options.cacheDirectory ?? join(process.cwd(), "node_modules/.cache/osp");
  let files: Promise<VendorFile[]> | undefined;

  const vendorFileList = (): Promise<VendorFile[]> => {
    if (files === undefined) {
      const packageRoot = options.packageRoot ?? installedPackageRoot();
      files = verifyInstalledRelease(packageRoot, release).then(() =>
        vendorFiles(packageRoot),
      );
    }
    return files;
  };

  return {
    name: "osp:psyq-wasm-distribution",
    enforce: "pre",
    config() {
      // Pre-bundled dependencies skip plugin transforms.
      return { optimizeDeps: { exclude: ["psyq-wasm"] } };
    },
    configResolved(config) {
      if (options.cacheDirectory === undefined) {
        cacheDirectory = join(config.root, "node_modules/.cache/osp");
      }
    },
    async buildStart() {
      await vendorFileList();
    },
    transform(code, id) {
      return isPlatformBrowserModule(id)
        ? { code: rewriteDefaultAssetUrls(code, release.vendorDirectory) }
        : undefined;
    },
    configureServer(server) {
      server.middlewares.use(vendorMiddleware(release, vendorFileList));
    },
    async generateBundle() {
      for (const file of await vendorFileList()) {
        this.emitFile({
          type: "asset",
          fileName: `${release.vendorDirectory}/${file.name}`,
          originalFileName: file.source,
          source: await readFile(file.source),
        });
      }
      this.emitFile({
        type: "asset",
        fileName: `${release.vendorDirectory}/${release.sourceArchive.fileName}`,
        source: await sourceArchive(
          release,
          cacheDirectory,
          options.fetchArchive,
        ),
      });
    },
  };
}
