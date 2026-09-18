import {
  loopDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const goAroundAgain: MissionDraft = {
  schemaVersion: 1,
  id: "036",
  title: "GO AROUND AGAIN",
  phase: "Loops",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.BRANCH.ZERO", "MATCH.SCHEDULING"],
  teaches: ["MIPS.BRANCH.BACKWARD"],
  practices: ["MIPS.BRANCH.ZERO", "MATCH.SCHEDULING"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("go_around_again.c"),
  briefing: {
    objective:
      "Take one off the argument and count a pass, and keep going round while the argument is still above zero. The starting source is already that loop, with the wrong question at the bottom of it.",
    newTechnique:
      "A branch whose distance is negative lands on a row that has already run, so the rows in between run again. That is a loop. In a do/while the question comes at the bottom, after the body has run once.",
  },
  terms: [
    "glossary.loop",
    "glossary.back-edge",
    "glossary.bltz",
    "glossary.displacement",
    "glossary.delay-slot",
  ],
  starterSource:
    "int go_around_again(int a)\n{\n    int n = 0;\n    do {\n        a = a - 1;\n        n = n + 1;\n    } while (a != 0);\n    return n;\n}\n",
  solution:
    "int go_around_again(int a)\n{\n    int n = 0;\n    do {\n        a = a - 1;\n        n = n + 1;\n    } while (a > 0);\n    return n;\n}\n",
  symbol: "go_around_again",
  annotations: [
    {
      range: { start: 2, end: 3 },
      text: "The back edge. It reads the argument against zero and, while it is above zero, goes 4 bytes up: one row, to the subtraction.",
      manualEntry: "mips.loops",
    },
    {
      range: { start: 3, end: 4 },
      text: "The back edge's delay slot. The count goes up here, on every pass, before the branch takes effect.",
      manualEntry: "mips.delay-slots",
    },
  ],
  walkthroughs: [
    {
      kind: "operands",
      caption:
        "The back edge read part by part. The distance is negative, so it counts up the listing instead of down.",
      skill: "MIPS.BRANCH.BACKWARD",
      word: 2,
    },
    {
      kind: "trace",
      caption:
        "Two passes, with the argument starting at 2. The same three rows run each time; only the branch decides whether they run again.",
      skill: "MIPS.BRANCH.BACKWARD",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "The count starts at zero. This row runs once, because the loop goes back to the row below it, never to this one.",
        },
        {
          range: { start: 1, end: 2 },
          text: "Take one off the argument: 2 becomes 1.",
        },
        {
          range: { start: 2, end: 3 },
          text: "The back edge asks whether 1 is above zero. It is, so the branch is taken.",
        },
        {
          range: { start: 3, end: 4 },
          text: "The delay slot runs before the branch lands: the count becomes 1. Then the branch goes one row up, to the subtraction.",
        },
        {
          range: { start: 1, end: 4 },
          text: "Second pass. The argument becomes 0, the branch asks again and is not taken this time, and the delay slot still runs: the count becomes 2.",
        },
        {
          range: { start: 4, end: 6 },
          text: "Not taken, so the next row is the return, which sends back 2.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source first. Everything matches except one row, and that row is the question at the bottom of the loop.",
    },
    {
      stage: 2,
      text: "The highlighted row is the back edge. The target's reads the argument against zero and goes back while it is above zero; yours goes back while it is anything but zero.",
      highlight: { start: 2, end: 3 },
    },
    {
      stage: 3,
      text: "The highlighted rows are the whole loop: the subtraction, the branch that goes back to it, and the count in the branch's delay slot. Nothing above or below them repeats.",
      highlight: { start: 1, end: 4 },
    },
    {
      stage: 4,
      text: "Keep the do/while and its body. Change only the condition after while, so that it asks whether the argument is above zero.",
    },
    {
      stage: 9,
      text: "Loop while the argument is above zero.",
      revealSolution: true,
    },
  ],
  difficulty: loopDifficulty(6, 7, 2),
};
