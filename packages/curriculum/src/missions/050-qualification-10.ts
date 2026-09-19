import {
  callDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const qualification10: MissionDraft = {
  schemaVersion: 1,
  id: "050",
  title: "QUALIFICATION 10",
  phase: "Functions",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: ["ABI.STACK", "MIPS.REGISTER.SCRATCH", "MATCH.LOOP_UNDO"],
  teaches: [],
  practices: [
    "ABI.STACK",
    "MIPS.REGISTER.SCRATCH",
    "MATCH.LOOP_UNDO",
    "ABI.ARGUMENT",
    "C.LOOP",
    "MIPS.BRANCH.BACKWARD",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_10.c"),
  briefing: {
    objective:
      "Add e, e - 1 and so on down to 1, where e is the fifth argument, then add a ^ b and c ^ d; the loop always makes at least one pass. The starting source has every statement and puts two of them in the other order. Read all twelve rows before you write anything.",
  },
  terms: [
    "glossary.sp",
    "glossary.t0",
    "glossary.back-edge",
    "glossary.delay-slot",
    "glossary.subu",
    "glossary.xor",
  ],
  starterSource:
    "int qualification_10(int a, int b, int c, int d, int e)\n{\n    int n = 0;\n    do {\n        e = e - 1;\n        n = n + e;\n    } while (e > 0);\n    return n + (a ^ b) + (c ^ d);\n}\n",
  solution:
    "int qualification_10(int a, int b, int c, int d, int e)\n{\n    int n = 0;\n    do {\n        n = n + e;\n        e = e - 1;\n    } while (e > 0);\n    return n + (a ^ b) + (c ^ d);\n}\n",
  symbol: "qualification_10",
  hints: [
    {
      stage: 1,
      text: "Two findings, and both are rows your loop does not have: one in the back edge's slot and one just after the loop. Everything else already matches, the fifth argument included.",
    },
    {
      stage: 2,
      text: "The first highlighted row is the back edge. The add after it sits in its slot, so it runs once more after the last pass, and the subtract that follows takes that extra add back out.",
      highlight: { start: 4, end: 7 },
    },
    {
      stage: 3,
      text: "The fifth argument has no register, so the first row reads it from 16 bytes up the caller's frame. The argument registers are all still needed for the two xors, so the count and the total live in $t0 and $t1.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 4,
      text: "Keep every statement. Inside the loop, add to the total before the count goes down.",
    },
    {
      stage: 9,
      text: "Swap the two lines inside the loop.",
      revealSolution: true,
    },
  ],
  difficulty: callDifficulty(12, 6, 1, 2, 2),
};
