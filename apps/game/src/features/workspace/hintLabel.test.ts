import { missions } from "@osp/curriculum";
import type { Hint } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import { hintLabel, openedHintsLabel, revealsSolution } from "./hintLabel";

const ladder: Hint[] = [
  { stage: 1, text: "Skill." },
  { stage: 2, text: "Rows." },
  { stage: 9, text: "Answer.", revealSolution: true },
];

describe("hintLabel", () => {
  it("numbers hints by position among the non-solution hints", () => {
    expect(ladder.map((hint) => hintLabel(ladder, hint))).toEqual([
      "Hint 1 of 2 · Skill",
      "Hint 2 of 2 · Where to look",
      "Solution reveal",
    ]);
  });

  it("describes how far an attempt's hints went without a stage number", () => {
    expect(openedHintsLabel(ladder, 2)).toBe(
      "Hints opened through Hint 2 of 2 · Where to look",
    );
    expect(openedHintsLabel(ladder, 9)).toBe(
      "Hints opened through Solution reveal",
    );
    // A stage the ladder no longer has names the last hint before it.
    expect(openedHintsLabel(ladder, 5)).toBe(
      "Hints opened through Hint 2 of 2 · Where to look",
    );
    expect(openedHintsLabel(ladder.slice(1), 1)).toBe("Hints opened");
  });

  it("recognizes the solution as the next reveal", () => {
    expect(revealsSolution(ladder[2])).toBe(true);
    expect(revealsSolution(ladder[0])).toBe(false);
    expect(revealsSolution(undefined)).toBe(false);
  });

  it("never shows a bare stage number on any shipped ladder", () => {
    for (const mission of missions) {
      const labels = mission.hints.map((hint) =>
        hintLabel(mission.hints, hint),
      );
      for (const label of labels) {
        expect(label, mission.id).not.toMatch(/Stage/);
      }
      mission.hints.forEach((hint, index) => {
        expect(labels[index], mission.id).toEqual(
          hint.stage === 9
            ? "Solution reveal"
            : expect.stringMatching(/^Hint \d+ of \d+ · \S/),
        );
      });
    }
  });
});
