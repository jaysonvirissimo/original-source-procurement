import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCT =
  "struct Gauge\n{\n    int id;\n    unsigned short reading;\n};\n\n";

export const unsignedHalf: MissionDraft = {
  schemaVersion: 1,
  id: "019",
  title: "UNSIGNED HALF",
  phase: "Memory widths",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.INTEGER.WIDTH"],
  teaches: ["MIPS.LOAD.HALF"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("unsigned_half.c"),
  briefing: {
    objective:
      "Read the 16-bit field rather than the 32-bit one. The starting source reads the wrong field, so both the width and the offset are wrong.",
    newTechnique:
      "A halfword has its own pair of loads, just as a byte does. One sign-extends the two bytes it reads and the other fills the top with zeros, and the field's declared type picks between them.",
  },
  terms: [
    "glossary.lh",
    "glossary.halfword",
    "glossary.short",
    "glossary.sign-extension",
    "glossary.offset",
  ],
  starterSource: `${STRUCT}int gauge_reading(struct Gauge *g)\n{\n    return g->id;\n}\n`,
  solution: `${STRUCT}int gauge_reading(struct Gauge *g)\n{\n    return g->reading;\n}\n`,
  symbol: "gauge_reading",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "This load reads 2 bytes and fills the top 16 bits with zeros, because reading is unsigned. A plain short field would sign-extend instead.",
      manualEntry: "c.integer-widths",
    },
  ],
  example: {
    caption:
      "g holds 0x2000. id takes the first 4 bytes, so reading starts at +4 and takes 2. Read as unsigned it is 65534; the same 2 bytes read as a signed short would be -2. Values are illustrative.",
    skill: "MIPS.LOAD.HALF",
    registers: [{ register: "$a0", value: 0x2000, note: "g" }],
    regions: [
      {
        label: "struct Gauge",
        address: 0x2000,
        cells: [
          { offset: 0, size: 4, label: "id", value: 9 },
          { offset: 4, size: 2, label: "reading", value: 0xfffe },
        ],
      },
    ],
  },
  walkthroughs: [
    {
      kind: "bits",
      caption:
        "The same two bytes, widened two ways. An unsigned halfword fills the new bits with zeros, so 0xFFFE becomes 65534. A signed one copies the top bit instead and it becomes -2. Values are illustrative.",
      skill: "MIPS.LOAD.HALF",
      rows: [
        { label: "reading = 0xFFFE", width: 16, value: 0xfffe },
        {
          label: "zero-extended = 65534",
          width: 32,
          value: 0x0000fffe,
          derive: { op: "zero-extend", from: 0 },
        },
        {
          label: "sign-extended = -2",
          width: 32,
          value: 0xfffffffe,
          derive: { op: "sign-extend", from: 0 },
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target reads one field of the struct. Your starting source reads a different one, so both the instruction and its offset differ.",
    },
    {
      stage: 2,
      text: "The highlighted row reads 2 bytes, not 4. Its offset is past the first field, which is an int and takes 4 bytes.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "Of the two halfword loads, this is the one that fills the top of the register with zeros rather than copying the sign bit. Read the field's declared type to see why.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 4,
      text: "The body is one return of the struct's second field, reached through the pointer. Nothing is shifted or masked.",
    },
    {
      stage: 9,
      text: "Return the 16-bit field instead of the 32-bit one.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 1),
};
