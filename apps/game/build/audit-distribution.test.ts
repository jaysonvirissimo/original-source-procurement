import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  auditDistribution,
  runDistributionAudit,
  type AuditExpectations,
} from "./audit-distribution";
import { sha256Hex } from "./psyq-wasm-distribution";
import type { PsyqWasmRelease } from "./psyq-wasm-release";

let site: string;

beforeEach(async () => {
  site = await mkdtemp(join(tmpdir(), "osp-audit-"));
});

afterEach(async () => {
  await rm(site, { recursive: true, force: true });
});

// OSP-authored placeholder artifacts; nothing here comes from psyq-wasm.
const ARTIFACTS: Readonly<Record<string, string>> = {
  "cc1psx.wasm": "placeholder compiler module",
  "cc1psx.js": 'export const BUILD_ID = "sha256:1111111111111111";\n',
  "cccp.wasm": "placeholder preprocessor module",
  "cccp.js": 'export const BUILD_ID = "sha256:2222222222222222";\n',
};
const ARCHIVE = "placeholder source archive";

const RELEASE: PsyqWasmRelease = {
  version: "1.0.0",
  vendorDirectory: "vendor/tool/1.0.0",
  artifacts: Object.fromEntries(
    Object.entries(ARTIFACTS).map(([name, contents]) => [
      name,
      sha256Hex(contents),
    ]),
  ),
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

const EXPECTATIONS: AuditExpectations = {
  release: RELEASE,
  noticesFile: "NOTICES.txt",
  noticeText: ["tool 1.0.0", "Placeholder GPL"],
};

async function write(path: string, contents: string): Promise<void> {
  await mkdir(dirname(join(site, path)), { recursive: true });
  await writeFile(join(site, path), contents);
}

async function remove(path: string): Promise<void> {
  await rm(join(site, path));
}

async function buildCompliantSite(): Promise<void> {
  const vendor = RELEASE.vendorDirectory;
  await write("index.html", "<!doctype html><title>OSP</title>");
  await write("assets/index.js", "console.log('OSP');\n");
  await write("assets/index.css", "body{}");
  await write(
    "NOTICES.txt",
    [
      "tool 1.0.0",
      "Placeholder GPL",
      ...Object.values(RELEASE.artifacts),
      "source.tar.gz",
    ].join("\n"),
  );
  for (const [name, contents] of Object.entries(ARTIFACTS)) {
    await write(`${vendor}/${name}`, contents);
  }
  await write(`${vendor}/worker.js`, "import './cc1psx.js';\n");
  await write(`${vendor}/source.tar.gz`, ARCHIVE);
  for (const record of [
    "PROVENANCE.md",
    "SHA256SUMS",
    "build-info.json",
    "LICENSE",
    "LICENSES/GPL-2.0-only.txt",
  ]) {
    await write(`${vendor}/${record}`, "placeholder record\n");
  }
}

describe("auditDistribution", () => {
  it("passes a site that ships the artifacts verbatim with notices, records, and source", async () => {
    await buildCompliantSite();
    await write("assets/other.wasm", "an unrelated module");

    await expect(auditDistribution(site, EXPECTATIONS)).resolves.toEqual([]);
  });

  it("fails a site without notices", async () => {
    await buildCompliantSite();
    await remove("NOTICES.txt");

    await expect(auditDistribution(site, EXPECTATIONS)).resolves.toEqual([
      {
        code: "missing-file",
        path: "NOTICES.txt",
        message: "The site is missing its third-party notices.",
      },
    ]);
  });

  it("fails notices that lack a license text", async () => {
    await buildCompliantSite();
    await write("NOTICES.txt", "tool 1.0.0\n");

    const issues = await auditDistribution(site, EXPECTATIONS);

    expect(issues.map((issue) => issue.message)).toContain(
      'The notices do not contain "Placeholder GPL".',
    );
    expect(issues.map((issue) => issue.message)).toContain(
      'The notices do not contain "source.tar.gz".',
    );
    expect(issues.every((issue) => issue.code === "notices-incomplete")).toBe(
      true,
    );
  });

  it("fails a site without the corresponding-source archive", async () => {
    await buildCompliantSite();
    await remove("vendor/tool/1.0.0/source.tar.gz");

    await expect(auditDistribution(site, EXPECTATIONS)).resolves.toEqual([
      {
        code: "missing-file",
        path: "vendor/tool/1.0.0/source.tar.gz",
        message: "The site is missing the corresponding-source archive.",
      },
    ]);
  });

  it("fails a mismatched artifact hash", async () => {
    await buildCompliantSite();
    await write("vendor/tool/1.0.0/cc1psx.wasm", "rebuilt compiler module");

    await expect(auditDistribution(site, EXPECTATIONS)).resolves.toEqual([
      {
        code: "hash-mismatch",
        path: "vendor/tool/1.0.0/cc1psx.wasm",
        message: `SHA-256 is ${sha256Hex("rebuilt compiler module")}, but psyq-wasm 1.0.0 has ${sha256Hex(ARTIFACTS["cc1psx.wasm"] ?? "")}.`,
      },
    ]);
  });

  it("fails a site without a license record", async () => {
    await buildCompliantSite();
    await remove("vendor/tool/1.0.0/LICENSES/GPL-2.0-only.txt");

    await expect(auditDistribution(site, EXPECTATIONS)).resolves.toEqual([
      {
        code: "missing-file",
        path: "vendor/tool/1.0.0/LICENSES/GPL-2.0-only.txt",
        message: "The site is missing a license or provenance record.",
      },
    ]);
  });

  it("fails a missing artifact", async () => {
    await buildCompliantSite();
    await remove("vendor/tool/1.0.0/cccp.js");

    const issues = await auditDistribution(site, EXPECTATIONS);

    expect(issues).toEqual([
      {
        code: "missing-file",
        path: "vendor/tool/1.0.0/cccp.js",
        message: "The site is missing a compiler artifact.",
      },
    ]);
  });

  it("fails a bundled script that holds a transformed copy of the glue code", async () => {
    await buildCompliantSite();
    await write(
      "assets/worker-abc123.js",
      'const a="sha256:2222222222222222";export{a as B};',
    );

    const issues = await auditDistribution(site, EXPECTATIONS);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("transformed-artifact");
    expect(issues[0]?.path).toBe("assets/worker-abc123.js");
  });

  it("fails a second copy of a compiler module", async () => {
    await buildCompliantSite();
    await write("assets/cc1psx-abc123.wasm", ARTIFACTS["cc1psx.wasm"] ?? "");

    await expect(auditDistribution(site, EXPECTATIONS)).resolves.toEqual([
      {
        code: "duplicate-artifact",
        path: "assets/cc1psx-abc123.wasm",
        message:
          "A second copy of a compiler artifact, outside vendor/tool/1.0.0/.",
      },
    ]);
  });
});

describe("runDistributionAudit", () => {
  function output() {
    return { log: vi.fn(), error: vi.fn() };
  }

  it("reports a pass and exits 0", async () => {
    await buildCompliantSite();
    const out = output();

    await expect(runDistributionAudit(site, EXPECTATIONS, out)).resolves.toBe(
      0,
    );
    expect(out.log).toHaveBeenCalledWith(
      `Distribution audit passed: ${site} ships psyq-wasm 1.0.0 with notices, provenance, and corresponding source.`,
    );
  });

  it("prints each issue and exits 1", async () => {
    await buildCompliantSite();
    await remove("NOTICES.txt");
    const out = output();

    await expect(runDistributionAudit(site, EXPECTATIONS, out)).resolves.toBe(
      1,
    );
    expect(out.error).toHaveBeenCalledWith(
      "NOTICES.txt: The site is missing its third-party notices. [missing-file]",
    );
    expect(out.error).toHaveBeenLastCalledWith(
      "Distribution audit failed with 1 issue.",
    );
  });

  it("counts several issues", async () => {
    await buildCompliantSite();
    await remove("NOTICES.txt");
    await remove("vendor/tool/1.0.0/source.tar.gz");
    const out = output();

    await runDistributionAudit(site, EXPECTATIONS, out);

    expect(out.error).toHaveBeenLastCalledWith(
      "Distribution audit failed with 2 issues.",
    );
  });

  it("exits 1 when there is no built site", async () => {
    const out = output();

    await expect(
      runDistributionAudit(join(site, "missing"), EXPECTATIONS, out),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      `Could not read the built site at ${join(site, "missing")}. Run the build first.`,
    );
  });
});
