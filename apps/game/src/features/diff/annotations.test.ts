import { inlineTarget, realMission } from "@osp/mission-schema/testing";
import { describe, expect, it } from "vitest";
import { annotationLabels, missionAnnotations } from "./annotations";

// OSP-authored words: jr $ra; addiu $v0,$a0,5 with its recorded provenance.
const target = {
  ...inlineTarget(),
  words: [0x03e00008, 0x24820005],
  provenance: [
    { kind: "macro", macro: "j" },
    { kind: "macro", macro: "addu" },
  ],
};

describe("missionAnnotations", () => {
  it("notes observed delay slots and authored notes in word order", () => {
    const annotations = missionAnnotations({
      scaffold: "guided",
      target,
      annotations: [
        {
          range: { start: 0, end: 2 },
          text: "The whole function.",
          manualEntry: "abi.return-values",
        },
        { range: { start: 1, end: 2 }, text: "The result." },
      ],
    });

    expect(annotations).toEqual([
      {
        range: { start: 0, end: 2 },
        label: "note",
        text: "The whole function.",
        manualEntry: "abi.return-values",
      },
      {
        range: { start: 1, end: 2 },
        label: "delay slot",
        text: expect.stringContaining("delay slot") as string,
        manualEntry: "mips.delay-slots",
      },
      { range: { start: 1, end: 2 }, label: "note", text: "The result." },
    ]);
    expect(annotationLabels(annotations, 1)).toEqual([
      "note",
      "delay slot",
      "note",
    ]);
    expect(annotationLabels(annotations, 2)).toEqual([]);
    expect(annotationLabels(annotations, undefined)).toEqual([]);
  });

  it("labels assembler-inserted nops from provenance", () => {
    const annotations = missionAnnotations({
      scaffold: "assisted",
      target: {
        ...target,
        words: [0x8c830020, 0, 0x03e00008, 0],
        provenance: [
          { kind: "instruction" },
          { kind: "load-delay-nop" },
          { kind: "macro", macro: "j" },
          { kind: "branch-delay-nop" },
        ],
      },
    });

    expect(annotations.map(({ label }) => label)).toEqual([
      "load delay nop",
      "branch delay nop",
    ]);
    expect(annotations.map(({ manualEntry }) => manualEntry)).toEqual([
      "mips.assembler-nops",
      "mips.assembler-nops",
    ]);
  });

  it("shows nothing once the scaffold stops teaching automatically", () => {
    expect(
      missionAnnotations({
        scaffold: "independent",
        target,
        annotations: [{ range: { start: 0, end: 1 }, text: "Hidden." }],
      }),
    ).toEqual([]);
  });

  it("shows nothing for a remote target", () => {
    expect(
      missionAnnotations({ scaffold: "guided", target: realMission().target }),
    ).toEqual([]);
  });
});
