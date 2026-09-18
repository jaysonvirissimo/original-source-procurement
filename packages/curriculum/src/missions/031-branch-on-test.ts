import {
  branchDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const branchOnTest: MissionDraft = {
  schemaVersion: 1,
  id: "031",
  title: "BRANCH ON TEST",
  phase: "Branches",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.COMPARE", "MIPS.DELAY_SLOT"],
  teaches: ["MIPS.BRANCH"],
  practices: ["MIPS.COMPARE"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("branch_on_test.c"),
  briefing: {
    objective:
      "Return one value when the first argument is below the second and a different value otherwise. The starting source answers the question instead of acting on it, so compiling it shows you exactly which rows the acting on is made of.",
    newTechnique:
      "A branch skips forward when a value holds. It is what turns an answer into two different things happening, and it is the first instruction in this course that makes one listing hold more than one path.",
  },
  terms: [
    "glossary.beq",
    "glossary.displacement",
    "glossary.path",
    "glossary.slt",
    "glossary.delay-slot",
    "glossary.nop",
  ],
  starterSource: "int branch_on_test(int a, int b)\n{\n    return a < b;\n}\n",
  solution:
    "int branch_on_test(int a, int b)\n{\n    if (a < b) { return 1; }\n    return 2;\n}\n",
  symbol: "branch_on_test",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "The branch. It reads the answer in the row above and, when that answer is not zero, continues 12 bytes further down: three rows, at the return.",
      manualEntry: "mips.branches",
    },
    {
      range: { start: 2, end: 3 },
      text: "This row is the branch's delay slot. It runs whether or not the branch was taken, which is why the value it sets is the one the taken path returns.",
      manualEntry: "mips.delay-slots",
    },
  ],
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "The same five rows, read twice. Only the last two rows differ between the two paths, and the row after the branch belongs to both.",
      skill: "MIPS.BRANCH",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "The test writes 1 or 0 into a register, exactly as it did in the previous phase.",
        },
        {
          range: { start: 1, end: 2 },
          text: "The branch reads that answer. Suppose it is 1, so the branch is taken.",
        },
        {
          range: { start: 2, end: 3 },
          text: "This row still runs: it is the delay slot. It sets the value the taken path returns.",
        },
        {
          range: { start: 4, end: 6 },
          text: "The branch now takes effect and lands here, at the return, skipping the row between.",
        },
        {
          text: "Now suppose the answer was 0 instead. The branch is not taken, the same delay slot runs anyway, and the row it skipped over runs next and overwrites the value with the other one.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source first. It produces the first row of the target and nothing else, because answering the question and acting on the answer are different work.",
    },
    {
      stage: 2,
      text: "The comparison lists the rows you are missing. The second of them is the branch: it reads the answer the first row produced and skips forward when that answer holds.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 3,
      text: "The two highlighted rows each set a value. Only one of them can be the answer on any given call, and the second one is reached only by not branching over it.",
      highlight: { start: 2, end: 4 },
    },
    {
      stage: 4,
      text: "Write an if whose body returns one value, followed by a return of the other. Two statements, no local variable, and no else needed: a return ends the function on its own.",
    },
    {
      stage: 9,
      text: "Return 1 when the first argument is below the second, and 2 otherwise.",
      revealSolution: true,
    },
  ],
  difficulty: branchDifficulty(6, 1),
};
