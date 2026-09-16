import type { Mission } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import { manualEntries } from "./manual.ts";
import { missionDrafts } from "./missions/drafts.ts";
import { defaultPath, missions, withTarget } from "./missions.ts";
import { skills } from "./skills.ts";

function mission(id: string): Mission {
  const found = missions.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`The curriculum has no mission ${id}.`);
  }
  return found;
}

describe("missions", () => {
  it("attaches a generated inline target to every draft, in order", () => {
    expect(missions.map((entry) => entry.id)).toEqual(
      missionDrafts.map((draft) => draft.id),
    );
    expect(missions.every((entry) => entry.target.kind === "inline")).toBe(
      true,
    );
  });

  it("names the command that generates a missing target", () => {
    const [draft] = missionDrafts;
    if (draft === undefined) {
      throw new Error("The curriculum has no mission drafts.");
    }

    expect(() => withTarget(draft, {})).toThrow("pnpm curriculum:targets");
  });
});

describe("the first teaching slice", () => {
  it("plays 001 through 012 in order, then the first field mission", () => {
    expect(defaultPath).toEqual([
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
      "F01",
    ]);
  });

  it("teaches nothing new in its synthesis missions", () => {
    for (const id of ["005", "012"]) {
      expect(mission(id).kind).toBe("synthesis");
      expect(mission(id).teaches).toEqual([]);
    }
  });

  it("builds the byte-signedness targets from signed char, and starts 011 from plain char", () => {
    for (const id of ["010", "011"]) {
      expect(mission(id).solution).toContain("signed char delta;");
    }
    expect(mission("011").starterSource).toMatch(/^\s+char delta;$/m);
  });

  it("gives every exact mission a ladder from naming the skill to the solution", () => {
    for (const entry of missions.filter(
      (candidate) => candidate.completion === "exact",
    )) {
      expect(
        entry.hints.map((hint) => hint.stage),
        entry.id,
      ).toEqual([1, 2, 3, 4, 9]);
    }
  });

  it("starts every exact mission from source that differs from its solution", () => {
    for (const entry of missions.filter(
      (candidate) => candidate.completion === "exact",
    )) {
      expect(entry.starterSource, entry.id).not.toBe(entry.solution);
    }
  });

  it("writes a body for every manual entry a skill links to", () => {
    const entries = new Map(manualEntries.map((entry) => [entry.id, entry]));
    for (const skill of skills) {
      expect(
        entries.get(skill.manualEntry)?.body.length,
        skill.id,
      ).toBeGreaterThan(0);
    }
  });
});
