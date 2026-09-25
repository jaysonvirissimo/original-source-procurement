import { missions } from "@osp/curriculum";
import type { Hint, RemoteCReference } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import {
  hintLabel,
  hintPosition,
  hintReached,
  ladderSummary,
  openedHintsLabel,
  revealsSolution,
} from "./hintLabel";

// OSP-authored test content, not an upstream reference.
const upstreamSource: RemoteCReference = {
  repository: "FoxdieTeam/mgs_reversing",
  commit: "a".repeat(40),
  path: "source/example.c",
  sha256: "b".repeat(64),
};

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

  it("gives a hint's position without its purpose", () => {
    expect(ladder.map((hint) => hintPosition(ladder, hint))).toEqual([
      "Hint 1 of 2",
      "Hint 2 of 2",
      "Solution reveal",
    ]);
  });

  it("finds the last hint at or before a saved stage", () => {
    expect(hintReached(ladder, 0)).toBeUndefined();
    expect(hintReached(ladder, 5)).toBe(ladder[1]);
    expect(hintReached(ladder, 9)).toBe(ladder[2]);
  });

  it("states the ladder's size and cost, counting the final step apart", () => {
    expect(ladderSummary(ladder)).toBe(
      "2 hints, then a final step that shows the known matching solution. Each hint gives away more than the one before it. Hints never block completion, but a completion after the final step does not advance skills.",
    );
    const real: Hint[] = [
      { stage: 1, text: "Skill." },
      { stage: 9, text: "Source.", reveal: upstreamSource },
    ];
    expect(ladderSummary(real)).toMatch(
      /^1 hint, then a final step that shows the known upstream source\./,
    );
    expect(ladderSummary(ladder.slice(0, 2))).toBe(
      "2 hints. Each hint gives away more than the one before it. Hints never block completion.",
    );
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
