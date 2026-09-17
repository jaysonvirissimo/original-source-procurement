import {
  conditionsDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const signBit: MissionDraft = {
  schemaVersion: 1,
  id: "029",
  title: "SIGN BIT",
  phase: "Conditions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.COMPARE", "C.SHIFT"],
  teaches: ["MATCH.SEMANTIC_VS_EXACT"],
  practices: ["MIPS.COMPARE", "C.SHIFT", "MIPS.DELAY_SLOT"],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("sign_bit.c"),
  briefing: {
    objective:
      "Return whether the argument is negative. Nothing in the listing looks like a question, and no test you write will produce that row: read what it actually does before you write anything.",
    newTechnique:
      "A negative value is exactly one whose top bit is set. The compiler knows that, so against zero it stops asking and moves that bit down to where an answer of 1 or 0 belongs.",
  },
  terms: [
    "glossary.sra",
    "glossary.twos-complement",
    "glossary.bit",
    "glossary.condition",
    "glossary.slt",
  ],
  starterSource: "int sign_bit(int a)\n{\n    return a < 1;\n}\n",
  solution: "int sign_bit(int a)\n{\n    return a < 0;\n}\n",
  symbol: "sign_bit",
  walkthroughs: [
    {
      kind: "bits",
      caption:
        "Why a shift answers the question. In a signed value the top bit is set exactly when the value is negative, so moving it to the bottom and clearing everything above leaves 1 or 0 — the answer itself. Values are illustrative.",
      skill: "MATCH.SEMANTIC_VS_EXACT",
      rows: [
        { label: "a = -2", width: 32, value: 0xfffffffe },
        {
          label: "shifted down 31, filling with zeros = 1",
          width: 32,
          value: 0x00000001,
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. It asks a question and the target does not: the highlighted row is not a test at all, and no change to which value you test against will turn one into the other.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 2,
      text: "Read the highlighted row as what it is. It moves every bit of the argument down by 31 places and fills the top with zeros, so only the bit that was at the very top survives.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "That surviving bit is the sign. It is 1 for a negative value and 0 otherwise, which is already the answer, so the compiler has nothing left to ask. Work out which question about zero is answered by the sign alone.",
    },
    {
      stage: 4,
      text: "One return of one question comparing the parameter with zero. Only one of the relations compiles to a shift, and the others go back to a test.",
    },
    {
      stage: 9,
      text: "Return whether the argument is below zero.",
      revealSolution: true,
    },
  ],
  difficulty: conditionsDifficulty(2, 1),
};
