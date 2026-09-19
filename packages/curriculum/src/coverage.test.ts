import { describe, expect, it } from "vitest";
import { curriculumCoverage } from "./coverage.ts";
import { defaultPath, missions } from "./index.ts";

type Entry = Parameters<typeof curriculumCoverage>[0][number];

function mission(id: string, fields: Partial<Entry> = {}): Entry {
  return {
    id,
    phase: "One",
    kind: "training",
    teaches: [],
    practices: [],
    requires: [],
    ...fields,
  };
}

const codes = (entries: readonly Entry[]) =>
  curriculumCoverage(
    entries,
    entries.map((entry) => entry.id),
  ).map((warning) => warning.code);

describe("curriculumCoverage", () => {
  it("finds nothing in a path that practises, checks, and trains before the field", () => {
    expect(
      codes([
        mission("a", { teaches: ["S.A"] }),
        mission("b", { teaches: ["S.B"], practices: ["S.A"] }),
        mission("c", { kind: "synthesis", practices: ["S.B"] }),
        mission("d", { phase: "Two", kind: "synthesis" }),
        mission("e", { kind: "real-solved", requires: ["S.A"] }),
        mission("f", { phase: "Field", kind: "real-solved" }),
      ]),
    ).toEqual([]);
  });

  it("reports a skill that no later mission practices", () => {
    const warnings = curriculumCoverage(
      [
        mission("a", { teaches: ["S.A"] }),
        mission("b", { kind: "synthesis", practices: ["S.A"], teaches: [] }),
        mission("c", { teaches: ["S.C"] }),
        mission("d", { requires: ["S.C"] }),
      ],
      ["a", "b", "c", "d"],
    );
    expect(warnings).toContainEqual({
      code: "no-later-practice",
      path: "defaultPath[2]",
      message:
        "S.C is taught by c and no later mission on the default path practises it.",
    });
    expect(
      warnings.filter((warning) => warning.code === "no-later-practice"),
    ).toHaveLength(1);
  });

  it("does not count a later mission that only requires the skill", () => {
    // Requiring a skill says nothing about whether the listing shows it.
    expect(
      codes([
        mission("a", { teaches: ["S.A"] }),
        mission("b", { kind: "synthesis", requires: ["S.A"] }),
        mission("c", { kind: "real-solved", requires: ["S.A"] }),
      ]),
    ).toEqual(["no-later-practice"]);
  });

  it("reports a phase with no synthesis or real mission", () => {
    const warnings = curriculumCoverage(
      [
        mission("a", { kind: "synthesis" }),
        mission("b", { phase: "Two" }),
        mission("c", { phase: "Three", kind: "real-solved" }),
      ],
      ["a", "b", "c"],
    );
    expect(warnings).toContainEqual({
      code: "phase-without-synthesis",
      path: "defaultPath[1]",
      message:
        'The phase "Two" has no synthesis or real mission on the default path.',
    });
  });

  it("reports a synthetic mission after the first real one", () => {
    const issues = curriculumCoverage(
      [
        mission("a", { kind: "synthesis" }),
        mission("f", { phase: "Field", kind: "real-solved" }),
        mission("b", { phase: "Two", kind: "synthesis" }),
      ],
      ["a", "f", "b"],
    );
    expect(issues).toEqual([
      {
        code: "training-prefix",
        path: "defaultPath[2]",
        message: "b is a synthetic mission after the first real one, f.",
      },
    ]);
  });

  it("reports a real mission before its own phase's qualification", () => {
    const issues = curriculumCoverage(
      [
        mission("a", { phase: "Branches" }),
        mission("f", { phase: "Branches", kind: "real-solved" }),
        mission("q", { phase: "Branches", kind: "synthesis" }),
      ],
      ["a", "f", "q"],
    );
    expect(issues).toContainEqual({
      code: "real-before-its-check",
      path: "defaultPath[1]",
      message:
        'f is in the phase "Branches" but comes before its qualification, q.',
    });
  });

  it("sets no order for a real mission in a phase with no qualification", () => {
    expect(
      codes([
        mission("a", { kind: "synthesis" }),
        mission("f", { phase: "Field", kind: "real-solved" }),
      ]),
    ).toEqual([]);
  });

  it("ignores path entries that name no mission and finds nothing in an empty path", () => {
    expect(curriculumCoverage([], ["missing"])).toEqual([]);
  });

  it("finds nothing wrong with the shipped curriculum", () => {
    expect(
      curriculumCoverage(missions, defaultPath).map(
        ({ code, message }) => `${code}: ${message}`,
      ),
    ).toEqual([]);
  });
});
