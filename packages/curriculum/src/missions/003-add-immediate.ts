import {
  trainingCompiler,
  translationDifficulty,
  type MissionDraft,
} from "./authoring.ts";

export const addImmediate: MissionDraft = {
  schemaVersion: 1,
  id: "003",
  title: "ADD IMMEDIATE",
  phase: "Translation",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["ABI.ARGUMENT"],
  teaches: ["MIPS.ARITH.ADD_IMMEDIATE"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("add_immediate.c"),
  briefing: {
    objective:
      "Write a function that returns its argument plus a small constant.",
    newTechnique: "addiu adds a 16-bit constant to a register.",
  },
  terms: [
    "glossary.immediate",
    "glossary.addiu",
    "glossary.a0",
    "glossary.v0",
    "glossary.hexadecimal",
    "glossary.bit",
    "glossary.sign-extension",
  ],
  starterSource: "int add_immediate(int a)\n{\n    return a;\n}\n",
  solution: "int add_immediate(int a)\n{\n    return a + 5;\n}\n",
  symbol: "add_immediate",
  hints: [
    {
      stage: 1,
      text: "The target adds a constant to the first argument before returning it.",
    },
    {
      stage: 2,
      text: "addiu $v0,$a0,imm stores $a0 plus imm in $v0. Read the immediate.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "The assembler shows immediates in hexadecimal. 0x5 is 5.",
    },
    {
      stage: 4,
      text: "In C, adding a constant to an int argument produces this addiu.",
    },
    {
      stage: 9,
      text: "Return the argument plus 5.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(2),
};
