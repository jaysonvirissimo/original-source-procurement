import { describe, expect, it } from "vitest";
import { CompletionRuleSchema } from "./completion.ts";
import { DifficultyProfileSchema } from "./difficulty.ts";
import { HintSchema, InstructionRangeSchema } from "./hint.ts";
import { ManualEntrySchema } from "./manual.ts";
import { PredictionPromptSchema } from "./prediction.ts";
import { LineSpanSchema, RemoteCReferenceSchema } from "./remote.ts";
import { SkillSchema } from "./skill.ts";
import { MissionSourceSchema } from "./source.ts";
import {
  issuesOf,
  PLACEHOLDER_COMMIT,
  PLACEHOLDER_HASH,
  syntheticMission,
} from "./testing.ts";

const skill = {
  id: "ABI.ARGUMENT",
  name: "Arguments",
  description: "Arguments arrive in registers.",
  prerequisites: ["ABI.RETURN"],
  manualEntry: "abi.arguments",
};

const reference = {
  repository: "FoxdieTeam/mgs_reversing",
  commit: PLACEHOLDER_COMMIT,
  path: "source/sample/sample.c",
  sha256: PLACEHOLDER_HASH,
} as const;

describe("SkillSchema", () => {
  it("accepts a skill", () => {
    expect(issuesOf(SkillSchema, skill)).toEqual([]);
  });

  it("rejects a skill that requires itself", () => {
    expect(
      issuesOf(SkillSchema, { ...skill, prerequisites: ["ABI.ARGUMENT"] }),
    ).toEqual([
      {
        path: "prerequisites",
        message: "A skill cannot be its own prerequisite.",
      },
    ]);
  });

  it("rejects repeated prerequisites and unknown keys", () => {
    expect(
      SkillSchema.safeParse({
        ...skill,
        prerequisites: ["ABI.RETURN", "ABI.RETURN"],
      }).success,
    ).toBe(false);
    expect(SkillSchema.safeParse({ ...skill, extra: true }).success).toBe(
      false,
    );
  });
});

describe("RemoteCReferenceSchema", () => {
  it("accepts a reference with and without a line span", () => {
    expect(issuesOf(RemoteCReferenceSchema, reference)).toEqual([]);
    expect(
      issuesOf(RemoteCReferenceSchema, {
        ...reference,
        lines: { start: 4, end: 4 },
      }),
    ).toEqual([]);
  });

  it("rejects a repository outside the allowlist", () => {
    expect(
      RemoteCReferenceSchema.safeParse({
        ...reference,
        repository: "FoxdieTeam/other",
      }).success,
    ).toBe(false);
  });

  it("rejects a span that ends before it starts", () => {
    expect(issuesOf(LineSpanSchema, { start: 5, end: 4 })).toEqual([
      { path: "end", message: "A line span ends at or after its start." },
    ]);
  });
});

describe("HintSchema", () => {
  it("rejects a hint that reveals both upstream C and the solution", () => {
    expect(
      issuesOf(HintSchema, {
        stage: 9,
        text: "Both.",
        reveal: reference,
        revealSolution: true,
      }),
    ).toEqual([
      {
        path: "revealSolution",
        message: "A hint reveals upstream C or the mission solution, not both.",
      },
    ]);
  });

  it.each([0, 10, 2.5])("rejects stage %s", (stage) => {
    expect(HintSchema.safeParse({ stage, text: "Hint." }).success).toBe(false);
  });

  it("rejects an empty instruction range", () => {
    expect(issuesOf(InstructionRangeSchema, { start: 2, end: 2 })).toEqual([
      {
        path: "end",
        message: "An instruction range contains at least one word.",
      },
    ]);
  });
});

describe("PredictionPromptSchema", () => {
  const prompt = {
    question: "Which register carries the first argument?",
    choices: ["$v0", "$a0", "$s0", "$ra"],
    answer: 1,
    revealedBy: "The copy from $a0 into $v0.",
  };

  it("accepts a prompt", () => {
    expect(issuesOf(PredictionPromptSchema, prompt)).toEqual([]);
  });

  it("rejects repeated choices and an out-of-range answer", () => {
    expect(
      issuesOf(PredictionPromptSchema, {
        ...prompt,
        choices: ["$a0", "$a0"],
        answer: 2,
      }),
    ).toEqual([
      { path: "choices", message: "Prediction choices must be distinct." },
      {
        path: "answer",
        message: "The prediction answer must index one of its choices.",
      },
    ]);
  });

  it("rejects fewer than two or more than four choices", () => {
    expect(
      PredictionPromptSchema.safeParse({
        ...prompt,
        choices: ["$a0"],
        answer: 0,
      }).success,
    ).toBe(false);
    expect(
      PredictionPromptSchema.safeParse({
        ...prompt,
        choices: ["a", "b", "c", "d", "e"],
      }).success,
    ).toBe(false);
  });
});

describe("small schemas", () => {
  it("validates completion rules", () => {
    expect(CompletionRuleSchema.safeParse("acknowledge-evidence").success).toBe(
      true,
    );
    expect(CompletionRuleSchema.safeParse("compiled").success).toBe(false);
  });

  it("validates difficulty scores", () => {
    const difficulty = syntheticMission().difficulty;
    expect(issuesOf(DifficultyProfileSchema, difficulty)).toEqual([]);
    expect(
      DifficultyProfileSchema.safeParse({ ...difficulty, memory: -1 }).success,
    ).toBe(false);
    expect(
      DifficultyProfileSchema.safeParse({ ...difficulty, size: Infinity })
        .success,
    ).toBe(false);
  });

  it("validates manual entries", () => {
    expect(
      ManualEntrySchema.safeParse({
        id: "mips.delay-slots",
        section: "MIPS",
        title: "Delay slots",
      }).success,
    ).toBe(true);
    expect(
      ManualEntrySchema.safeParse({
        id: "mips.delay-slots",
        section: "Assembly",
        title: "Delay slots",
      }).success,
    ).toBe(false);
  });

  it("validates mission sources", () => {
    expect(
      MissionSourceSchema.safeParse({
        kind: "mgs-reversing",
        repository: "FoxdieTeam/mgs_reversing",
        build: "vr_exe",
        overlay: "sample",
        symbol: "sample",
      }).success,
    ).toBe(false);
  });
});
