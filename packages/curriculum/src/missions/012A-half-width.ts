import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCT = "struct Cell\n{\n    int id;\n    short height;\n};\n\n";

export const halfWidth: MissionDraft = {
  schemaVersion: 1,
  id: "012A",
  title: "HALF WIDTH",
  phase: "Types and layout",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.LOAD.BYTE"],
  teaches: ["C.INTEGER.WIDTH"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("half_width.c"),
  briefing: {
    objective: "Read a 16-bit short field.",
    newTechnique:
      "On this target, char is 8 bits, short is 16, and int is 32. The load instruction shows the width.",
  },
  terms: [
    "glossary.short",
    "glossary.lh",
    "glossary.byte",
    "glossary.sign-extension",
  ],
  starterSource: `${STRUCT}int half_width(struct Cell *c)\n{\n    return c->id;\n}\n`,
  solution: `${STRUCT}int half_width(struct Cell *c)\n{\n    return c->height;\n}\n`,
  symbol: "half_width",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "lh is the 16-bit load: it reads 2 bytes and sign-extends them, as lb does for 1 byte. An unsigned short field would load with lhu.",
      manualEntry: "c.integer-widths",
      skill: "C.INTEGER.WIDTH",
    },
  ],
  example: {
    caption:
      "c holds 0x2000. id takes 4 bytes, so height starts at +4 and takes 2 bytes. Its bytes hold 0xFFFE, which is -2 as a short. Values are illustrative.",
    skill: "C.INTEGER.WIDTH",
    registers: [{ register: "$a0", value: 0x2000, note: "c" }],
    regions: [
      {
        label: "struct Cell",
        address: 0x2000,
        cells: [
          { offset: 0, size: 4, label: "id", value: 5 },
          { offset: 4, size: 2, label: "height", value: -2 },
        ],
      },
    ],
  },
  walkthroughs: [
    {
      kind: "bits",
      caption:
        "height's 16 bits hold 0xFFFE, which is -2 as a short. Returning it as an int widens it to 32 bits. lh copies the top bit into the 16 new bits, so -2 stays -2.",
      skill: "C.INTEGER.WIDTH",
      rows: [
        { label: "height: -2 as short", width: 16, value: 0xfffe },
        {
          label: "lh, sign-extended: -2",
          width: 32,
          value: 0xffff_fffe,
          derive: { op: "sign-extend", from: 0 },
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target reads one field that is narrower than an int.",
    },
    {
      stage: 2,
      text: "lh $v0,0x4($a0) loads 16 bits at offset 4 and sign-extends them.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "A short takes 2 bytes. After the 4 bytes of id, height starts at offset 4.",
    },
    {
      stage: 4,
      text: "Match the width: lw reads an int, lh a short, and lb a signed char.",
    },
    {
      stage: 9,
      text: "Return the field height.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 1),
};
