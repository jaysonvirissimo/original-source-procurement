import {
  callDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const qualification08: MissionDraft = {
  schemaVersion: 1,
  id: "048",
  title: "QUALIFICATION 08",
  phase: "Functions",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [
    "ABI.CALL",
    "ABI.FRAME",
    "ABI.STACK",
    "MIPS.REGISTER.SAVED",
    "ABI.SAVED_REGISTER",
    "MIPS.REGISTER.SCRATCH",
  ],
  teaches: [],
  practices: [
    "ABI.CALL",
    "ABI.FRAME",
    "MIPS.REGISTER.SAVED",
    "ABI.SAVED_REGISTER",
    "C.LOOP",
    "MIPS.BRANCH.BACKWARD",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_08.c"),
  briefing: {
    objective:
      "Count n down to 1, call helper on each value, and return the sum of its answers; when n is not above zero, return zero without calling it at all. The starting source has the right body and asks its question in the wrong place. Read all eighteen rows before you write anything.",
  },
  terms: [
    "glossary.jal",
    "glossary.s0",
    "glossary.sp",
    "glossary.prologue",
    "glossary.guard",
    "glossary.back-edge",
  ],
  starterSource:
    "int helper(int x);\n\nint qualification_08(int n)\n{\n    int s = 0;\n    do {\n        s = s + helper(n);\n        n = n - 1;\n    } while (n > 0);\n    return s;\n}\n",
  solution:
    "int helper(int x);\n\nint qualification_08(int n)\n{\n    int s = 0;\n    while (n > 0) {\n        s = s + helper(n);\n        n = n - 1;\n    }\n    return s;\n}\n",
  symbol: "qualification_08",
  hints: [
    {
      stage: 1,
      text: "Three findings, one cause. One row is missing, and the call below it is reported twice only because it has moved: once where the target has it and once where yours does.",
    },
    {
      stage: 2,
      text: "The highlighted row is the missing one. It reads the count, which by then lives in a saved register, and skips everything when it is not above zero.",
      highlight: { start: 5, end: 6 },
    },
    {
      stage: 3,
      text: "The count and the total both live in $s registers, because both are needed after every call. That is why the prologue saves two of them.",
      highlight: { start: 1, end: 5 },
    },
    {
      stage: 4,
      text: "Keep the body. Ask the loop's question before the first pass instead of after it.",
    },
    {
      stage: 9,
      text: "Write the loop as a while, with the same body.",
      revealSolution: true,
    },
  ],
  difficulty: callDifficulty(18, 10, 10, 3),
};
