import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCT =
  "struct Rec\n{\n    int id;\n    signed char delta;\n    unsigned char count;\n};\n\n";

export const signedByte: MissionDraft = {
  schemaVersion: 1,
  id: "010",
  title: "SIGNED BYTE",
  phase: "Memory",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.STRUCT.FIELD"],
  teaches: ["MIPS.LOAD.BYTE"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("signed_byte.c"),
  briefing: {
    objective:
      "Read a signed 8-bit field, and see how its load differs from an unsigned one.",
    newTechnique: "lb sign-extends an 8-bit load; lbu zero-extends it.",
  },
  terms: [
    "glossary.lb",
    "glossary.byte",
    "glossary.bit",
    "glossary.twos-complement",
    "glossary.sign-extension",
    "glossary.psyq",
  ],
  starterSource: `${STRUCT}int signed_byte(struct Rec *r)\n{\n    return r->id;\n}\n`,
  solution: `${STRUCT}int signed_byte(struct Rec *r)\n{\n    return r->delta;\n}\n`,
  symbol: "signed_byte",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "Reading count instead would load offset 5 with lbu, because count is unsigned char. A plain char field also loads with lbu.",
      manualEntry: "c.integer-types",
      skill: "MIPS.LOAD.BYTE",
    },
  ],
  example: {
    caption:
      "Here char is a 1-byte integer, not a string. delta's byte is 0xFD. Read as signed, that is -3, and lb sign-extends it to a 32-bit -3. Read as unsigned, the same byte is 253, which is how lbu would load it.",
    skill: "MIPS.LOAD.BYTE",
    registers: [{ register: "$a0", value: 0x2000, note: "r" }],
    regions: [
      {
        label: "struct Rec",
        address: 0x2000,
        cells: [
          { offset: 0, size: 4, label: "id", value: 5 },
          { offset: 4, size: 1, label: "delta", value: -3 },
          { offset: 5, size: 1, label: "count", value: 200 },
        ],
      },
    ],
  },
  walkthroughs: [
    {
      kind: "bits",
      caption:
        "delta's byte, 0xFD, bit by bit. Read as signed, in two's complement, its top bit counts as -128, so it is -128 + 125 = -3. Read as unsigned, it is 253. Returning it as an int widens it to 32 bits: lb copies the top bit into the 24 new bits, and lbu fills them with zeros.",
      skill: "MIPS.LOAD.BYTE",
      rows: [
        {
          label: "delta: -3 signed, 253 unsigned",
          width: 8,
          value: 0xfd,
        },
        {
          label: "lb, sign-extended: -3",
          width: 32,
          value: 0xffff_fffd,
          derive: { op: "sign-extend", from: 0 },
        },
        {
          label: "lbu, zero-extended: 253",
          width: 32,
          value: 0xfd,
          derive: { op: "zero-extend", from: 0 },
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target reads one byte field of the struct that r points to.",
    },
    {
      stage: 2,
      text: "lb $v0,0x4($a0) loads 8 bits at offset 4 and sign-extends them to 32 bits.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "id takes offsets 0 to 3, so delta is at offset 4 and count at offset 5.",
    },
    {
      stage: 4,
      text: "A signed byte loads with lb and an unsigned byte with lbu. Read the field whose type and offset both match.",
    },
    {
      stage: 9,
      text: "Return the field delta.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 1),
};
