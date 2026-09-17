import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const DECLARATIONS =
  "struct Packet\n{\n    unsigned short flags;\n    signed char level;\n};\n\nunsigned char last_code;\n\n";

export const qualification04: MissionDraft = {
  schemaVersion: 1,
  id: "024",
  title: "QUALIFICATION 04",
  phase: "Memory widths",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [],
  teaches: [],
  practices: [
    "MIPS.LOAD.HALF",
    "MIPS.LOAD.SIGNEDNESS",
    "MATCH.SIGNEDNESS",
    "MIPS.STORE.NARROW",
    "C.SHIFT",
    "C.BITMASK",
    "C.STORAGE.STATIC",
    "MIPS.ARITH.ADD",
    "C.STRUCT.FIELD",
    "C.INTEGER.WIDTH",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_04.c"),
  briefing: {
    objective:
      "Pull a small number out of the middle of one field, add a second field to it, keep a copy where the next call can find it, and return it. Every width and every signedness in the listing follows from a declaration above the function. Read all eight rows before you write anything.",
  },
  terms: [
    "glossary.lh",
    "glossary.lb",
    "glossary.sra",
    "glossary.mask",
    "glossary.sb",
    "glossary.global",
    "glossary.lui",
    "glossary.relocation",
  ],
  starterSource: `${DECLARATIONS}int packet_code(struct Packet *p)\n{\n    int c = ((p->flags >> 4) & 0xF) + p->level;\n    return c;\n}\n`,
  solution: `${DECLARATIONS}int packet_code(struct Packet *p)\n{\n    int c = ((p->flags >> 4) & 0xF) + p->level;\n    last_code = c;\n    return c;\n}\n`,
  symbol: "packet_code",
  hints: [
    {
      stage: 1,
      text: "The starting source is the right shape and stops one step early. Everything it does is already correct; the target does one more thing with the result before returning it.",
    },
    {
      stage: 2,
      text: "The highlighted rows are the two loads. They differ in width and in signedness, and each one matches a declaration in the struct. Settle both before reading further.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 3,
      text: "The highlighted rows are the step your source is missing. One builds an address that is not known yet, and the one after the return writes a single byte through it. Nothing was passed in to point there.",
      highlight: { start: 5, end: 8 },
    },
    {
      stage: 4,
      text: "Add one statement before the return: assign the value you already computed to the variable declared outside the function. The narrowing needs no conversion written for it.",
    },
    {
      stage: 9,
      text: "Keep a copy of the result in the variable declared above the function before returning it.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(8, 2),
};
