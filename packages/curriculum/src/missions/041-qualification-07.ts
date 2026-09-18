import {
  loopDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const qualification07: MissionDraft = {
  schemaVersion: 1,
  id: "041",
  title: "QUALIFICATION 07",
  phase: "Loops",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [
    "MIPS.BRANCH.BACKWARD",
    "C.LOOP",
    "MATCH.LOOP_UNDO",
    "MATCH.LOOP_INDEX",
    "MIPS.JUMP",
  ],
  teaches: [],
  practices: [
    "C.LOOP",
    "MIPS.JUMP",
    "MIPS.BRANCH.BACKWARD",
    "MIPS.BRANCH.ZERO",
    "MIPS.LOAD.WORD",
    "MIPS.ARITH.SUBTRACT",
    "MATCH.SCHEDULING",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_07.c"),
  briefing: {
    objective:
      "Walk a pointer through n ints and add up how far each one is from zero: subtract the negative ones and add the rest. When n is not above zero, return zero. The starting source has the right body and asks its question in the wrong place. Read all fourteen rows before you write anything.",
  },
  terms: [
    "glossary.loop",
    "glossary.guard",
    "glossary.back-edge",
    "glossary.j",
    "glossary.relocation",
    "glossary.bltz",
    "glossary.lw",
  ],
  starterSource:
    "int qualification_07(int *p, int n)\n{\n    int s = 0;\n    do {\n        if (*p < 0) {\n            s = s - *p;\n        } else {\n            s = s + *p;\n        }\n        p = p + 1;\n        n = n - 1;\n    } while (n > 0);\n    return s;\n}\n",
  solution:
    "int qualification_07(int *p, int n)\n{\n    int s = 0;\n    while (n > 0) {\n        if (*p < 0) {\n            s = s - *p;\n        } else {\n            s = s + *p;\n        }\n        p = p + 1;\n        n = n - 1;\n    }\n    return s;\n}\n",
  symbol: "qualification_07",
  hints: [
    {
      stage: 1,
      text: "Three findings with one cause. One row is missing at the very top, and because every row below it has moved, the jump's destination has moved with it.",
    },
    {
      stage: 2,
      text: "The highlighted rows are the missing guard and its delay slot. It skips the whole loop when the count is not above zero, and the slot sets the total either way.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 3,
      text: "The highlighted rows are the jump and its delay slot, which subtracts. So the arm above the jump is the one for negative values, and the row after the slot is the else.",
      highlight: { start: 6, end: 8 },
    },
    {
      stage: 4,
      text: "Keep the if/else and the two steps after it. Move the question from the bottom of the loop to the top.",
    },
    {
      stage: 9,
      text: "Write the loop as a while, with the same body.",
      revealSolution: true,
    },
  ],
  difficulty: loopDifficulty(14, 13, 6, 2),
};
