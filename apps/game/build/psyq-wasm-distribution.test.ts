import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPlatformBrowserModule,
  parseSha256Sums,
  psyqWasmDistribution,
  renderCompilerProvenance,
  rewriteDefaultAssetUrls,
  sha256Hex,
  sourceArchive,
  vendorFiles,
  vendorMiddleware,
  verifyInstalledRelease,
  workerModules,
  type VendorFile,
} from "./psyq-wasm-distribution";
import { PSYQ_WASM_RELEASE, type PsyqWasmRelease } from "./psyq-wasm-release";

const require = createRequire(import.meta.url);
const installedRoot = dirname(require.resolve("psyq-wasm/package.json"));

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "osp-psyq-wasm-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function writeFiles(
  root: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
}

const ARCHIVE = "OSP test archive bytes";

/**
 * Writes a package shaped like psyq-wasm, with OSP-authored placeholder
 * contents, and returns pins that describe it.
 */
async function fakePackage(root: string): Promise<PsyqWasmRelease> {
  const artifacts: Readonly<Record<string, string>> = {
    "cc1psx.wasm": "placeholder compiler module",
    "cc1psx.js": 'export const BUILD_ID = "sha256:1111111111111111";\n',
    "cccp.wasm": "placeholder preprocessor module",
    "cccp.js": 'export const BUILD_ID = "sha256:2222222222222222";\n',
  };
  const hashes = Object.fromEntries(
    Object.entries(artifacts).map(([name, contents]) => [
      name,
      sha256Hex(contents),
    ]),
  );

  await writeFiles(root, {
    "package.json": JSON.stringify({ name: "psyq-wasm", version: "1.0.0" }),
    LICENSE: "Placeholder license\n",
    "LICENSES/GPL-2.0-only.txt": "Placeholder GPL\n",
    "LICENSES/MIT.txt": "Placeholder MIT\n",
    "PROVENANCE.md": "# Placeholder provenance\n",
    "dist/worker.js":
      "import createCc1 from './cc1psx.js';\nimport createCccp from './cccp.js';\nimport { run } from \"./runtime.js\";\n",
    "dist/runtime.js": "import './worker.js';\nexport const run = 1;\n",
    ...Object.fromEntries(
      Object.entries(artifacts).map(([name, contents]) => [
        `dist/${name}`,
        contents,
      ]),
    ),
    "dist/SHA256SUMS": Object.entries(hashes)
      .map(([name, hash]) => `${hash}  ${name}\n`)
      .join(""),
    "dist/build-info.json": JSON.stringify({
      wasmSha256: hashes["cc1psx.wasm"],
      glueSha256: hashes["cc1psx.js"],
      homebrewPsyqRepo: "https://example.test/compiler",
      homebrewPsyqSha: "c".repeat(40),
      gccSubdir: "gcc",
      preprocessor: {
        wasmSha256: hashes["cccp.wasm"],
        glueSha256: hashes["cccp.js"],
      },
    }),
  });

  return {
    version: "1.0.0",
    vendorDirectory: "vendor/tool/1.0.0",
    artifacts: hashes,
    buildIds: ["sha256:1111111111111111", "sha256:2222222222222222"],
    compilerSource: {
      repository: "https://example.test/compiler",
      commit: "c".repeat(40),
      subdirectory: "gcc",
    },
    sourceArchive: {
      fileName: "source.tar.gz",
      url: "https://example.test/source.tar.gz",
      sha256: sha256Hex(ARCHIVE),
    },
  };
}

function hook(plugin: Plugin, name: keyof Plugin) {
  const value: unknown = plugin[name];
  if (typeof value !== "function") {
    throw new Error(`${name} must be a function hook.`);
  }
  return value as (this: unknown, ...args: unknown[]) => unknown;
}

describe("sha256Hex", () => {
  it("hashes text and bytes", () => {
    const expected =
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(sha256Hex("abc")).toBe(expected);
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(expected);
  });
});

describe("workerModules", () => {
  it("follows relative imports from the worker entry, including cycles", async () => {
    await fakePackage(workDir);

    await expect(workerModules(join(workDir, "dist"))).resolves.toEqual([
      "cc1psx.js",
      "cccp.js",
      "runtime.js",
      "worker.js",
    ]);
  });

  it("finds the complete browser worker of the installed psyq-wasm", async () => {
    await expect(workerModules(join(installedRoot, "dist"))).resolves.toEqual([
      "argv.js",
      "cc1psx.js",
      "cccp.js",
      "errors.js",
      "eucjp-table.js",
      "eucjp.js",
      "options.js",
      "protocol.js",
      "worker-port.js",
      "worker-runtime.js",
      "worker.js",
    ]);
  });
});

describe("vendorFiles", () => {
  it("lists the worker, artifacts, license texts, and provenance records", async () => {
    await fakePackage(workDir);

    const files = await vendorFiles(workDir);

    expect(files.map((file) => file.name)).toEqual([
      "cc1psx.js",
      "cccp.js",
      "runtime.js",
      "worker.js",
      "cc1psx.wasm",
      "cccp.wasm",
      "SHA256SUMS",
      "build-info.json",
      "LICENSE",
      "LICENSES/GPL-2.0-only.txt",
      "LICENSES/MIT.txt",
      "PROVENANCE.md",
    ]);
    expect(files).toContainEqual({
      name: "PROVENANCE.md",
      source: join(workDir, "PROVENANCE.md"),
    });
    expect(files).toContainEqual({
      name: "cc1psx.wasm",
      source: join(workDir, "dist/cc1psx.wasm"),
    });
  });
});

describe("parseSha256Sums", () => {
  it("reads text and binary entries and skips other lines", () => {
    const a = "a".repeat(64);
    const b = "b".repeat(64);

    expect(
      parseSha256Sums(`${a}  cc1psx.wasm\r\n${b} *cccp.js\n\nnot a sum\n`),
    ).toEqual(
      new Map([
        ["cc1psx.wasm", a],
        ["cccp.js", b],
      ]),
    );
  });
});

describe("verifyInstalledRelease", () => {
  it("accepts the installed psyq-wasm against the pinned release", async () => {
    await expect(
      verifyInstalledRelease(installedRoot, PSYQ_WASM_RELEASE),
    ).resolves.toBeUndefined();
  });

  it("accepts a package that matches its pins", async () => {
    const release = await fakePackage(workDir);

    await expect(
      verifyInstalledRelease(workDir, release),
    ).resolves.toBeUndefined();
  });

  it("lists every disagreement with the pins", async () => {
    const release = await fakePackage(workDir);
    await writeFiles(workDir, {
      "package.json": JSON.stringify({ version: "1.0.1" }),
      "dist/cccp.js": "changed\n",
      "dist/SHA256SUMS": "",
      "dist/build-info.json": "[]",
    });

    const failure = verifyInstalledRelease(workDir, release);

    await expect(failure).rejects.toThrow(
      "The installed psyq-wasm package does not match the pinned release:",
    );
    const message = await failure.catch((error: unknown) => String(error));
    expect(message).toContain('the installed version is "1.0.1", not 1.0.0');
    expect(message).toContain(`cccp.js has SHA-256 ${sha256Hex("changed\n")}`);
    expect(message).toContain("SHA256SUMS does not record");
    expect(message).toContain("build-info.json does not record");
    expect(message).toContain("homebrewPsyqSha");
  });
});

describe("isPlatformBrowserModule", () => {
  it.each([
    ["/repo/node_modules/psyq-wasm/dist/platform-browser.js", true],
    ["/repo/node_modules/psyq-wasm/dist/platform-browser.js?v=1", true],
    ["C:\\repo\\node_modules\\psyq-wasm\\dist\\platform-browser.js", true],
    ["/repo/node_modules/psyq-wasm/dist/index.js", false],
    ["/repo/src/platform-browser.js", false],
  ])("classifies %s", (id, expected) => {
    expect(isPlatformBrowserModule(id)).toBe(expected);
  });
});

describe("rewriteDefaultAssetUrls", () => {
  it("points the installed platform module's worker and compiler URLs at the vendor directory", async () => {
    const code = await readFile(
      join(installedRoot, "dist/platform-browser.js"),
      "utf8",
    );

    const rewritten = rewriteDefaultAssetUrls(code, "vendor/psyq-wasm/1.0.0");

    expect(rewritten).not.toMatch(
      /new URL\(["']\.\/(?:worker\.js|cc1psx\.wasm|cccp\.wasm)["'], import\.meta\.url\)/,
    );
    expect(rewritten).toContain(
      'new Worker(new URL("vendor/psyq-wasm/1.0.0/worker.js", document.baseURI)',
    );
    expect(rewritten).toContain(
      'new URL("vendor/psyq-wasm/1.0.0/cccp.wasm", document.baseURI)',
    );
  });

  it("fails when the module no longer has the expected URLs", () => {
    expect(() =>
      rewriteDefaultAssetUrls(
        "new URL('./worker.js', import.meta.url);",
        "vendor/x",
      ),
    ).toThrow(
      "Expected 4 default asset URLs in psyq-wasm's browser platform module, found 1.",
    );
  });
});

describe("sourceArchive", () => {
  it("downloads, verifies, and caches the archive", async () => {
    const release = await fakePackage(join(workDir, "package"));
    const cache = join(workDir, "cache");
    const fetchArchive = vi.fn(() => Promise.resolve(new Response(ARCHIVE)));

    const first = await sourceArchive(release, cache, fetchArchive);
    const second = await sourceArchive(release, cache, fetchArchive);

    expect(new TextDecoder().decode(first)).toBe(ARCHIVE);
    expect(new TextDecoder().decode(second)).toBe(ARCHIVE);
    expect(fetchArchive).toHaveBeenCalledTimes(1);
    expect(fetchArchive).toHaveBeenCalledWith(
      "https://example.test/source.tar.gz",
    );
  });

  it("downloads again when the cached copy does not verify", async () => {
    const release = await fakePackage(join(workDir, "package"));
    const cache = join(workDir, "cache");
    await writeFiles(cache, { "source.tar.gz": "corrupted" });
    const fetchArchive = vi.fn(() => Promise.resolve(new Response(ARCHIVE)));

    await sourceArchive(release, cache, fetchArchive);

    expect(fetchArchive).toHaveBeenCalledTimes(1);
    expect(await readFile(join(cache, "source.tar.gz"), "utf8")).toBe(ARCHIVE);
  });

  it("fails when the download fails", async () => {
    const release = await fakePackage(join(workDir, "package"));

    await expect(
      sourceArchive(release, workDir, () =>
        Promise.reject(new TypeError("fetch failed")),
      ),
    ).rejects.toThrow(
      "Could not download the psyq-wasm corresponding-source archive from https://example.test/source.tar.gz.",
    );
  });

  it("fails on an HTTP error", async () => {
    const release = await fakePackage(join(workDir, "package"));

    await expect(
      sourceArchive(release, workDir, () =>
        Promise.resolve(new Response(null, { status: 404 })),
      ),
    ).rejects.toThrow(
      "Downloading https://example.test/source.tar.gz failed with HTTP 404.",
    );
  });

  it("fails and caches nothing when the archive does not match its hash", async () => {
    const release = await fakePackage(join(workDir, "package"));
    const cache = join(workDir, "cache");

    await expect(
      sourceArchive(release, cache, () =>
        Promise.resolve(new Response("something else")),
      ),
    ).rejects.toThrow("source.tar.gz from https://example.test/source.tar.gz");
    await expect(readFile(join(cache, "source.tar.gz"))).rejects.toThrow();
  });
});

describe("renderCompilerProvenance", () => {
  it("names each artifact hash, the provenance records, and the corresponding source", () => {
    const text = renderCompilerProvenance(PSYQ_WASM_RELEASE);

    for (const [name, hash] of Object.entries(PSYQ_WASM_RELEASE.artifacts)) {
      expect(text).toContain(`SHA-256 ${hash}  ${name}`);
    }
    expect(text).toContain("vendor/psyq-wasm/1.0.0/PROVENANCE.md");
    expect(text).toContain(PSYQ_WASM_RELEASE.compilerSource.commit);
    expect(text).toContain(
      `vendor/psyq-wasm/1.0.0/${PSYQ_WASM_RELEASE.sourceArchive.fileName}`,
    );
    expect(text).toContain(PSYQ_WASM_RELEASE.sourceArchive.url);
    // A build ID in the notices would look like a transformed glue copy.
    for (const buildId of PSYQ_WASM_RELEASE.buildIds) {
      expect(text).not.toContain(buildId);
    }
  });
});

describe("vendorMiddleware", () => {
  async function setUp() {
    const release = await fakePackage(workDir);
    const files: VendorFile[] = [
      { name: "cc1psx.wasm", source: join(workDir, "dist/cc1psx.wasm") },
      { name: "LICENSE", source: join(workDir, "LICENSE") },
      { name: "gone.js", source: join(workDir, "dist/gone.js") },
    ];
    const middleware = vendorMiddleware(release, () => Promise.resolve(files));

    return (url: string | undefined) => {
      const next = vi.fn();
      const response = { setHeader: vi.fn(), end: vi.fn() };
      middleware({ url } as never, response as never, next);
      return { next, response };
    };
  }

  it("passes other requests on", async () => {
    const request = await setUp();

    expect(request("/index.html").next).toHaveBeenCalledWith();
    expect(request(undefined).next).toHaveBeenCalledWith();
  });

  it("serves a vendor file with its content type", async () => {
    const request = await setUp();

    const { response } = request("/vendor/tool/1.0.0/cc1psx.wasm");

    await vi.waitFor(() => {
      expect(response.end).toHaveBeenCalledTimes(1);
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      "content-type",
      "application/wasm",
    );
  });

  it("serves an extensionless file as text", async () => {
    const request = await setUp();

    const { response } = request("/vendor/tool/1.0.0/LICENSE");

    await vi.waitFor(() => {
      expect(response.setHeader).toHaveBeenCalledWith(
        "content-type",
        "text/plain; charset=utf-8",
      );
    });
  });

  it("passes on an unknown vendor path, and reports a read failure", async () => {
    const request = await setUp();

    const unknown = request("/vendor/tool/1.0.0/other.js");
    const gone = request("/vendor/tool/1.0.0/gone.js");

    await vi.waitFor(() => {
      expect(unknown.next).toHaveBeenCalledWith();
      expect(gone.next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

describe("psyqWasmDistribution", () => {
  it("keeps psyq-wasm out of dependency pre-bundling and rewrites only its platform module", async () => {
    const release = await fakePackage(workDir);
    const plugin = psyqWasmDistribution({ release, packageRoot: workDir });
    const code =
      "new URL('./worker.js', import.meta.url); new URL('./worker.js', import.meta.url); new URL('./cc1psx.wasm', import.meta.url); new URL('./cccp.wasm', import.meta.url);";

    expect(plugin.enforce).toBe("pre");
    expect(hook(plugin, "config").call({})).toEqual({
      optimizeDeps: { exclude: ["psyq-wasm"] },
    });
    expect(
      hook(plugin, "transform").call(
        {},
        code,
        "/repo/node_modules/psyq-wasm/dist/platform-browser.js",
      ),
    ).toEqual({ code: rewriteDefaultAssetUrls(code, release.vendorDirectory) });
    expect(
      hook(plugin, "transform").call({}, code, "/repo/src/main.tsx"),
    ).toBeUndefined();
  });

  it("verifies the installed package before building", async () => {
    await expect(
      hook(psyqWasmDistribution(), "buildStart").call({}),
    ).resolves.toBeUndefined();

    const release = await fakePackage(workDir);
    await writeFiles(workDir, { "dist/cc1psx.wasm": "changed" });

    await expect(
      hook(
        psyqWasmDistribution({ release, packageRoot: workDir }),
        "buildStart",
      ).call({}),
    ).rejects.toThrow("cc1psx.wasm has SHA-256");
  });

  it("emits every vendor file and the source archive, caching it under the project root", async () => {
    const release = await fakePackage(join(workDir, "package"));
    const fetchArchive = vi.fn(() => Promise.resolve(new Response(ARCHIVE)));
    const plugin = psyqWasmDistribution({
      release,
      packageRoot: join(workDir, "package"),
      fetchArchive,
    });
    const emitted: { fileName: string; originalFileName?: string }[] = [];

    hook(plugin, "configResolved").call({}, { root: join(workDir, "app") });
    // The file list verified at build start is reused when the bundle is written.
    await hook(plugin, "buildStart").call({});
    await hook(plugin, "generateBundle").call({
      emitFile: (file: { fileName: string; originalFileName?: string }) => {
        emitted.push(file);
      },
    });

    expect(emitted.map((file) => file.fileName)).toEqual([
      ...(await vendorFiles(join(workDir, "package"))).map(
        (file) => `vendor/tool/1.0.0/${file.name}`,
      ),
      "vendor/tool/1.0.0/source.tar.gz",
    ]);
    expect(emitted[0]?.originalFileName).toBe(
      join(workDir, "package/dist/cc1psx.js"),
    );
    expect(
      await readFile(
        join(workDir, "app/node_modules/.cache/osp/source.tar.gz"),
        "utf8",
      ),
    ).toBe(ARCHIVE);
  });

  it("keeps an explicit cache directory", async () => {
    const release = await fakePackage(join(workDir, "package"));
    const plugin = psyqWasmDistribution({
      release,
      packageRoot: join(workDir, "package"),
      cacheDirectory: join(workDir, "cache"),
      fetchArchive: () => Promise.resolve(new Response(ARCHIVE)),
    });

    hook(plugin, "configResolved").call({}, { root: join(workDir, "app") });
    await hook(plugin, "generateBundle").call({ emitFile: () => undefined });

    expect(await readFile(join(workDir, "cache/source.tar.gz"), "utf8")).toBe(
      ARCHIVE,
    );
  });

  it("serves vendor files from the dev server", async () => {
    const release = await fakePackage(workDir);
    const use = vi.fn();

    hook(
      psyqWasmDistribution({ release, packageRoot: workDir }),
      "configureServer",
    ).call({}, { middlewares: { use } });

    expect(use).toHaveBeenCalledWith(expect.any(Function));
  });
});
