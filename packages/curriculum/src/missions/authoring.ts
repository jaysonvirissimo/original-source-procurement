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

/** Compiler input shared by the first training missions. */
export function trainingCompiler(filename: string): Mission["compiler"] {
  return {
    gpSize: 0,
    aspsxVersion: "2.77",
    rawFlags: ["-O2", "-g0", "-Wall"],
    cppFlags: [...PSYQ_WASM_DEFAULT_CPP_FLAGS],
    encoding: "utf8",
    filename,
    headers: {},
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
