import { missions } from "@osp/curriculum";
import { wordFacts } from "@osp/matching-core";
import type { Mission, MissionExample } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import { memoryDiagram, registerDiagram } from "./diagrams";

// Examples are authored by hand, so check each against its generated target.
const withExamples = missions.flatMap((mission) =>
  mission.example === undefined || mission.target.kind !== "inline"
    ? []
    : [[mission.id, mission, mission.example] as const],
);

describe("shipped machine diagram examples", () => {
  it("cover the memory missions", () => {
    expect(withExamples.map(([id]) => id)).toEqual([
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
    ]);
  });

  it.each(withExamples)(
    "%s leads every load and store to a cell of the same width, and uses every region",
    (_id, mission: Mission, example: MissionExample) => {
      const facts = wordFacts(
        mission.target.kind === "inline" ? mission.target.words : [],
      );
      const diagram = memoryDiagram(facts, example);

      expect(diagram.unresolved).toEqual([]);
      for (const region of diagram.regions) {
        expect(
          region.rows.some(({ accesses }) => accesses.length > 0),
          region.label,
        ).toBe(true);
        for (const { cell, accesses } of region.rows) {
          for (const { access } of accesses) {
            expect(access.bytes, `${region.label} ${cell.label}`).toBe(
              cell.size,
            );
          }
        }
      }
    },
  );

  it.each(withExamples)(
    "%s gives values only to registers the target reads before writing",
    (_id, mission: Mission, example: MissionExample) => {
      const facts = wordFacts(
        mission.target.kind === "inline" ? mission.target.words : [],
      );
      const given = new Set(example.registers.map(({ register }) => register));
      for (const row of registerDiagram(facts, example)) {
        if (!given.has(row.register)) {
          continue;
        }
        const firstRead = Math.min(...row.readBy);
        const firstWrite = Math.min(...row.writtenBy);
        expect(firstRead, row.register).toBeLessThan(firstWrite);
      }
    },
  );
});
