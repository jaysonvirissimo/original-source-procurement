import {
  branchDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const SOURCE =
  "int the_slot_runs(int a, int b, int c)\n{\n    if (a) { return b; }\n    return c;\n}\n";

export const theSlotRuns: MissionDraft = {
  schemaVersion: 1,
  id: "033",
  title: "THE SLOT RUNS",
  phase: "Branches",
  kind: "prediction",
  source: { kind: "synthetic" },
  requires: ["MIPS.BRANCH"],
  teaches: ["MATCH.SCHEDULING"],
  practices: ["MIPS.BRANCH", "MIPS.DELAY_SLOT"],
  scaffold: "guided",
  completion: "prediction-recorded",
  compiler: trainingCompiler("the_slot_runs.c"),
  briefing: {
    objective:
      "Predict what happens to the row after a branch when the branch is taken.",
    newTechnique:
      "The row after a branch belongs to neither path. It runs before the branch takes effect, so the compiler fills it with work one path needs and the other throws away.",
  },
  terms: [
    "glossary.delay-slot",
    "glossary.beq",
    "glossary.path",
    "glossary.move",
    "glossary.nop",
  ],
  starterSource: SOURCE,
  solution: SOURCE,
  symbol: "the_slot_runs",
  prediction: {
    question:
      "The branch is taken. What happens to the instruction on the row right after it?",
    choices: [
      "It is skipped, because the branch jumps past it",
      "It runs first, before the branch takes effect",
      "It runs only when the branch is not taken",
      "It runs twice, once on each path",
    ],
    answer: 1,
    revealedBy:
      "The row after the branch sets the value the taken path returns. If it were skipped, that path would return nothing.",
  },
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "The delay slot. It runs on both paths, and the row below it overwrites its work whenever the branch is not taken.",
      manualEntry: "mips.delay-slots",
    },
  ],
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "Why the answer has to be that it runs first. Follow the taken path and ask where its return value would otherwise come from.",
      skill: "MATCH.SCHEDULING",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "The branch reads the first argument. Suppose it is not zero, so the branch is taken.",
        },
        {
          range: { start: 1, end: 2 },
          text: "This row copies the second argument into the return register. Nothing else on the taken path ever does.",
        },
        {
          range: { start: 3, end: 5 },
          text: "The branch lands at the return, which sends back whatever that row left behind.",
        },
        {
          text: "So the taken path returns the second argument only because the row after the branch ran. When the branch is not taken, that same row runs and the next one replaces its work with the third argument.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Answer from the listing rather than from what feels right. Trace the path where the branch is taken and ask which row puts a value where a return value belongs.",
    },
    {
      stage: 2,
      text: "The highlighted row is the only one on that path that sets the return value. If the branch skipped it, the function would return whatever happened to be there.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "The source needs no change: it already compiles to these rows. Record your prediction, then compile and read the result against it.",
    },
  ],
  difficulty: branchDifficulty(5, 1),
};
