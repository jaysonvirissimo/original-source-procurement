import {
  trainingCompiler,
  translationDifficulty,
  type MissionDraft,
} from "./authoring.ts";

export const shiftLeft: MissionDraft = {
  schemaVersion: 1,
  id: "004",
  title: "SHIFT LEFT",
  phase: "Translation",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["ABI.ARGUMENT"],
  teaches: ["MIPS.ARITH.SHIFT"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("shift_left.c"),
  briefing: {
    objective:
      "Write a function that returns its argument shifted left by a constant.",
    newTechnique: "sll shifts a register's bits left by a constant amount.",
  },
  terms: ["glossary.sll", "glossary.bit", "glossary.a0", "glossary.v0"],
  starterSource: "int shift_left(int a)\n{\n    return a;\n}\n",
  solution: "int shift_left(int a)\n{\n    return a << 3;\n}\n",
  symbol: "shift_left",
  walkthroughs: [
    {
      kind: "bits",
      caption:
        "Shifting left by 3 moves every bit three places toward the high end and fills the low places with zeros. Each place doubles the value, so with an example a of 5 the result is 5 × 2 × 2 × 2 = 40. Only the low 8 of the 32 bits are shown; the others stay 0.",
      skill: "MIPS.ARITH.SHIFT",
      rows: [
        { label: "a = 5", width: 8, value: 5 },
        {
          label: "a << 3 = 40",
          width: 8,
          value: 40,
          derive: { op: "shl", from: 0, amount: 3 },
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target shifts the first argument before returning it.",
    },
    {
      stage: 2,
      text: "sll $v0,$a0,n stores $a0 shifted left by n bits in $v0. Read the shift amount.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "Shifting left by n bits multiplies by 2 to the power n. The shift runs in the delay slot of jr, before the return takes effect.",
    },
    {
      stage: 4,
      text: "In C, << shifts left. The shift amount is the number after sll.",
    },
    {
      stage: 9,
      text: "Return the argument shifted left by 3.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(2),
};
