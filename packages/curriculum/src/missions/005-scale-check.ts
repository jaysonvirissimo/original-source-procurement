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
  terms: [
    "glossary.temporary",
    "glossary.addiu",
    "glossary.sll",
    "glossary.v0",
  ],
  starterSource: "int scale_check(int a)\n{\n    return a;\n}\n",
  solution: "int scale_check(int a)\n{\n    return (a + 3) << 2;\n}\n",
  symbol: "scale_check",
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "One example call with a = 2. $v0 holds the sum before it holds the result: a register's usual role does not stop the compiler from using it for a step in between.",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "addiu writes a + 3 into $v0: 2 + 3 = 5. $v0 holds an intermediate value, not the result yet.",
        },
        {
          range: { start: 1, end: 2 },
          text: "jr $ra starts the return. Its delay slot still runs first.",
        },
        {
          range: { start: 2, end: 3 },
          text: "sll reads $v0 and writes it back shifted left by 2: 5 × 4 = 20.",
        },
        {
          text: "The caller continues with 20 in $v0. Written without parentheses, a + 3 * 4 multiplies first and returns 2 + 12 = 14, which compiles to a different listing.",
        },
      ],
    },
  ],
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
