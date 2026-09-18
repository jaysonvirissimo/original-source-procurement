import {
  branchDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const branchOnSign: MissionDraft = {
  schemaVersion: 1,
  id: "032",
  title: "BRANCH ON SIGN",
  phase: "Branches",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.BRANCH", "MATCH.SEMANTIC_VS_EXACT"],
  teaches: ["MIPS.BRANCH.ZERO"],
  practices: ["MIPS.BRANCH", "MIPS.ARITH.ADD"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("branch_on_sign.c"),
  briefing: {
    objective:
      "Return zero when the first argument is negative, and the sum of both arguments otherwise. The starting source tests against the wrong value, and the listing differs by a single instruction that names the question it really asks.",
    newTechnique:
      "Against zero, a branch needs no test in front of it. There are four such branches, one for each way of comparing with zero, and each reads the register itself.",
  },
  terms: [
    "glossary.bltz",
    "glossary.beq",
    "glossary.path",
    "glossary.twos-complement",
    "glossary.addu",
  ],
  starterSource:
    "int branch_on_sign(int a, int b)\n{\n    if (a < 1) { return 0; }\n    return a + b;\n}\n",
  solution:
    "int branch_on_sign(int a, int b)\n{\n    if (a < 0) { return 0; }\n    return a + b;\n}\n",
  symbol: "branch_on_sign",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "The whole question, in one instruction. There is no test above it: this branch reads the register and goes when its value is negative.",
      manualEntry: "mips.branches",
    },
  ],
  walkthroughs: [
    {
      kind: "operands",
      caption:
        "The branch read part by part. The number at the end is the part worth slowing down for: it is a distance from this row, not a place, and the listing leaves the counting to you.",
      skill: "MIPS.BRANCH.ZERO",
      word: 0,
    },
    {
      kind: "trace",
      caption:
        "Five rows and no test instruction anywhere. Asking about zero is cheap enough that the branch does it itself.",
      skill: "MIPS.BRANCH.ZERO",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "The branch asks the question and acts on it at once. Suppose the value is negative, so it is taken.",
        },
        {
          range: { start: 1, end: 2 },
          text: "The delay slot runs either way, and here it sets the value the negative case returns.",
        },
        {
          range: { start: 3, end: 5 },
          text: "The branch lands at the return, skipping the row between.",
        },
        {
          text: "When the value is not negative the branch is not taken, the same delay slot runs, and the row it would have skipped replaces that value with the sum.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. Every row matches except one, and the comparison names both instructions side by side.",
    },
    {
      stage: 2,
      text: "The highlighted row is the branch. Read the end of its mnemonic: it says which comparison with zero it makes, and yours makes a different one.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "There are four of these, for below zero, at most zero, above zero, and at least zero. Your source asks a question that is true for zero itself; the target's is not.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 4,
      text: "Keep the shape exactly as it is. Change only the value the first argument is compared against.",
    },
    {
      stage: 9,
      text: "Test whether the first argument is below zero rather than below one.",
      revealSolution: true,
    },
  ],
  difficulty: branchDifficulty(5, 1),
};
