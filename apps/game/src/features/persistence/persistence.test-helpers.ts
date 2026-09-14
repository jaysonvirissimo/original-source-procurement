import type {
  Attempt,
  MissionProgress,
  PlayerState,
  SkillEvidence,
} from "./schema";
import { emptyPlayerState } from "./schema";

/** A UTC timestamp `seconds` after a fixed start, so tests sort predictably. */
export function timestamp(seconds: number): string {
  return new Date(Date.UTC(2026, 8, 13, 0, 0, seconds)).toISOString();
}

export function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "attempt-1",
    missionId: "003",
    createdAt: timestamp(0),
    source: "int add_immediate(int a) { return a + 4; }\n",
    exact: false,
    score: 0.5,
    mismatchSummary: {
      exact: false,
      equalWords: 1,
      targetWords: 2,
      byKind: { IMMEDIATE: 1 },
    },
    compilerBuildId: "compiler-build",
    preprocessorBuildId: "preprocessor-build",
    psyqAsmVersion: "0.2.0",
    aspsxVersion: "2.77",
    pinned: false,
    ...overrides,
  };
}

/** `count` attempts on one mission, one second apart, oldest first. */
export function attempts(
  count: number,
  overrides: Partial<Attempt> = {},
): Attempt[] {
  return Array.from({ length: count }, (_, index) =>
    attempt({
      id: `attempt-${String(index)}`,
      createdAt: timestamp(index),
      ...overrides,
    }),
  );
}

export function missionProgress(
  overrides: Partial<MissionProgress> = {},
): MissionProgress {
  return {
    missionId: "003",
    source: "int add_immediate(int a) { return a; }\n",
    sourceSavedAt: timestamp(0),
    hintMaxStage: 0,
    predictions: [],
    attempts: [],
    ...overrides,
  };
}

export function skillEvidence(
  overrides: Partial<SkillEvidence> = {},
): SkillEvidence {
  return {
    id: "completion-1:ABI.RETURN",
    completionId: "completion-1",
    skill: "ABI.RETURN",
    missionId: "001",
    kind: "introduced",
    hintMaxStage: 0,
    solutionRevealed: false,
    completedAt: timestamp(0),
    ...overrides,
  };
}

/** A player with progress on 001 (complete, with evidence) and 003 (attempts). */
export function samplePlayer(): PlayerState {
  return {
    ...emptyPlayerState(),
    missions: {
      "001": missionProgress({
        missionId: "001",
        source: "int return_path(void) { return 0; }\r\n\t// kept as typed\n",
        completion: {
          count: 1,
          firstCompletedAt: timestamp(10),
          lastCompletedAt: timestamp(10),
          lastCompletionId: "completion-1",
        },
      }),
      "003": missionProgress({
        attempts: [
          attempt({ id: "a", createdAt: timestamp(1) }),
          attempt({ id: "b", createdAt: timestamp(2), pinned: true }),
        ],
        bestMatch: {
          attemptId: "a",
          exact: false,
          score: 0.5,
          equalWords: 1,
          targetWords: 2,
        },
      }),
    },
    skills: { "ABI.RETURN": { evidence: [skillEvidence()] } },
  };
}
