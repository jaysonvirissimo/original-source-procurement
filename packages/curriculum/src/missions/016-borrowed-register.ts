import {
  translationDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

/*
 * The point of this mission is the third row of its target, which writes into
 * an argument register. A reader who has only met arguments as inputs reads
 * that as an assignment to a parameter. It is not: the compiler finished with
 * that value and took the register back. Measured against the pinned
 * toolchain, a call-free function never reaches for a register outside $v0,
 * $v1 and the argument registers, however many intermediates are live.
 */
export const borrowedRegister: MissionDraft = {
  schemaVersion: 1,
  id: "016",
  title: "BORROWED REGISTER",
  phase: "Arithmetic",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.ARITH.ADD", "MIPS.ARITH.SUBTRACT"],
  teaches: ["MIPS.REGISTER.TEMP"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("borrowed_register.c"),
  briefing: {
    objective:
      "Add the first two arguments, add the last two, and return the first sum minus the second. Two sums have to exist at once, so watch where the target keeps them.",
    newTechnique:
      "An intermediate value lives in whatever register is free. Once an argument has been used for the last time, its register is free, so the compiler may write a different value into it. A row that writes into an argument register is not an assignment to that parameter.",
  },
  terms: [
    "glossary.temporary",
    "glossary.register",
    "glossary.a0",
    "glossary.v0",
    "glossary.addu",
    "glossary.subu",
  ],
  starterSource:
    "int borrowed_register(int a, int b, int c, int d)\n{\n    return (a + b) + (c + d);\n}\n",
  solution:
    "int borrowed_register(int a, int b, int c, int d)\n{\n    return (a + b) - (c + d);\n}\n",
  symbol: "borrowed_register",
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "Following the two sums. The first is computed into the register that held the first argument, because that argument is finished with. Reading that row as an assignment to a parameter is the mistake this mission exists to prevent. Values are illustrative, for a call of (7, 5, 4, 2).",
      skill: "MIPS.REGISTER.TEMP",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "The first two arguments are added, and the sum is written into the register that held the first argument: 7 + 5 = 12. Nothing about the parameter a changed; the compiler simply took a register it no longer needed.",
        },
        {
          range: { start: 1, end: 2 },
          text: "The last two arguments are added into the return register: 4 + 2 = 6. Both sums now exist at once, in two different registers.",
        },
        {
          range: { start: 3, end: 4 },
          text: "The second sum is subtracted from the first, and the result lands in the return register: 12 - 6 = 6. This row runs in the delay slot after the return.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target computes two sums and then combines them. Compile the starting source first: it has the same shape and differs only in how the two sums are combined.",
    },
    {
      stage: 2,
      text: "The highlighted rows are the two sums. Look at where each result is written. The first goes into a register that arrived holding an argument. The second goes into the return register.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 3,
      text: "That second destination is not an assignment to a parameter. The argument in it had already been read for the last time, so the compiler reused the register for an intermediate value. Your source needs no variable for it.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 4,
      text: "The body is one return of two bracketed sums combined by a single operator. The starting source has the wrong operator between them. No local variable, no condition.",
    },
    {
      stage: 9,
      text: "Return the first pair's sum minus the second pair's sum.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(4),
};
