import {
  loopDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const qualification09: MissionDraft = {
  schemaVersion: 1,
  id: "049",
  title: "QUALIFICATION 09",
  phase: "Functions",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: ["C.LOOP", "MATCH.LOOP_INDEX", "MATCH.SEMANTIC_VS_EXACT"],
  teaches: [],
  practices: [
    "C.LOOP",
    "MATCH.LOOP_INDEX",
    "MATCH.SEMANTIC_VS_EXACT",
    "MIPS.BRANCH.BACKWARD",
    "MIPS.LOAD.WORD",
    "C.ARRAY",
    "C.SHIFT",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_09.c"),
  briefing: {
    objective:
      "Count how many of the n ints in p are negative, indexing them as p[i]; when n is not above zero, return zero. The starting source asks a slightly different question of each element. Read all twelve rows before you write anything.",
  },
  terms: [
    "glossary.array",
    "glossary.element",
    "glossary.lw",
    "glossary.sra",
    "glossary.twos-complement",
    "glossary.guard",
    "glossary.back-edge",
  ],
  starterSource:
    "int qualification_09(int *p, int n)\n{\n    int i;\n    int s = 0;\n    for (i = 0; i < n; i++) {\n        s = s + (p[i] <= 0);\n    }\n    return s;\n}\n",
  solution:
    "int qualification_09(int *p, int n)\n{\n    int i;\n    int s = 0;\n    for (i = 0; i < n; i++) {\n        s = s + (p[i] < 0);\n    }\n    return s;\n}\n",
  symbol: "qualification_09",
  hints: [
    {
      stage: 1,
      text: "One finding, and it is the question asked of each element. The loop around it already matches, index and all.",
    },
    {
      stage: 2,
      text: "The highlighted row tests nothing. Shifting a value right by 31 leaves only its sign bit, which is 1 for a negative number and 0 otherwise, so it answers whether the value is below zero on its own. Your question needs a real test.",
      highlight: { start: 5, end: 6 },
    },
    {
      stage: 3,
      text: "There is no multiply by four anywhere. The load always reads offset 0 through the first argument, and the row in the back edge's slot adds 4 to it: that is p[i], with i kept only for the exit test.",
      highlight: { start: 3, end: 10 },
    },
    {
      stage: 4,
      text: "Ask whether each element is below zero, not whether it is at most zero. Written as an if that adds 1, the same question compiles to the same rows.",
    },
    {
      stage: 9,
      text: "Count the elements that are less than zero.",
      revealSolution: true,
    },
  ],
  difficulty: loopDifficulty(12, 8, 3, 2),
};
