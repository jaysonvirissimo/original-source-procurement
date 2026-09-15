import { inlineTarget, realMission } from "@osp/mission-schema/testing";
import { describe, expect, it } from "vitest";
import type { ScaffoldLevel, ScaffoldPlan } from "../progress/scaffold";
import {
  annotationLabels,
  manualLinks,
  missionAnnotations,
  shownAnnotations,
  type WordAnnotation,
} from "./annotations";

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
      target,
      annotations: [
        {
          range: { start: 0, end: 2 },
          text: "The whole function.",
          manualEntry: "abi.return-values",
          skill: "ABI.RETURN",
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
        skill: "ABI.RETURN",
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
    expect(manualLinks(annotations)).toEqual(["mips.assembler-nops"]);
  });

  it("shows nothing for a remote target", () => {
    expect(missionAnnotations({ target: realMission().target })).toEqual([]);
  });
});

describe("shownAnnotations", () => {
  const observed: WordAnnotation = {
    range: { start: 1, end: 2 },
    label: "delay slot",
    text: "Runs first.",
  };
  const pointer: WordAnnotation = {
    range: { start: 0, end: 1 },
    label: "note",
    text: "p holds an address.",
    skill: "C.POINTER.DEREFERENCE",
  };

  function plan(
    layout: ScaffoldLevel,
    skills: Record<string, ScaffoldLevel> = {},
    automaticTeaching = true,
  ): ScaffoldPlan {
    return {
      layout,
      skills: new Map(Object.entries(skills)),
      automaticTeaching,
    };
  }

  function shown(scaffold: ScaffoldPlan) {
    return shownAnnotations([pointer, observed], scaffold).map(
      ({ label, explained }) => [label, explained],
    );
  }

  it.each<[string, ScaffoldPlan, (string | boolean)[][]]>([
    [
      "guided help labels and explains every note",
      plan("guided"),
      [
        ["note", true],
        ["delay slot", true],
      ],
    ],
    [
      "assisted help keeps labels and leaves explanations to Scan",
      plan("assisted"),
      [
        ["note", false],
        ["delay slot", false],
      ],
    ],
    ["independent help shows no notes", plan("independent"), []],
    ["field help shows no notes", plan("field"), []],
    [
      "a skill's own level decides its notes",
      plan("guided", { "C.POINTER.DEREFERENCE": "independent" }),
      [["delay slot", true]],
    ],
    [
      "a newly taught skill keeps guided notes while the layout is guided",
      plan("guided", { "C.POINTER.DEREFERENCE": "guided" }),
      [
        ["note", true],
        ["delay slot", true],
      ],
    ],
    [
      "a skill the mission does not list follows the layout",
      plan("assisted", { "ABI.RETURN": "guided" }),
      [
        ["note", false],
        ["delay slot", false],
      ],
    ],
    [
      "the minimal setting shows no notes at all",
      plan("guided", { "C.POINTER.DEREFERENCE": "guided" }, false),
      [],
    ],
  ])("%s", (_name, scaffold, expected) => {
    expect(shown(scaffold)).toEqual(expected);
  });
});

describe("manualLinks", () => {
  it("lists each linked entry once, in order", () => {
    expect(
      manualLinks([
        { range: { start: 0, end: 1 }, label: "a", text: "A." },
        {
          range: { start: 0, end: 1 },
          label: "b",
          text: "B.",
          manualEntry: "mips.assembler-nops",
        },
        {
          range: { start: 1, end: 2 },
          label: "c",
          text: "C.",
          manualEntry: "abi.return-values",
        },
        {
          range: { start: 2, end: 3 },
          label: "d",
          text: "D.",
          manualEntry: "mips.assembler-nops",
        },
      ]),
    ).toEqual(["mips.assembler-nops", "abi.return-values"]);
  });
});
