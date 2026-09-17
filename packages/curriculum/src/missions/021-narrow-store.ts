import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCT = "struct Slot\n{\n    int id;\n    unsigned char tag;\n};\n\n";

export const narrowStore: MissionDraft = {
  schemaVersion: 1,
  id: "021",
  title: "NARROW STORE",
  phase: "Memory widths",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.STORE.WORD", "MIPS.LOAD.HALF"],
  teaches: ["MIPS.STORE.NARROW"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("narrow_store.c"),
  briefing: {
    objective:
      "Write the argument into the 8-bit field rather than the 32-bit one. The starting source writes the wrong field, at the wrong width.",
    newTechnique:
      "Stores come in the same widths as loads, and a narrow one writes only the low bits of its source register. Unlike a load, a store has no signed and unsigned form: the width alone decides the instruction.",
  },
  terms: [
    "glossary.sb",
    "glossary.sw",
    "glossary.byte",
    "glossary.offset",
    "glossary.address",
  ],
  starterSource: `${STRUCT}void slot_tag(struct Slot *s, int v)\n{\n    s->id = v;\n}\n`,
  solution: `${STRUCT}void slot_tag(struct Slot *s, int v)\n{\n    s->tag = v;\n}\n`,
  symbol: "slot_tag",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "This store writes the low 8 bits of the second argument and leaves the rest of that register untouched. Declaring tag signed char instead would not change it: there is no signed store.",
      manualEntry: "mips.loads-and-stores",
    },
  ],
  example: {
    caption:
      "s holds 0x2000, so id fills the first 4 bytes and tag is the single byte at +4. With v as 0x1FF, only the low byte reaches memory and tag becomes 0xFF. Values are illustrative.",
    skill: "MIPS.STORE.NARROW",
    registers: [
      { register: "$a0", value: 0x2000, note: "s" },
      { register: "$a1", value: 0x1ff, note: "v" },
    ],
    regions: [
      {
        label: "struct Slot",
        address: 0x2000,
        cells: [
          { offset: 0, size: 4, label: "id", value: 9 },
          { offset: 4, size: 1, label: "tag", value: 0xff },
        ],
      },
    ],
  },
  hints: [
    {
      stage: 1,
      text: "The target writes one field and returns nothing. Your starting source writes a different field, so both the instruction and its offset differ.",
    },
    {
      stage: 2,
      text: "The highlighted row is the store, and it runs after the return, in the delay slot. It writes 1 byte, not 4, and its offset is past the first field.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "Its first operand is the source, as it is for any store. Only the low 8 bits of that register are written; whatever else it holds is left where it is.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 4,
      text: "The body is one assignment to the struct's byte field through the pointer. The function returns nothing, and no conversion needs writing: assigning an int to a narrower field keeps its low bits by itself.",
    },
    {
      stage: 9,
      text: "Assign the second argument to the byte field instead of the int one.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(2, 1),
};
