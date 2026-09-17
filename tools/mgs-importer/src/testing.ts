import { UPSTREAM_DEFAULT_BUILD } from "@osp/mission-schema";
import type { FunctionFacts } from "./analysis.ts";
import type {
  FileRecord,
  FunctionRecord,
  FunctionRejection,
  ImportIndex,
  PinnedTarget,
  VerdictIndex,
} from "./records.ts";
import { IMPORT_INDEX_VERSION, VERDICT_INDEX_VERSION } from "./records.ts";

/*
 * Builders for importer records. Every value is OSP-authored placeholder
 * data: commits, hashes, paths, and word counts are arbitrary and describe no
 * real upstream file.
 */

export const UPSTREAM_COMMIT = "1".repeat(40);
export const SDK_COMMIT = "2".repeat(40);
export const PRE_MATCH_COMMIT = "3".repeat(40);
export const PLACEHOLDER_HASH = "a".repeat(64);

export const SAMPLE_FACTS: FunctionFacts = {
  words: 4,
  branches: 0,
  jumps: 1,
  calls: 0,
  basicBlocks: 1,
  loops: 0,
  loads: 1,
  stores: 0,
  loadForms: 1,
  storeForms: 0,
  signedLoads: 0,
  narrowLoads: 0,
  narrowStores: 0,
  narrowAccesses: 0,
  fieldAccesses: 1,
  stackAccesses: 0,
  argumentBaseAccesses: 1,
  gpAccesses: 0,
  absoluteAccesses: 0,
  upperImmediates: 0,
  multiplyDivide: 0,
  coprocessor: 0,
  nops: 1,
  filledDelaySlots: 0,
  assemblerTemporary: 0,
};

export function fileRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  const path = overrides.path ?? "source/sample/sample.c";
  return {
    path,
    overlay: "main",
    gpSize: 0,
    reference: {
      repository: "FoxdieTeam/mgs_reversing",
      commit: UPSTREAM_COMMIT,
      path,
      sha256: PLACEHOLDER_HASH,
    },
    compiler: {
      gpSize: 0,
      aspsxVersion: UPSTREAM_DEFAULT_BUILD.aspsxVersion,
      rawFlags: [...UPSTREAM_DEFAULT_BUILD.rawFlags],
      cppFlags: [...UPSTREAM_DEFAULT_BUILD.cppFlags],
      encoding: UPSTREAM_DEFAULT_BUILD.encoding,
      filename: "sample.c",
      headers: {},
      remoteHeaders: {
        "psyq/include/sample.h": {
          repository: "FoxdieTeam/psyq_sdk",
          commit: SDK_COMMIT,
          path: "psyq_4.4/include/sample.h",
          sha256: PLACEHOLDER_HASH,
        },
      },
    },
    includesAssembly: false,
    ...overrides,
  };
}

const IDENTITY = {
  symbol: "sample_function",
  address: 0x80016ef8,
  size: 16,
  status: "SOLVED",
} as const;

/** A pinned target and the facts read off its words. */
export function pinnedTarget(
  overrides: Partial<PinnedTarget> = {},
): PinnedTarget {
  return {
    target: {
      kind: "remote",
      commit: PRE_MATCH_COMMIT,
      path: "asm/sample/sample_function_80016EF8.s",
      wordCount: 4,
      wordsSha256: PLACEHOLDER_HASH,
    },
    facts: SAMPLE_FACTS,
    tags: ["load", "field-offset"],
    ...overrides,
  };
}

/** A function the importer pinned to a target. */
export function functionRecord(
  overrides: Partial<FunctionRecord> = {},
): FunctionRecord {
  return { ...IDENTITY, pinned: pinnedTarget(), ...overrides };
}

/** A function the importer could not pin, with the reason it recorded. */
export function unpinnedRecord(
  rejection: FunctionRejection,
  overrides: Partial<Omit<FunctionRecord, "pinned">> = {},
): FunctionRecord {
  return { ...IDENTITY, rejection, ...overrides };
}

export function importIndex(overrides: Partial<ImportIndex> = {}): ImportIndex {
  return {
    schemaVersion: IMPORT_INDEX_VERSION,
    importerVersion: "1.0.0",
    upstreamCommit: UPSTREAM_COMMIT,
    sdkCommit: SDK_COMMIT,
    files: [fileRecord()],
    functions: [functionRecord()],
    ...overrides,
  };
}

export function verdictIndex(
  overrides: Partial<VerdictIndex> = {},
): VerdictIndex {
  return {
    schemaVersion: VERDICT_INDEX_VERSION,
    importerVersion: "1.0.0",
    upstreamCommit: UPSTREAM_COMMIT,
    sdkCommit: SDK_COMMIT,
    files: [
      { path: "source/sample/sample.c", outcome: "built", definedFunctions: 1 },
    ],
    functions: [
      {
        symbol: "sample_function",
        sourcePath: "source/sample/sample.c",
        verdict: "exact",
      },
    ],
    ...overrides,
  };
}
