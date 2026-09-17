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
  it("finds nothing in a path that practices, checks, and reaches the field early", () => {
    expect(
      codes([
        mission("a", { teaches: ["S.A"] }),
        mission("b", { teaches: ["S.B"], practices: ["S.A"] }),
        mission("c", { kind: "synthesis", practices: ["S.B"] }),
        mission("f", {
          phase: "Field",
          kind: "real-solved",
          requires: ["S.A"],
        }),
        mission("d", { phase: "Two", kind: "synthesis" }),
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
        "S.C is taught by c and never practiced later on the default path.",
    });
    expect(
      warnings.filter((warning) => warning.code === "no-later-practice"),
    ).toHaveLength(1);
  });

  it("counts a later synthesis or real mission that requires the skill", () => {
    expect(
      codes([
        mission("a", { teaches: ["S.A"] }),
        mission("b", { kind: "synthesis", requires: ["S.A"] }),
      ]),
    ).not.toContain("no-later-practice");
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

  it("reports a path whose only real missions are in the final phase", () => {
    expect(
      codes([
        mission("a", { kind: "synthesis" }),
        mission("f", { phase: "Field", kind: "real-solved" }),
      ]),
    ).toEqual(["no-early-real-mission"]);
  });

  it("ignores path entries that name no mission and finds nothing in an empty path", () => {
    expect(curriculumCoverage([], ["missing"])).toEqual([]);
  });

  it("pins the shipped curriculum's current findings", () => {
    expect(
      curriculumCoverage(missions, defaultPath).map(
        ({ code, message }) => `${code}: ${message}`,
      ),
    ).toEqual([
      "no-later-practice: MATCH.SIGNEDNESS is taught by 011 and never practiced later on the default path.",
      'no-early-real-mission: No real mission appears before the final phase, "Field work".',
    ]);
  });
});
