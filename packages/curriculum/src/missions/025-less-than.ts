import {
  conditionsDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const lessThan: MissionDraft = {
  schemaVersion: 1,
  id: "025",
  title: "LESS THAN",
  phase: "Conditions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.ARITH.ADD"],
  teaches: ["MIPS.COMPARE"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("less_than.c"),
  briefing: {
    objective:
      "Return whether the first argument is below the second. The starting source subtracts them instead, which is a different question with a different instruction.",
    newTechnique:
      "A question like this has a value in C: 1 when the answer is yes, 0 when it is no. One instruction answers it, so the whole function is two rows long.",
  },
  terms: [
    "glossary.slt",
    "glossary.condition",
    "glossary.delay-slot",
    "glossary.jr",
    "glossary.v0",
  ],
  starterSource: "int less_than(int a, int b)\n{\n    return a - b;\n}\n",
  solution: "int less_than(int a, int b)\n{\n    return a < b;\n}\n",
  symbol: "less_than",
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "The answer is a number. Below gives 1 and not below gives 0, so the result can be returned like any other value. Values are illustrative.",
      skill: "MIPS.COMPARE",
      code: "int under = less_than(3, 9);",
      rows: [
        { name: "$a0", before: 3, note: "the first argument, a" },
        { name: "$a1", before: 9, note: "the second argument, b" },
        { name: "$v0", after: 1, note: "3 is below 9, so 1" },
        { name: "under", after: 1, note: "less_than(9, 3) would give 0" },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target asks a question about the two arguments rather than calculating with them. Compile the starting source first: subtraction answers a different question, and the difference between the two listings is the whole mission.",
    },
    {
      stage: 2,
      text: "The highlighted row is the answer. It writes 1 or 0 into the register a return value leaves in, depending on whether its first source is below its second.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "Notice where that row sits. The return comes first and the work comes second, and both run, which you have seen since the first mission: the instruction after a return still gets its turn. A two-row function reads back to front.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 4,
      text: "The body is one return of a question about the two parameters, in the order the row reads them. No subtraction, no local variable, no if.",
    },
    {
      stage: 9,
      text: "Return whether the first argument is below the second.",
      revealSolution: true,
    },
  ],
  difficulty: conditionsDifficulty(2, 1),
};
