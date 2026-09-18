import {
  loopDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const theGuard: MissionDraft = {
  schemaVersion: 1,
  id: "037",
  title: "THE GUARD",
  phase: "Loops",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.BRANCH.BACKWARD"],
  teaches: ["C.LOOP"],
  practices: ["MIPS.BRANCH.BACKWARD", "MIPS.BRANCH.ZERO", "MATCH.SCHEDULING"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("the_guard.c"),
  briefing: {
    objective:
      "Count the same passes as the last mission, but when the argument starts at zero or below, run no passes at all and return zero. The starting source is the last mission's answer, and the comparison names the one row it lacks.",
    newTechnique:
      "A while loop asks its question before the first pass. The compiler writes it as a do/while with one more branch in front, the guard, which skips the loop when the body should not run even once.",
  },
  terms: [
    "glossary.loop",
    "glossary.guard",
    "glossary.back-edge",
    "glossary.bltz",
    "glossary.delay-slot",
  ],
  starterSource:
    "int the_guard(int a)\n{\n    int n = 0;\n    do {\n        a = a - 1;\n        n = n + 1;\n    } while (a > 0);\n    return n;\n}\n",
  solution:
    "int the_guard(int a)\n{\n    int n = 0;\n    while (a > 0) {\n        a = a - 1;\n        n = n + 1;\n    }\n    return n;\n}\n",
  symbol: "the_guard",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "The guard. It asks the opposite of the loop's question, at most zero, and when the answer is yes it skips 20 bytes down, five rows, straight to the return.",
      manualEntry: "mips.loops",
    },
    {
      range: { start: 1, end: 2 },
      text: "The guard's delay slot sets the count to zero. That is right on both paths, so it runs either way.",
      manualEntry: "mips.delay-slots",
    },
  ],
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "The guard read on both of its paths. Below it, the loop is the same three rows as the last mission.",
      skill: "C.LOOP",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "Suppose the argument is 0. The guard asks whether it is at most zero; it is, so the branch is taken.",
        },
        {
          range: { start: 1, end: 2 },
          text: "The delay slot still runs, and the count becomes zero.",
        },
        {
          range: { start: 5, end: 7 },
          text: "The guard lands on the return, five rows down, and the function sends back 0 without a single pass.",
        },
        {
          text: "Now suppose the argument is 2. The guard is not taken, the same delay slot sets the count to zero, and the rows below run exactly as they did in the last mission: two passes, and 2 is returned.",
        },
        {
          range: { start: 3, end: 4 },
          text: "The back edge still asks the loop's own question, above zero. The guard asks the opposite about the same value; a listing with both is a while loop.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. It lacks exactly one row, and that row is the first one in the target.",
    },
    {
      stage: 2,
      text: "The highlighted row is the guard. It asks whether the argument is at most zero and, if so, skips past the loop to the return.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "The highlighted rows are the guard and the back edge. They ask opposite questions about the same value, so the loop is asked about before the first pass as well as after every pass.",
      highlight: { start: 0, end: 4 },
    },
    {
      stage: 4,
      text: "Ask the question before the body instead of after it. Same body, same condition, a different kind of loop.",
    },
    {
      stage: 9,
      text: "Write it as a while loop.",
      revealSolution: true,
    },
  ],
  difficulty: loopDifficulty(7, 8, 3),
};
