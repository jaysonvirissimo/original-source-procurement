import type { Mission } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import { manualEntries } from "./manual.ts";
import { missionDrafts } from "./missions/drafts.ts";
import { defaultPath, missions, withTarget } from "./missions.ts";
import { pointerCorpus } from "./real/corpus.ts";
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
  it("plays 001 through 012 with the bridges in order, then the first field mission", () => {
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
      "011A",
      "011B",
      "012",
      "012A",
      "012B",
      "012C",
      "012D",
      "013",
      "014",
      "015",
      "016",
      "017",
      "018",
      "019",
      "020",
      "021",
      "022",
      "023",
      "024",
      "F01",
      "F02",
      "F03",
    ]);
  });

  it("teaches what 012 and the first field mission need before they are played", () => {
    expect(mission("012").practices).toEqual(
      expect.arrayContaining(["C.ARRAY", "C.STRUCT.NESTED"]),
    );
    const f01 = pointerCorpus.missions.find((entry) => entry.id === "F01");
    expect(f01?.requires).toEqual(
      expect.arrayContaining([
        "C.INTEGER.WIDTH",
        "C.STRUCT.LAYOUT",
        "C.POINTER.ARITHMETIC",
        "C.TYPEDEF",
      ]),
    );
  });

  it("names the types the padding bridge and the first field mission lay out", () => {
    expect(mission("012B").contextTypes).toEqual([
      "struct Mixed",
      "struct Pair16",
    ]);
    const f01 = pointerCorpus.missions.find((entry) => entry.id === "F01");
    expect(f01?.contextTypes).toEqual(["KCB", "RECT"]);
  });

  it("lists the delay-slot glossary entry under the first field mission, whose last store runs in a delay slot", () => {
    const f01 = pointerCorpus.missions.find((entry) => entry.id === "F01");
    expect(f01?.terms).toEqual(["glossary.delay-slot"]);
  });

  it("supplies the type names mission's header as authored compiler input", () => {
    const typeNames = mission("012D");
    expect(Object.keys(typeNames.compiler.headers)).toEqual(["bridge_types.h"]);
    expect(typeNames.starterSource).toContain('#include "bridge_types.h"');
  });

  it("teaches nothing new in its synthesis missions", () => {
    for (const id of ["005", "012", "013", "018", "024"]) {
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

  it("links a glossary entry for every term the first mission's text uses", () => {
    const first = missions.find((entry) => entry.id === defaultPath[0]);
    const glossary = new Map(
      manualEntries
        .filter((entry) => entry.section === "GLOSSARY")
        .map((entry) => [entry.id, entry.title]),
    );
    const titles = (first?.terms ?? []).map((term) => glossary.get(term));
    expect(titles).toEqual(
      expect.arrayContaining([
        "register",
        "$v0",
        "$ra",
        "jr",
        "addiu",
        "hexadecimal (0x)",
        "word",
        "delay slot",
      ]),
    );
  });

  it("keeps what each revised mission teaches", () => {
    expect(
      Object.fromEntries(
        missions
          .filter((entry) => entry.source.kind === "synthetic")
          .map((entry) => [entry.id, entry.teaches]),
      ),
    ).toEqual({
      "001": ["ABI.RETURN"],
      "002": ["ABI.ARGUMENT"],
      "003": ["MIPS.ARITH.ADD_IMMEDIATE"],
      "004": ["MIPS.ARITH.SHIFT"],
      "005": [],
      "006": ["MIPS.LOAD.WORD"],
      "007": ["C.POINTER.DEREFERENCE"],
      "008": ["MIPS.STORE.WORD"],
      "009": ["C.STRUCT.FIELD"],
      "010": ["MIPS.LOAD.BYTE"],
      "011": ["MATCH.SIGNEDNESS"],
      "011A": ["C.ARRAY"],
      "011B": ["C.STRUCT.NESTED"],
      "012": [],
      "012A": ["C.INTEGER.WIDTH"],
      "012B": ["C.STRUCT.LAYOUT"],
      "012C": ["C.POINTER.ARITHMETIC"],
      "012D": ["C.TYPEDEF"],
      "013": [],
      "014": ["MIPS.ARITH.ADD"],
      "015": ["MIPS.ARITH.SUBTRACT"],
      "016": ["MIPS.REGISTER.TEMP"],
      "017": ["C.BITMASK"],
      "018": [],
      "019": ["MIPS.LOAD.HALF"],
      "020": ["MIPS.LOAD.SIGNEDNESS"],
      "021": ["MIPS.STORE.NARROW"],
      "022": ["C.SHIFT"],
      "023": ["C.STORAGE.STATIC"],
      "024": [],
    });
  });

  it.each([
    ["002", ["register", "$a0 to $a3", "$v0", "move"]],
    ["003", ["immediate", "addiu", "bit", "sign extension"]],
    ["004", ["sll", "bit"]],
    ["005", ["temporary", "addiu", "sll"]],
    [
      "006",
      [
        "lw",
        "address",
        "offset",
        "byte",
        "word",
        "nop",
        "assembler",
        "compiler",
      ],
    ],
    ["007", ["pointer", "address"]],
    ["008", ["sw", "pointer", "void"]],
    ["009", ["struct", "offset"]],
    ["010", ["lb and lbu", "two's complement", "sign extension", "PsyQ"]],
    ["011", ["lb and lbu", "PsyQ"]],
    ["011A", ["array", "element", "offset"]],
    ["011B", ["pointer", "embedded struct", "nop"]],
    ["012", ["pointer", "struct", "temporary", "nop"]],
    ["012A", ["short", "lh and lhu", "sign extension"]],
    ["012B", ["padding", "alignment", "embedded struct"]],
    ["012C", ["pointer", "element"]],
    ["012D", ["typedef", "header file", "void *", "void"]],
  ])("links glossary entries for the terms %s introduces", (id, expected) => {
    const glossary = new Map(
      manualEntries
        .filter((entry) => entry.section === "GLOSSARY")
        .map((entry) => [entry.id, entry.title]),
    );
    const titles = (mission(id).terms ?? []).map((term) => glossary.get(term));
    expect(titles).toEqual(expect.arrayContaining(expected));
  });

  it("points from pointer arithmetic to register reuse and storing addresses", () => {
    const entry = (id: string) =>
      manualEntries.find((candidate) => candidate.id === id);
    const reuse = entry("matching.register-reuse");
    const storing = entry("c.storing-addresses");
    expect(reuse?.section).toBe("MATCHING");
    expect(storing?.section).toBe("C");
    const pointerArithmetic = entry("c.pointer-arithmetic")?.body.join(" ");
    expect(pointerArithmetic).toContain(
      `${String(reuse?.title)}, under MATCHING`,
    );
    expect(pointerArithmetic).toContain(`${String(storing?.title)}, under C`);
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
