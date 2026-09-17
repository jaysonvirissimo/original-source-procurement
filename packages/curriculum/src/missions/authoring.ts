import {
  PSYQ_WASM_DEFAULT_CPP_FLAGS,
  type DifficultyProfile,
  type Mission,
} from "@osp/mission-schema";

/**
 * A synthetic mission as authored, before its target is generated from its
 * solution with the pinned compiler and assembler.
 */
export type MissionDraft = Omit<Mission, "target">;

/**
 * Compiler input shared by the training missions, with any OSP-authored
 * headers the source includes.
 */
export function trainingCompiler(
  filename: string,
  headers: Mission["compiler"]["headers"] = {},
): Mission["compiler"] {
  return {
    gpSize: 0,
    aspsxVersion: "2.77",
    rawFlags: ["-O2", "-g0", "-Wall"],
    cppFlags: [...PSYQ_WASM_DEFAULT_CPP_FLAGS],
    encoding: "utf8",
    filename,
    headers,
  };
}

/** A translation-phase profile: a few words and nothing but the ABI. */
export function translationDifficulty(size: number): DifficultyProfile {
  return {
    size,
    controlFlow: 0,
    memory: 0,
    abi: 1,
    types: 0,
    compilerShaping: 0,
    context: 0,
    specialHardware: 0,
  };
}

/**
 * A conditions-phase profile: a test, and the shaping that hides it.
 *
 * `controlFlow` is scored the way the importer scores a real function
 * (branches, jumps, blocks, and loops twice over), so a synthetic mission and
 * a field mission sit on the same scale. A function that only returns counts
 * its own return as the one jump.
 */
export function conditionsDifficulty(
  size: number,
  compilerShaping: number,
): DifficultyProfile {
  return {
    size,
    controlFlow: 2,
    memory: 0,
    abi: 1,
    types: 0,
    compilerShaping,
    context: 0,
    specialHardware: 0,
  };
}

/** A memory-phase profile: loads and stores through supplied types. */
export function memoryDifficulty(
  size: number,
  types: number,
): DifficultyProfile {
  return {
    size,
    controlFlow: 0,
    memory: 1,
    abi: 1,
    types,
    compilerShaping: 0,
    context: 0,
    specialHardware: 0,
  };
}
