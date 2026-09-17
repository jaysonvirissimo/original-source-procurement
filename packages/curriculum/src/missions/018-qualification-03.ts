import {
  translationDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const qualification03: MissionDraft = {
  schemaVersion: 1,
  id: "018",
  title: "QUALIFICATION 03",
  phase: "Arithmetic",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [],
  teaches: [],
  practices: [
    "MIPS.ARITH.ADD",
    "MIPS.ARITH.SUBTRACT",
    "MIPS.ARITH.ADD_IMMEDIATE",
    "MIPS.REGISTER.TEMP",
    "C.BITMASK",
    "ABI.ARGUMENT",
    "ABI.RETURN",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_03.c"),
  briefing: {
    objective:
      "Mask the low bits of two different sums and return the difference between them. Every constant and every operand order follows from the listing: read all six rows before you write anything.",
  },
  terms: [
    "glossary.mask",
    "glossary.and",
    "glossary.addu",
    "glossary.subu",
    "glossary.temporary",
    "glossary.hexadecimal",
  ],
  starterSource:
    "int packed_difference(int a, int b, int c)\n{\n    return ((a + b) & 0xFF) - (c & 0xF);\n}\n",
  solution:
    "int packed_difference(int a, int b, int c)\n{\n    return ((a + b) & 0xFF) - ((c - b) & 0xF);\n}\n",
  symbol: "packed_difference",
  hints: [
    {
      stage: 1,
      text: "Two values are each built and then masked, and one is subtracted from the other. The starting source has the first half right and the second half too simple.",
    },
    {
      stage: 2,
      text: "The highlighted rows build and mask the first value. Its sum lands in a register that arrived holding an argument, which is reuse, not an assignment to a parameter.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 3,
      text: "The highlighted rows build and mask the second value. Read which two registers the arithmetic row uses and in which order, then read its mask. The starting source masks a bare argument here instead.",
      highlight: { start: 2, end: 4 },
    },
    {
      stage: 4,
      text: "The body is one return: two bracketed expressions, each masked with its own constant, with the second subtracted from the first. No local variable, no condition.",
    },
    {
      stage: 9,
      text: "The second value is the difference between the third and second arguments, masked.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(6),
};
