import {
  trainingCompiler,
  translationDifficulty,
  type MissionDraft,
} from "./authoring.ts";

export const scaleCheck: MissionDraft = {
  schemaVersion: 1,
  id: "005",
  title: "SCALE CHECK",
  phase: "Translation",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [],
  teaches: [],
  practices: [
    "ABI.ARGUMENT",
    "ABI.RETURN",
    "MIPS.ARITH.ADD_IMMEDIATE",
    "MIPS.ARITH.SHIFT",
  ],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("scale_check.c"),
  briefing: {
    objective: "Combine an add and a shift in one expression.",
  },
  starterSource: "int scale_check(int a)\n{\n    return a;\n}\n",
  solution: "int scale_check(int a)\n{\n    return (a + 3) << 2;\n}\n",
  symbol: "scale_check",
  hints: [
    {
      stage: 1,
      text: "The target adds a constant to the argument, then shifts the result.",
    },
    {
      stage: 2,
      text: "addiu $v0,$a0,0x3 puts the argument plus 3 in $v0 first.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "sll $v0,$v0,2 shifts $v0, which already holds the sum. It runs in the delay slot of jr.",
      highlight: { start: 2, end: 3 },
    },
    {
      stage: 4,
      text: "The add happens before the shift. In C, parentheses decide which operation happens first.",
    },
    {
      stage: 9,
      text: "Add 3 to the argument, then shift the sum left by 2.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(3),
};
