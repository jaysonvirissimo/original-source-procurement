import { describe, expect, it } from "vitest";
import { shippedCatalog } from "../curriculum/missionCatalog";
import { entryMarks, missingSkillsText, type MissionEntry } from "./mapModel";

const [first] = shippedCatalog.missions;
if (first === undefined) {
  throw new Error("The shipped catalog has missions.");
}
const base: MissionEntry = {
  mission: first,
  status: "new",
  tier: "training",
  missing: [],
  recommended: false,
  revealedOnly: false,
};
const alpha = [{ id: "A", name: "Alpha" }];

describe("entryMarks", () => {
  it.each([
    ["a new mission", {}, []],
    ["a recommended mission", { recommended: true }, ["RECOMMENDED"]],
    ["a started mission", { status: "in-progress" }, ["IN PROGRESS"]],
    [
      "a recommended, started mission with missing skills",
      { recommended: true, status: "in-progress", missing: alpha },
      ["RECOMMENDED", "IN PROGRESS", "SKIPS AHEAD"],
    ],
    [
      "a completed mission, whatever else is true",
      { status: "complete", recommended: true, missing: alpha },
      ["COMPLETE"],
    ],
    [
      "a mission only completed with its solution revealed",
      { status: "complete", revealedOnly: true },
      ["COMPLETE", "SOLUTION REVEALED"],
    ],
  ] as const)("marks %s", (_, overrides, marks) => {
    expect(entryMarks({ ...base, ...overrides })).toEqual(marks);
  });
});

describe("missingSkillsText", () => {
  it("says nothing when no skill is missing, and names each missing skill", () => {
    expect(missingSkillsText([])).toBeUndefined();
    expect(missingSkillsText([...alpha, { id: "B", name: "Beta" }])).toBe(
      "Not yet introduced: Alpha, Beta.",
    );
  });
});
