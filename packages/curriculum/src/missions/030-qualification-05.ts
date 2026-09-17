import {
  conditionsDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const qualification05: MissionDraft = {
  schemaVersion: 1,
  id: "030",
  title: "QUALIFICATION 05",
  phase: "Conditions",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [
    "MIPS.COMPARE",
    "MIPS.COMPARE.SIGNEDNESS",
    "MIPS.DELAY_SLOT",
    "MATCH.EXPRESSION_ORDER",
    "MATCH.SEMANTIC_VS_EXACT",
  ],
  teaches: [],
  practices: [
    "MIPS.COMPARE",
    "MIPS.COMPARE.SIGNEDNESS",
    "MATCH.EXPRESSION_ORDER",
    "MIPS.DELAY_SLOT",
    "C.SHIFT",
    "C.BITMASK",
    "MIPS.REGISTER.TEMP",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_05.c"),
  briefing: {
    objective:
      "Shift one argument down, keep the low bits of the other, and return whether the first result is above the second. Two rows of the four carry a signedness that follows from the parameter list, and they do not both carry the same one. Read all four rows before you write anything.",
  },
  terms: [
    "glossary.slt",
    "glossary.sra",
    "glossary.and",
    "glossary.mask",
    "glossary.condition",
    "glossary.delay-slot",
    "glossary.temporary",
  ],
  starterSource:
    "int qualification_05(int a, int b)\n{\n    return (a >> 4) < (b & 0xF);\n}\n",
  solution:
    "int qualification_05(int a, unsigned int b)\n{\n    return (b & 0xF) < (a >> 4);\n}\n",
  symbol: "qualification_05",
  hints: [
    {
      stage: 1,
      text: "The starting source does the right two calculations and asks the question the wrong way round, with one parameter declared wrongly. Everything you need is in the parameter list and in the order the last row reads its sources.",
    },
    {
      stage: 2,
      text: "The highlighted rows are the two calculations. One keeps the low bits of a value; the other moves a value down, and which of the two shifts it uses tells you how that parameter is declared.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 3,
      text: "The highlighted row is the test. Read its two sources in order to see which result is being asked about, and read the end of its mnemonic to see how both are being read.",
      highlight: { start: 3, end: 4 },
    },
    {
      stage: 4,
      text: "One return, one question, two calculations inside it, and no local variable. A row that writes into an argument register is the compiler reusing it for a result, not an assignment to that parameter.",
    },
    {
      stage: 9,
      text: "Declare the second parameter unsigned and ask whether its masked value is below the first argument shifted down.",
      revealSolution: true,
    },
  ],
  difficulty: conditionsDifficulty(4, 1),
};
