import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

export const NOTICES_FILE_NAME = "THIRD_PARTY_NOTICES.txt";

const NODE_MODULES = "/node_modules/";
const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:[.-].*)?$/i;
const RULE = "=".repeat(78);

export interface PackageLocation {
  readonly name: string;
  readonly root: string;
}

export interface PackageNotice {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly licenseText: string;
}

/**
 * Finds the installed package a bundled file belongs to. Returns undefined
 * for project source and virtual modules. The last `node_modules` segment
 * wins, which also covers pnpm's `.pnpm/<name>@<version>/node_modules/<name>`
 * layout.
 */
export function packageFromModuleId(
  moduleId: string,
): PackageLocation | undefined {
  const queryStart = moduleId.indexOf("?");
  const path = (
    queryStart === -1 ? moduleId : moduleId.slice(0, queryStart)
  ).replaceAll("\\", "/");
  const index = path.lastIndexOf(NODE_MODULES);

  if (index === -1) {
    return undefined;
  }

  const base = path.slice(0, index + NODE_MODULES.length);
  const [first = "", second = ""] = path.slice(base.length).split("/");

  if (first === "" || (first.startsWith("@") && second === "")) {
    return undefined;
  }

  const name = first.startsWith("@") ? `${first}/${second}` : first;
  return { name, root: base + name };
}

export function parseManifest(
  manifest: unknown,
  root: string,
): Omit<PackageNotice, "licenseText"> {
  const fields =
    typeof manifest === "object" && manifest !== null
      ? (manifest as Record<string, unknown>)
      : {};
  const { name, version, license } = fields;

  if (
    typeof name !== "string" ||
    typeof version !== "string" ||
    typeof license !== "string"
  ) {
    throw new Error(
      `The package manifest at ${root} must declare string "name", "version", and "license" fields.`,
    );
  }

  return { name, version, license };
}

export async function readPackageNotice(root: string): Promise<PackageNotice> {
  const manifest: unknown = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const { name, version, license } = parseManifest(manifest, root);
  const licenseFile = (await readdir(root))
    .filter((entry) => LICENSE_FILE.test(entry))
    .sort()[0];

  if (licenseFile === undefined) {
    throw new Error(
      `The bundled package ${name}@${version} has no license file in ${root}.`,
    );
  }

  const licenseText = await readFile(join(root, licenseFile), "utf8");
  return { name, version, license, licenseText };
}

export function renderNotices(notices: readonly PackageNotice[]): string {
  const unique = new Map<string, PackageNotice>();
  for (const notice of notices) {
    unique.set(`${notice.name}@${notice.version}`, notice);
  }

  const sections = [...unique.values()]
    .sort(
      (a, b) =>
        compareText(a.name, b.name) || compareText(a.version, b.version),
    )
    .map((notice) =>
      [
        RULE,
        `${notice.name} ${notice.version}`,
        `License: ${notice.license}`,
        RULE,
        "",
        notice.licenseText.trim(),
        "",
      ].join("\n"),
    );

  return [
    "OSP: Original Source Procurement - third-party notices",
    "",
    "This site distributes the third-party software listed below. Each entry",
    "names the package, its exact version, and its license, followed by the",
    "full license text.",
    "",
    ...sections,
  ].join("\n");
}

/**
 * Renders notices for every installed package that any of the given bundled
 * files (JavaScript modules or emitted assets such as fonts) belongs to.
 */
export async function collectNotices(
  bundledFiles: Iterable<string>,
): Promise<string> {
  const roots = new Set<string>();
  for (const file of bundledFiles) {
    const location = packageFromModuleId(file);
    if (location !== undefined) {
      roots.add(location.root);
    }
  }

  return renderNotices(
    await Promise.all([...roots].map((root) => readPackageNotice(root))),
  );
}

/**
 * Emits a notices file listing every third-party package distributed with the
 * build, with its exact version, license, and full license text. It covers
 * bundled JavaScript modules and emitted assets, because CSS imports such as
 * font packages reach the build only as assets. The build fails if a
 * distributed package has no license file.
 */
export function thirdPartyNotices(): Plugin {
  let projectRoot = process.cwd();

  return {
    name: "osp:third-party-notices",
    apply: "build",
    configResolved(config) {
      projectRoot = config.root;
    },
    async generateBundle(_options, bundle) {
      const assetSources = Object.values(bundle).flatMap((output) =>
        output.type === "asset"
          ? output.originalFileNames.map((file) => resolve(projectRoot, file))
          : [],
      );

      this.emitFile({
        type: "asset",
        fileName: NOTICES_FILE_NAME,
        source: await collectNotices([...this.getModuleIds(), ...assetSources]),
      });
    },
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
