import {
  branchDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const eitherWayRound: MissionDraft = {
  schemaVersion: 1,
  id: "034",
  title: "EITHER WAY ROUND",
  phase: "Branches",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MATCH.SCHEDULING", "MATCH.EXPRESSION_ORDER"],
  teaches: ["MATCH.BRANCH_SENSE"],
  practices: ["MIPS.BRANCH", "MIPS.COMPARE"],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("either_way_round.c"),
  briefing: {
    objective:
      "The starting source is already correct. It returns the right value for every input and still does not match, because it asks the question the other way round. Read the branch and the order of the two paths, then write the source that produces them.",
    newTechnique:
      "A test and its opposite are the same program with the paths swapped. The listing keeps only one of the two spellings, so matching means recovering which one the original used.",
  },
  terms: [
    "glossary.beq",
    "glossary.path",
    "glossary.slt",
    "glossary.condition",
  ],
  starterSource:
    "int either_way_round(int a, int b)\n{\n    if (a < b) { return 1; }\n    return 2;\n}\n",
  solution:
    "int either_way_round(int a, int b)\n{\n    if (a >= b) { return 2; }\n    return 1;\n}\n",
  symbol: "either_way_round",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "The branch goes when the test answered no. That tells you the source asked the opposite question from the one the values suggest.",
      manualEntry: "matching.branch-sense",
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source and read both findings together. One says the branch differs; the other says your two values appear in the other order. That pairing has a single cause.",
    },
    {
      stage: 2,
      text: "Read the highlighted branch. Yours goes when the test succeeded; the target's goes when it failed. Everything else follows from that.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "Because the branch is inverted, the two values are in the other order too. The highlighted rows show which value belongs to the path that is branched over and which to the path that is not.",
      highlight: { start: 2, end: 4 },
    },
    {
      stage: 4,
      text: "Keep two statements: an if that returns one value, then a return of the other. Ask the opposite question from your first attempt, and swap which value goes where.",
    },
    {
      stage: 9,
      text: "Test whether the first argument is at least the second, return 2 there, and return 1 after.",
      revealSolution: true,
    },
  ],
  difficulty: branchDifficulty(6, 1),
};
