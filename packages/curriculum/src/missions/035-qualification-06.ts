import {
  branchDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const qualification06: MissionDraft = {
  schemaVersion: 1,
  id: "035",
  title: "QUALIFICATION 06",
  phase: "Branches",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [
    "MIPS.BRANCH",
    "MIPS.BRANCH.ZERO",
    "MATCH.SCHEDULING",
    "MATCH.BRANCH_SENSE",
  ],
  teaches: [],
  practices: [
    "MIPS.BRANCH",
    "MATCH.SCHEDULING",
    "MIPS.COMPARE",
    "C.BITMASK",
    "MIPS.REGISTER.TEMP",
    "MIPS.DELAY_SLOT",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_06.c"),
  briefing: {
    objective:
      "Keep the low bits of the first argument, compare what is left against the second, and return zero when it is below. Otherwise return the first argument unchanged. The starting source is the right shape and asks about the wrong value. Read all seven rows before you write anything.",
  },
  terms: [
    "glossary.and",
    "glossary.mask",
    "glossary.slt",
    "glossary.beq",
    "glossary.path",
    "glossary.delay-slot",
    "glossary.temporary",
  ],
  starterSource:
    "int qualification_06(int a, int b)\n{\n    if (a < b) { return 0; }\n    return a;\n}\n",
  solution:
    "int qualification_06(int a, int b)\n{\n    if ((a & 0xFF) < b) { return 0; }\n    return a;\n}\n",
  symbol: "qualification_06",
  hints: [
    {
      stage: 1,
      text: "The starting source branches on the right question about the wrong value. The comparison names the row you are missing first, and the two findings after it are consequences of not having it.",
    },
    {
      stage: 2,
      text: "The highlighted rows are the missing step and the test that reads it. The test does not read the argument itself; it reads what the row above left behind.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 3,
      text: "The highlighted rows are the branch and the row after it. One of the two values returned is set in the slot that runs either way, and the other replaces it when the branch is not taken.",
      highlight: { start: 2, end: 5 },
    },
    {
      stage: 4,
      text: "One if and one return, with the masking written inside the if's question rather than on a line of its own. The argument itself is returned unmasked, so the mask cannot be applied to it first.",
    },
    {
      stage: 9,
      text: "Mask the first argument inside the test, and leave the returned value alone.",
      revealSolution: true,
    },
  ],
  difficulty: branchDifficulty(7, 1),
};
