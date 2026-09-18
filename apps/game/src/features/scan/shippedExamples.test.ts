import { missions } from "@osp/curriculum";
import { wordFacts } from "@osp/matching-core";
import type {
  Mission,
  MissionExample,
  MissionWalkthrough,
  WalkthroughStep,
} from "@osp/mission-schema";
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
      "011A",
      "011B",
      "012",
      "012A",
      "012B",
      "012D",
      "013",
      "019",
      "020",
      "021",
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

const withWalkthroughs = missions.flatMap((mission) =>
  mission.walkthroughs === undefined || mission.target.kind !== "inline"
    ? []
    : mission.walkthroughs.map(
        (walkthrough, index) =>
          [
            `${mission.id} #${String(index)} ${walkthrough.kind}`,
            mission,
            walkthrough,
          ] as const,
      ),
);

describe("shipped walkthroughs", () => {
  it("cover the missions revised for beginners", () => {
    expect([
      ...new Set(withWalkthroughs.map(([, mission]) => mission.id)),
    ]).toEqual([
      "001",
      "002",
      "004",
      "005",
      "006",
      "007",
      "008",
      "010",
      "011B",
      "012",
      "012A",
      "012C",
      "012D",
      "013",
      "014",
      "015",
      "016",
      "017",
      "019",
      "022",
      "025",
      "026",
      "027",
      "028",
      "029",
      "031",
      "032",
      "033",
      "036",
      "037",
      "038",
      "039",
      "040",
      "042",
      "043",
      "044",
      "045",
      "046",
      "047",
    ]);
  });

  it.each(withWalkthroughs)(
    "%s agrees with the generated target and the mission's example",
    (_name, mission: Mission, walkthrough: MissionWalkthrough) => {
      const words =
        mission.target.kind === "inline" ? mission.target.words : [];
      const facts = wordFacts(
        words,
        mission.target.kind === "inline" ? mission.target.relocations : [],
      );
      const inTarget = ({ range }: WalkthroughStep) =>
        range === undefined || range.end <= words.length;
      switch (walkthrough.kind) {
        case "trace":
          expect(walkthrough.steps.every(inTarget)).toBe(true);
          return;
        case "timeline":
          expect(
            walkthrough.lanes.every(({ steps }) => steps.every(inTarget)),
          ).toBe(true);
          return;
        case "bits":
          return;
        case "operands": {
          // A word has a reading when it accesses memory, branches, jumps or
          // calls; those are the forms the operand table knows how to label.
          const word = facts[walkthrough.word];
          expect(
            word?.memory ?? word?.branch ?? word?.jump ?? word?.call,
          ).toBeDefined();
          return;
        }
        case "caller": {
          const example = mission.example;
          for (const row of walkthrough.rows) {
            const register = example?.registers.find(
              (entry) => entry.register === row.name,
            );
            if (register !== undefined) {
              expect(row.before, row.name).toBe(register.value);
            }
            const cell = example?.regions
              .flatMap(({ cells }) => cells)
              .find(({ label }) => label === row.name);
            if (cell !== undefined) {
              expect(row.before, row.name).toBe(cell.value);
            }
          }
          return;
        }
      }
    },
  );

  it("reads a load in 006 and a store in 008", () => {
    const kindAt = (id: string) => {
      const mission = missions.find((entry) => entry.id === id);
      const operands = mission?.walkthroughs?.find(
        (walkthrough) => walkthrough.kind === "operands",
      );
      const words =
        mission?.target.kind === "inline" ? mission.target.words : [];
      return operands?.kind === "operands"
        ? wordFacts(words)[operands.word]?.memory?.kind
        : undefined;
    };
    expect(kindAt("006")).toBe("load");
    expect(kindAt("008")).toBe("store");
  });

  it("covers 012's load delay nop in its timeline", () => {
    const mission = missions.find((entry) => entry.id === "012");
    const nop =
      mission?.target.kind === "inline"
        ? mission.target.provenance.findIndex(
            (origin) => origin.kind === "load-delay-nop",
          )
        : -1;
    const timeline = mission?.walkthroughs?.find(
      (walkthrough) => walkthrough.kind === "timeline",
    );
    const covered =
      timeline?.kind === "timeline" &&
      timeline.lanes.some(({ steps }) =>
        steps.some(
          ({ range }) =>
            range !== undefined && range.start <= nop && nop < range.end,
        ),
      );
    expect(nop).toBeGreaterThan(0);
    expect(covered).toBe(true);
  });
});
