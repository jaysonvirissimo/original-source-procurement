import { describe, expect, it } from "vitest";
import { timestamp } from "../persistence/persistence.test-helpers";
import type { SkillEvidence } from "../persistence/schema";
import {
  completionMode,
  completionModeText,
  onlyRevealed,
} from "./completionMode";

function event(
  missionId: string,
  completionId: string,
  skill: string,
  hintMaxStage: number,
  solutionRevealed: boolean,
): SkillEvidence {
  return {
    id: `${completionId}:${skill}`,
    completionId,
    skill,
    missionId,
    kind: "real",
    hintMaxStage,
    solutionRevealed,
    completedAt: timestamp(1),
  };
}

describe("completionMode", () => {
  it.each([
    ["no evidence", [], undefined],
    ["no hints", [{ hintMaxStage: 0, solutionRevealed: false }], "independent"],
    ["hints", [{ hintMaxStage: 4, solutionRevealed: false }], "hinted"],
    [
      "a revealed solution",
      [{ hintMaxStage: 9, solutionRevealed: true }],
      "solution-revealed",
    ],
  ] as const)("%s → %s", (_name, events, mode) => {
    expect(completionMode(events)).toBe(mode);
  });

  it("names each mode for players", () => {
    expect(completionModeText("independent", 0)).toBe("Independent");
    expect(completionModeText("hinted", 3)).toBe("Hints to stage 3");
    expect(completionModeText("solution-revealed", 9)).toBe(
      "Solution revealed",
    );
  });
});

describe("onlyRevealed", () => {
  const skills = (...events: SkillEvidence[]) => {
    const bySkill: Record<string, { evidence: SkillEvidence[] }> = {};
    for (const recorded of events) {
      (bySkill[recorded.skill] ??= { evidence: [] }).evidence.push(recorded);
    }
    return { skills: bySkill };
  };

  it("is true when every completion revealed the solution", () => {
    const state = skills(
      event("F01", "c1", "ABI.ARGUMENT", 9, true),
      event("F01", "c1", "C.STRUCT.FIELD", 9, true),
      event("001", "c0", "ABI.RETURN", 0, false),
    );
    expect(onlyRevealed(state, "F01")).toBe(true);
    expect(onlyRevealed(state, "001")).toBe(false);
  });

  it("is false once any completion did without the solution", () => {
    const state = skills(
      event("F01", "c1", "ABI.ARGUMENT", 9, true),
      event("F01", "c2", "ABI.ARGUMENT", 2, false),
    );
    expect(onlyRevealed(state, "F01")).toBe(false);
  });

  it("is false for a mission with no recorded evidence", () => {
    expect(onlyRevealed(skills(), "F01")).toBe(false);
  });
});
