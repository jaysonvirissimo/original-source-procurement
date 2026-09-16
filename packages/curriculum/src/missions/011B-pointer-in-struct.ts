import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCTS =
  "struct Pos\n{\n    int x;\n    int y;\n};\n\nstruct Unit\n{\n    int id;\n    struct Pos *pos;\n};\n\n";

export const pointerInStruct: MissionDraft = {
  schemaVersion: 1,
  id: "011B",
  title: "POINTER IN A STRUCT",
  phase: "Memory",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.STRUCT.FIELD"],
  teaches: ["C.STRUCT.NESTED"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("pointer_in_struct.c"),
  briefing: {
    objective:
      "Follow the pointer stored in a struct's field, and read a field of the struct it points to.",
    newTechnique:
      "u->pos->y reads the pointer pos from u, then reads y from the struct at that address.",
  },
  terms: [
    "glossary.pointer",
    "glossary.struct",
    "glossary.embedded-struct",
    "glossary.lw",
    "glossary.nop",
  ],
  starterSource: `${STRUCTS}int pointer_in_struct(struct Unit *u)\n{\n    return u->id;\n}\n`,
  solution: `${STRUCTS}int pointer_in_struct(struct Unit *u)\n{\n    return u->pos->y;\n}\n`,
  symbol: "pointer_in_struct",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "A load delay nop: the next instruction uses $v0 as its base, and a loaded value is not ready one instruction later.",
      manualEntry: "mips.assembler-nops",
    },
  ],
  example: {
    caption:
      "u holds 0x3000. The struct Unit there does not contain a struct Pos. Its pos field holds another address, 0x5000, where a separate struct Pos starts. Its x is at +0 and y at +4. Values are illustrative.",
    skill: "C.STRUCT.NESTED",
    registers: [{ register: "$a0", value: 0x3000, note: "u" }],
    regions: [
      {
        label: "struct Unit",
        address: 0x3000,
        cells: [
          { offset: 0, size: 4, label: "id", value: 9 },
          {
            offset: 4,
            size: 4,
            label: "pos",
            value: 0x5000,
            pointsTo: "struct Pos",
          },
        ],
      },
      {
        label: "struct Pos",
        address: 0x5000,
        cells: [
          { offset: 0, size: 4, label: "x", value: 12 },
          { offset: 4, size: 4, label: "y", value: 34 },
        ],
      },
    ],
  },
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "The chain written in two steps. A local pointer p takes the address in u->pos, and p->y reads y there. Both spellings compile to the same words. Values are illustrative.",
      skill: "C.STRUCT.NESTED",
      code: "struct Pos *p = u->pos;\nreturn p->y;\n/* the same as return u->pos->y; */",
      rows: [
        { name: "$a0", before: 0x3000, note: "u" },
        {
          name: "pos",
          before: 0x5000,
          after: 0x5000,
          note: "an address stored in struct Unit, copied into p",
        },
        { name: "y", before: 34, after: 34, note: "p->y, at 0x5000 + 4" },
        { name: "$v0", after: 34, note: "the return value" },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target loads a pointer stored in the struct, then reads through it.",
    },
    {
      stage: 2,
      text: "lw $v0,0x4($a0) loads pos, the field at offset 4. pos holds an address, not a struct.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "lw $v0,0x4($v0) reads offset 4 of the struct Pos at that address, which is y. The nop between the loads waits for the first one.",
      highlight: { start: 2, end: 3 },
    },
    {
      stage: 4,
      text: "u->pos is the pointer. Apply -> to it again to reach a field of the struct it points to.",
    },
    {
      stage: 9,
      text: "Return y, reached through pos.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(5, 2),
};
