import type { z } from "zod";
import {
  PSYQ_WASM_DEFAULT_CPP_FLAGS,
  UPSTREAM_DEFAULT_BUILD,
} from "./compiler.ts";
import type { FeasibilityPointer } from "./feasibility.ts";
import type { Mission } from "./mission.ts";
import type { InlineTarget, RemoteTarget } from "./target.ts";

/** A schema's issues as dotted paths and messages; empty when valid. */
export function issuesOf(
  schema: z.ZodType,
  value: unknown,
): { path: string; message: string }[] {
  const result = schema.safeParse(value);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/*
 * Test builders for valid missions. Every value is OSP-authored placeholder
 * data: word values, hashes, commits, and paths are arbitrary and do not
 * describe any real function or upstream file.
 */

export const PLACEHOLDER_COMMIT = "1".repeat(40);
export const PLACEHOLDER_HASH = "a".repeat(64);

export function inlineTarget(): InlineTarget {
  return {
    kind: "inline",
    words: [1, 2],
    relocations: [],
    provenance: [{ kind: "instruction" }, { kind: "instruction" }],
    toolchain: {
      ospCommit: PLACEHOLDER_COMMIT,
      psyqWasmVersion: "1.0.0",
      compilerBuildId: "compiler-build",
      preprocessorBuildId: "preprocessor-build",
      psyqAsmVersion: "0.2.0",
    },
    solutionSha256: PLACEHOLDER_HASH,
    wordsSha256: PLACEHOLDER_HASH,
  };
}

export function remoteTarget(): RemoteTarget {
  return {
    kind: "remote",
    commit: PLACEHOLDER_COMMIT,
    path: "asm/sample/sample_function.s",
    wordCount: 4,
    wordsSha256: PLACEHOLDER_HASH,
  };
}

export function feasibilityPointer(): FeasibilityPointer {
  return {
    schemaVersion: 1,
    symbol: "sample_function",
    source: {
      kind: "mgs-reversing",
      repository: "FoxdieTeam/mgs_reversing",
      build: "default",
      overlay: "sample",
      symbol: "sample_function",
      sourcePath: "source/sample/sample.c",
    },
    target: remoteTarget(),
    solution: {
      repository: "FoxdieTeam/mgs_reversing",
      commit: PLACEHOLDER_COMMIT,
      path: "source/sample/sample.c",
      sha256: PLACEHOLDER_HASH,
    },
    compiler: {
      gpSize: 0,
      aspsxVersion: "2.77",
      rawFlags: [...UPSTREAM_DEFAULT_BUILD.rawFlags],
      cppFlags: [...UPSTREAM_DEFAULT_BUILD.cppFlags],
      encoding: "eucjp",
      filename: "sample.c",
      headers: {},
      remoteHeaders: {
        "psyq/include/sample.h": {
          repository: "FoxdieTeam/psyq_sdk",
          commit: PLACEHOLDER_COMMIT,
          path: "psyq_4.4/include/sample.h",
          sha256: PLACEHOLDER_HASH,
        },
        "source/libsample/sample.h": {
          repository: "FoxdieTeam/mgs_reversing",
          commit: PLACEHOLDER_COMMIT,
          path: "source/libsample/sample.h",
          sha256: PLACEHOLDER_HASH,
        },
      },
    },
  };
}

const DIFFICULTY = {
  size: 1,
  controlFlow: 0,
  memory: 0,
  abi: 1,
  types: 0,
  compilerShaping: 0,
  context: 0,
  specialHardware: 0,
};

export function syntheticMission(overrides: Partial<Mission> = {}): Mission {
  return {
    schemaVersion: 1,
    id: "sample-training",
    title: "SAMPLE TRAINING",
    phase: "Translation",
    kind: "training",
    source: { kind: "synthetic" },
    requires: [],
    teaches: ["ABI.RETURN"],
    practices: [],
    scaffold: "guided",
    completion: "exact",
    compiler: {
      gpSize: 0,
      aspsxVersion: "2.77",
      rawFlags: ["-O2"],
      cppFlags: [...PSYQ_WASM_DEFAULT_CPP_FLAGS],
      encoding: "utf8",
      filename: "mission.c",
      headers: {},
    },
    briefing: { objective: "Return a constant." },
    starterSource: "int sample(void) {\n}\n",
    solution: "int sample(void) { return 1; }\n",
    symbol: "sample",
    target: inlineTarget(),
    hints: [
      { stage: 1, text: "Look at the return register." },
      { stage: 9, text: "The full solution.", revealSolution: true },
    ],
    difficulty: DIFFICULTY,
    ...overrides,
  };
}

export function realMission(overrides: Partial<Mission> = {}): Mission {
  return {
    schemaVersion: 1,
    id: "sample-real",
    title: "SAMPLE FIELD WORK",
    phase: "Field work",
    kind: "real-solved",
    source: {
      kind: "mgs-reversing",
      repository: "FoxdieTeam/mgs_reversing",
      build: "default",
      overlay: "sample",
      symbol: "sample_function",
      sourcePath: "source/sample/sample.c",
    },
    requires: ["ABI.RETURN"],
    teaches: [],
    practices: [],
    scaffold: "field",
    completion: "exact",
    compiler: {
      gpSize: 0,
      aspsxVersion: "2.77",
      rawFlags: [...UPSTREAM_DEFAULT_BUILD.rawFlags],
      cppFlags: [...UPSTREAM_DEFAULT_BUILD.cppFlags],
      encoding: "eucjp",
      filename: "sample.c",
      headers: {},
      remoteHeaders: {
        "psyq/include/sample.h": {
          repository: "FoxdieTeam/psyq_sdk",
          commit: PLACEHOLDER_COMMIT,
          path: "psyq_4.4/include/sample.h",
          sha256: PLACEHOLDER_HASH,
        },
      },
    },
    briefing: { objective: "Match the function." },
    starterSource: "void sample_function(void) {\n}\n",
    symbol: "sample_function",
    target: remoteTarget(),
    hints: [
      {
        stage: 5,
        text: "An important declaration.",
        reveal: {
          repository: "FoxdieTeam/psyq_sdk",
          commit: PLACEHOLDER_COMMIT,
          path: "psyq_4.4/include/sample.h",
          sha256: PLACEHOLDER_HASH,
          lines: { start: 3, end: 4 },
        },
      },
      {
        stage: 9,
        text: "The known solution.",
        reveal: {
          repository: "FoxdieTeam/mgs_reversing",
          commit: PLACEHOLDER_COMMIT,
          path: "source/sample/sample.c",
          sha256: PLACEHOLDER_HASH,
          lines: { start: 10, end: 20 },
        },
      },
    ],
    difficulty: DIFFICULTY,
    ...overrides,
  };
}
