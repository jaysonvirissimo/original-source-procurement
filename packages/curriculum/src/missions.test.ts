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
      "012": [],
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
    ["012", ["pointer", "struct", "temporary", "nop"]],
  ])("links glossary entries for the terms %s introduces", (id, expected) => {
    const glossary = new Map(
      manualEntries
        .filter((entry) => entry.section === "GLOSSARY")
        .map((entry) => [entry.id, entry.title]),
    );
    const titles = (mission(id).terms ?? []).map((term) => glossary.get(term));
    expect(titles).toEqual(expect.arrayContaining(expected));
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
