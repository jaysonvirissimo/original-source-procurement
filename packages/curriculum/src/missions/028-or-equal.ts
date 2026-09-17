import {
  conditionsDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const orEqual: MissionDraft = {
  schemaVersion: 1,
  id: "028",
  title: "OR EQUAL",
  phase: "Conditions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.COMPARE", "MATCH.EXPRESSION_ORDER"],
  teaches: ["MIPS.DELAY_SLOT"],
  practices: ["MIPS.COMPARE", "MATCH.EXPRESSION_ORDER"],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("or_equal.c"),
  briefing: {
    objective:
      "Return whether the first argument is at most the second. The starting source leaves out the at-most part, and adding it costs a row — but not the row you would expect, and not in the place you would expect.",
    newTechnique:
      "Every mission so far has had one instruction after the return. This one has an instruction before it as well, so the listing finally shows a choice: the compiler decides what to put in the slot after a return, and it is the last step, not the first.",
  },
  terms: [
    "glossary.slt",
    "glossary.xor",
    "glossary.delay-slot",
    "glossary.jr",
    "glossary.condition",
  ],
  starterSource: "int or_equal(int a, int b)\n{\n    return a < b;\n}\n",
  solution: "int or_equal(int a, int b)\n{\n    return a <= b;\n}\n",
  symbol: "or_equal",
  walkthroughs: [
    {
      kind: "timeline",
      caption:
        "Both rows after the first one run before the return takes effect. The test happens, then the return begins, then the slot after it flips the answer — and only then does control leave the function.",
      skill: "MIPS.DELAY_SLOT",
      lanes: [
        {
          label: "or_equal",
          steps: [
            {
              range: { start: 0, end: 1 },
              text: "The test answers the opposite question and leaves 1 or 0 in the return register.",
            },
            {
              range: { start: 1, end: 2 },
              text: "The return begins. It does not take effect yet.",
            },
            {
              range: { start: 2, end: 3 },
              text: "The delay slot runs and flips the answer, turning 1 into 0 and 0 into 1.",
            },
            {
              text: "Only now does the return take effect, with the flipped answer in place.",
            },
          ],
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. It is one row shorter, and the row it shares with the target is not even the same: adding at-most changes both what is asked and what happens to the answer.",
    },
    {
      stage: 2,
      text: "The highlighted row is the test, and it runs before the return rather than after it. Read its two sources: they are the other way round from the question in the objective, because the machine can only ask one direction.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "The highlighted row sits after the return and still runs. It flips the answer: 1 becomes 0 and 0 becomes 1. Asking the opposite question and then reversing the answer is how at-most is built from below.",
      highlight: { start: 2, end: 3 },
    },
    {
      stage: 4,
      text: "One return of one question about the two parameters, written the way the objective asks rather than the way the listing answers it. Nothing in your source corresponds to the flip; the compiler adds it.",
    },
    {
      stage: 9,
      text: "Return whether the first argument is at most the second.",
      revealSolution: true,
    },
  ],
  difficulty: conditionsDifficulty(3, 1),
};
