import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectNotices,
  NOTICES_FILE_NAME,
  packageFromModuleId,
  parseManifest,
  readPackageNotice,
  renderNotices,
  thirdPartyNotices,
} from "./third-party-notices";

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "osp-notices-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function installPackage(
  name: string,
  manifest: Record<string, unknown>,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = join(
    workDir,
    "node_modules/.pnpm",
    `${name.replace("/", "+")}@1.0.0`,
    "node_modules",
    name,
  );
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  for (const [file, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), contents);
  }
  return root;
}

describe("packageFromModuleId", () => {
  it("finds an unscoped package in the pnpm layout", () => {
    expect(
      packageFromModuleId(
        "/repo/node_modules/.pnpm/react@19.3.0/node_modules/react/index.js",
      ),
    ).toEqual({
      name: "react",
      root: "/repo/node_modules/.pnpm/react@19.3.0/node_modules/react",
    });
  });

  it("finds a scoped package and ignores query strings", () => {
    expect(
      packageFromModuleId(
        "/repo/node_modules/@fontsource/ibm-plex-mono/400.css?used",
      ),
    ).toEqual({
      name: "@fontsource/ibm-plex-mono",
      root: "/repo/node_modules/@fontsource/ibm-plex-mono",
    });
  });

  it("normalizes Windows separators", () => {
    expect(
      packageFromModuleId("C:\\repo\\node_modules\\scheduler\\index.js"),
    ).toEqual({ name: "scheduler", root: "C:/repo/node_modules/scheduler" });
  });

  it.each([
    "/repo/apps/game/src/main.tsx",
    "\0vite/preload-helper.js",
    "/repo/node_modules/",
    "/repo/node_modules/@scope",
  ])("returns undefined for %j", (moduleId) => {
    expect(packageFromModuleId(moduleId)).toBeUndefined();
  });
});

describe("parseManifest", () => {
  it("returns name, version, and license", () => {
    expect(
      parseManifest({ name: "a", version: "1.0.0", license: "MIT" }, "/a"),
    ).toEqual({ name: "a", version: "1.0.0", license: "MIT" });
  });

  it.each([null, "text", { name: "a", version: "1.0.0" }])(
    "rejects %j",
    (manifest) => {
      expect(() => parseManifest(manifest, "/pkg")).toThrow(
        'The package manifest at /pkg must declare string "name", "version", and "license" fields.',
      );
    },
  );
});

describe("readPackageNotice", () => {
  it("reads the manifest and license text", async () => {
    const root = await installPackage(
      "@scope/pkg",
      { name: "@scope/pkg", version: "1.0.0", license: "OFL-1.1" },
      { "LICENSE.md": "Font license text\n", "README.md": "readme" },
    );

    await expect(readPackageNotice(root)).resolves.toEqual({
      name: "@scope/pkg",
      version: "1.0.0",
      license: "OFL-1.1",
      licenseText: "Font license text\n",
    });
  });

  it("appends the per-license texts of a LICENSES directory", async () => {
    const root = await installPackage(
      "dual",
      { name: "dual", version: "1.0.0", license: "MIT AND GPL-2.0-only" },
      {
        LICENSE: "Applied per file.\n",
        "LICENSES/MIT.txt": "MIT text\n",
        "LICENSES/GPL-2.0-only.txt": "GPL text\n",
      },
    );

    const notice = await readPackageNotice(root);

    expect(notice.licenseText).toBe(
      "Applied per file.\n\n--- LICENSES/GPL-2.0-only.txt ---\n\nGPL text\n\n--- LICENSES/MIT.txt ---\n\nMIT text",
    );
  });

  it("fails when the package has no license file", async () => {
    const root = await installPackage(
      "unlicensed",
      { name: "unlicensed", version: "1.0.0", license: "MIT" },
      { "README.md": "readme" },
    );

    await expect(readPackageNotice(root)).rejects.toThrow(
      "The bundled package unlicensed@1.0.0 has no license file",
    );
  });

  describe("with vendored license texts", () => {
    const entry = {
      license: "MIT",
      file: "bare.LICENSE",
      source: "https://github.com/scope/bare/blob/v1.0.0/LICENSE",
    };

    async function vendoredDirectory(): Promise<string> {
      const directory = join(workDir, "licenses");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "bare.LICENSE"), "Vendored MIT text\n");
      return directory;
    }

    it("uses the text for a package that ships none, at its exact version", async () => {
      const root = await installPackage(
        "@scope/bare",
        { name: "@scope/bare", version: "1.0.0", license: "MIT" },
        { "README.md": "readme" },
      );
      const directory = await vendoredDirectory();

      await expect(
        readPackageNotice(root, {
          directory,
          entries: { "@scope/bare@1.0.0": entry },
        }),
      ).resolves.toEqual({
        name: "@scope/bare",
        version: "1.0.0",
        license: "MIT",
        licenseText: "Vendored MIT text\n",
      });
      await expect(
        readPackageNotice(root, {
          directory,
          entries: { "@scope/bare@2.0.0": entry },
        }),
      ).rejects.toThrow(
        "The bundled package @scope/bare@1.0.0 has no license file",
      );
    });

    it("fails when the declared license differs from the vendored text's", async () => {
      const root = await installPackage(
        "@scope/bare",
        { name: "@scope/bare", version: "1.0.0", license: "MIT" },
        {},
      );

      await expect(
        readPackageNotice(root, {
          directory: await vendoredDirectory(),
          entries: { "@scope/bare@1.0.0": { ...entry, license: "ISC" } },
        }),
      ).rejects.toThrow(
        "The vendored license text for @scope/bare@1.0.0 is ISC, but the package declares MIT.",
      );
    });

    it("prefers the package's own license file", async () => {
      const root = await installPackage(
        "@scope/bare",
        { name: "@scope/bare", version: "1.0.0", license: "MIT" },
        { LICENSE: "Shipped text\n" },
      );

      const notice = await readPackageNotice(root, {
        directory: await vendoredDirectory(),
        entries: { "@scope/bare@1.0.0": entry },
      });

      expect(notice.licenseText).toBe("Shipped text\n");
    });
  });
});

describe("renderNotices", () => {
  it("sorts entries, removes duplicates, and includes full license texts", () => {
    const text = renderNotices([
      { name: "zeta", version: "2.0.0", license: "MIT", licenseText: "Z\n" },
      { name: "alpha", version: "1.0.0", license: "ISC", licenseText: "A" },
      { name: "zeta", version: "1.0.0", license: "MIT", licenseText: "Z1" },
      { name: "alpha", version: "1.0.0", license: "ISC", licenseText: "A" },
    ]);

    expect(text.match(/^alpha 1\.0\.0$/gm)).toHaveLength(1);
    expect(text.indexOf("alpha 1.0.0")).toBeLessThan(
      text.indexOf("zeta 1.0.0"),
    );
    expect(text.indexOf("zeta 1.0.0")).toBeLessThan(text.indexOf("zeta 2.0.0"));
    expect(text).toContain("License: ISC\n");
    expect(text).toContain("\nZ\n");
  });
});

describe("thirdPartyNotices", () => {
  it("emits notices for bundled modules and assets, but not project files", async () => {
    const libRoot = await installPackage(
      "lib",
      { name: "lib", version: "1.0.0", license: "MIT" },
      { LICENSE: "MIT license text" },
    );
    const fontRoot = await installPackage(
      "@fonts/face",
      { name: "@fonts/face", version: "1.0.0", license: "OFL-1.1" },
      { LICENSE: "Font license text" },
    );
    const projectRoot = join(workDir, "apps/game");
    const fontAsset =
      "../../node_modules/.pnpm/@fonts+face@1.0.0/node_modules/@fonts/face/files/face.woff2";

    const plugin = thirdPartyNotices();
    const emitted: unknown[] = [];
    const context = {
      getModuleIds: () =>
        [join(libRoot, "index.js"), join(projectRoot, "src/main.tsx")][
          Symbol.iterator
        ](),
      emitFile: (file: unknown) => {
        emitted.push(file);
        return "reference";
      },
    };
    const bundle = {
      "assets/face.woff2": { type: "asset", originalFileNames: [fontAsset] },
      "assets/logo.svg": {
        type: "asset",
        originalFileNames: ["src/logo.svg"],
      },
      "assets/index.js": { type: "chunk" },
    };

    expect(plugin.apply).toBe("build");
    const { configResolved, generateBundle } = plugin;
    if (
      typeof configResolved !== "function" ||
      typeof generateBundle !== "function"
    ) {
      throw new Error("The notices plugin must use function hooks.");
    }
    await configResolved.call({} as never, { root: projectRoot } as never);
    await generateBundle.call(
      context as never,
      {} as never,
      bundle as never,
      true,
    );

    expect(emitted).toEqual([
      {
        type: "asset",
        fileName: NOTICES_FILE_NAME,
        source: await collectNotices([
          join(libRoot, "index.js"),
          join(fontRoot, "files/face.woff2"),
        ]),
      },
    ]);
    const source = JSON.stringify(emitted);
    expect(source).toContain("lib 1.0.0");
    expect(source).toContain("@fonts/face 1.0.0");
  });

  it("appends the appendix after the package entries", async () => {
    const libRoot = await installPackage(
      "lib",
      { name: "lib", version: "1.0.0", license: "MIT" },
      { LICENSE: "MIT license text" },
    );
    const plugin = thirdPartyNotices({ appendix: "Compiler provenance\n" });
    const emitted: { source: string }[] = [];
    const { generateBundle } = plugin;
    if (typeof generateBundle !== "function") {
      throw new Error("The notices plugin must use function hooks.");
    }

    await generateBundle.call(
      {
        getModuleIds: () => [join(libRoot, "index.js")][Symbol.iterator](),
        emitFile: (file: { source: string }) => {
          emitted.push(file);
          return "reference";
        },
      } as never,
      {} as never,
      {} as never,
      true,
    );

    expect(emitted[0]?.source).toBe(
      `${await collectNotices([join(libRoot, "index.js")])}\nCompiler provenance\n`,
    );
  });
});
