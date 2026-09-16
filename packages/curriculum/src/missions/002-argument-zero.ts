import {
  trainingCompiler,
  translationDifficulty,
  type MissionDraft,
} from "./authoring.ts";

const SOURCE = "int argument_zero(int a)\n{\n    return a;\n}\n";

export const argumentZero: MissionDraft = {
  schemaVersion: 1,
  id: "002",
  title: "ARGUMENT ZERO",
  phase: "Translation",
  kind: "prediction",
  source: { kind: "synthetic" },
  requires: ["ABI.RETURN"],
  teaches: ["ABI.ARGUMENT"],
  practices: [],
  scaffold: "guided",
  completion: "prediction-recorded",
  compiler: trainingCompiler("argument_zero.c"),
  briefing: {
    objective: "Predict where the first integer argument arrives.",
    newTechnique: "The first four integer arguments arrive in $a0 to $a3.",
  },
  terms: [
    "glossary.register",
    "glossary.a0",
    "glossary.v0",
    "glossary.move",
    "glossary.jr",
    "glossary.delay-slot",
  ],
  starterSource: SOURCE,
  solution: SOURCE,
  symbol: "argument_zero",
  prediction: {
    question: "Which register carries the first integer argument?",
    choices: ["$v0", "$a0", "$s0", "$ra"],
    answer: 1,
    revealedBy: "The instruction in the delay slot of jr copies $a0 into $v0.",
  },
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "One possible call, with illustrative values. The caller passes 7, so $a0 holds 7 when argument_zero starts. move copies it into $v0, its destination, and the caller receives 7.",
      skill: "ABI.ARGUMENT",
      code: "int r = argument_zero(7);",
      rows: [
        {
          name: "$a0",
          before: 7,
          after: 7,
          note: "the argument a; move reads it and leaves it unchanged",
        },
        {
          name: "$v0",
          after: 7,
          note: "the destination of move: the return value",
        },
        { name: "r", after: 7, note: "the caller's variable receives $v0" },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The function returns its argument unchanged, so the output copies one register into $v0.",
    },
    {
      stage: 2,
      text: "move copies one register into another. Read which register it copies from.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 9,
      text: "The starting source is already complete. Record a prediction, then compile.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(2),
};
