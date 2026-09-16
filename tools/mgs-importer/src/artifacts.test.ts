import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readImportIndex,
  readModuleText,
  readOverrides,
  readVerdictIndex,
  renderJson,
  reviewReportPath,
  updateReportPath,
  writeImportIndex,
  writeModule,
  writeReviewReport,
  writeUpdateReport,
  writeVerdictIndex,
  IMPORT_INDEX_PATH,
  VERDICT_INDEX_PATH,
} from "./artifacts.ts";
import { OVERRIDES_PATH } from "./overrides.ts";
import { importIndex, verdictIndex, UPSTREAM_COMMIT } from "./testing.ts";

describe("renderJson", () => {
  it("indents by two and ends with a newline", () => {
    expect(renderJson({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});

describe("paths", () => {
  it("names the reports after the revision they describe", () => {
    expect(reviewReportPath(UPSTREAM_COMMIT)).toBe(
      `tmp/reports/corpus/${UPSTREAM_COMMIT}-review.md`,
    );
    expect(updateReportPath(UPSTREAM_COMMIT)).toBe(
      `tmp/reports/corpus/${UPSTREAM_COMMIT}-update.md`,
    );
  });
});

describe("reading and writing under a root", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "osp-corpus-artifacts-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function put(path: string, contents: string) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }

  it("writes the import index, creating the report directory", async () => {
    await writeImportIndex(importIndex(), root);
    await expect(readImportIndex(root)).resolves.toEqual(importIndex());
    await expect(
      readFile(join(root, IMPORT_INDEX_PATH), "utf8"),
    ).resolves.toMatch(/\n$/);
  });

  it("writes and reads the verdicts", async () => {
    await writeVerdictIndex(verdictIndex(), root);
    await expect(readVerdictIndex(root)).resolves.toEqual(verdictIndex());
    await expect(
      readFile(join(root, VERDICT_INDEX_PATH), "utf8"),
    ).resolves.toBeTruthy();
  });

  it("says which command to run when an index is missing", async () => {
    await expect(readImportIndex(root)).rejects.toThrow(/pnpm corpus:import/);
    await expect(readVerdictIndex(root)).rejects.toThrow(/pnpm corpus:verify/);
  });

  it("writes both reports", async () => {
    await writeReviewReport(UPSTREAM_COMMIT, "review\n", root);
    await writeUpdateReport(UPSTREAM_COMMIT, "update\n", root);
    await expect(
      readFile(join(root, reviewReportPath(UPSTREAM_COMMIT)), "utf8"),
    ).resolves.toBe("review\n");
    await expect(
      readFile(join(root, updateReportPath(UPSTREAM_COMMIT)), "utf8"),
    ).resolves.toBe("update\n");
  });

  it("reads the reviewed overrides", async () => {
    await put(OVERRIDES_PATH, '{"schemaVersion":1,"missions":[]}');
    await expect(readOverrides(root)).resolves.toEqual({
      schemaVersion: 1,
      missions: [],
    });
  });

  it("writes a generated module and reads it back", async () => {
    await writeModule("packages/sample/src/generated.ts", "export {};\n", root);
    await expect(
      readModuleText("packages/sample/src/generated.ts", root),
    ).resolves.toBe("export {};\n");
  });

  it("reads no text for a module that has not been generated yet", async () => {
    await expect(readModuleText("absent.ts", root)).resolves.toBeUndefined();
  });
});

describe("the default root", () => {
  it("is the working directory", async () => {
    await expect(readModuleText("package.json")).resolves.toContain(
      '"name": "osp"',
    );
  });
});
