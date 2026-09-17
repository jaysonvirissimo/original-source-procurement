import {
  conditionsDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const otherWayRound: MissionDraft = {
  schemaVersion: 1,
  id: "027",
  title: "OTHER WAY ROUND",
  phase: "Conditions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.COMPARE"],
  teaches: ["MATCH.EXPRESSION_ORDER"],
  practices: ["MIPS.COMPARE"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("other_way_round.c"),
  briefing: {
    objective:
      "The target asks whether the first argument is above the second. There is no instruction for that, so the listing shows the only test the machine has, reading its two sources in an order you have to match.",
    newTechnique:
      "Above and below are the same question asked from opposite ends. Writing it either way is correct C; only one of them produces the row in front of you.",
  },
  terms: ["glossary.slt", "glossary.condition", "glossary.a0"],
  starterSource: "int other_way_round(int a, int b)\n{\n    return a < b;\n}\n",
  solution: "int other_way_round(int a, int b)\n{\n    return a > b;\n}\n",
  symbol: "other_way_round",
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "One instruction, two questions. Which one it answers depends only on which argument it reads first, so the same row means the opposite thing with its sources swapped. Values are illustrative.",
      skill: "MATCH.EXPRESSION_ORDER",
      code: "int over = other_way_round(9, 3);",
      rows: [
        { name: "$a0", before: 9, note: "the first argument, a" },
        { name: "$a1", before: 3, note: "the second argument, b" },
        { name: "$v0", after: 1, note: "3 is below 9, so 1" },
        { name: "over", after: 1, note: "reading $a0 first would give 0" },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. Both listings hold the same two rows and the same instruction; the difference is which register the test reads first.",
    },
    {
      stage: 2,
      text: "Read the two sources of the highlighted row in order. The first is the value being asked about, the second is what it is measured against. Your output reads them the other way round.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "The machine has no instruction for above. The compiler answers it by asking the below question from the far end, so a source that reads b before a produces exactly this row.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 4,
      text: "Keep one return of one question about the two parameters. Either turn the operator round or swap the two names; both spellings compile to the same row.",
    },
    {
      stage: 9,
      text: "Ask whether the first argument is above the second.",
      revealSolution: true,
    },
  ],
  difficulty: conditionsDifficulty(2, 1),
};
