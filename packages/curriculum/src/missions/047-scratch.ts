import {
  callDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const scratch: MissionDraft = {
  schemaVersion: 1,
  id: "047",
  title: "SCRATCH",
  phase: "Functions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.REGISTER.SAVED", "MIPS.REGISTER.TEMP"],
  teaches: ["MIPS.REGISTER.SCRATCH"],
  practices: ["MIPS.REGISTER.TEMP", "MIPS.ARITH.ADD", "C.BITMASK"],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("scratch.c"),
  briefing: {
    objective:
      "Make four sums of neighbouring arguments, then combine them: the first two with xor, the last two with xor, the first and third with and, the second and fourth with or, and add all four results. The starting source gets one operator wrong. Edit only the return line.",
    newTechnique:
      "$t0 to $t9 are scratch registers. Nobody saves them and a call may destroy them, so they only hold work done between calls. This function calls nothing, and reaches for $t0 only because every argument register is still needed when the first sum is made.",
  },
  terms: [
    "glossary.t0",
    "glossary.s0",
    "glossary.temporary",
    "glossary.xor",
    "glossary.and",
    "glossary.or",
    "glossary.v1",
  ],
  starterSource:
    "int scratch(int a, int b, int c, int d)\n{\n    int w = a + b;\n    int x = b + c;\n    int y = c + d;\n    int z = d + a;\n    return (w ^ x) + (y ^ z) + (w & y) + (x & z);\n}\n",
  solution:
    "int scratch(int a, int b, int c, int d)\n{\n    int w = a + b;\n    int x = b + c;\n    int y = c + d;\n    int z = d + a;\n    return (w ^ x) + (y ^ z) + (w & y) + (x | z);\n}\n",
  symbol: "scratch",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "The first sum goes to $t0. It cannot go into $a0, because the fourth sum still needs a, and no other argument register is free yet.",
      manualEntry: "abi.saved-registers",
    },
    {
      range: { start: 1, end: 4 },
      text: "The other three sums overwrite argument registers, because by then each argument's last use is this row.",
      manualEntry: "matching.register-reuse",
    },
  ],
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "Why $t0 and not an argument register. Follow when each argument is last read.",
      skill: "MIPS.REGISTER.SCRATCH",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "w = a + b. Both a and b are still needed afterwards: b by the next sum and a by the fourth. So the result cannot replace either, and goes to $t0.",
        },
        {
          range: { start: 1, end: 2 },
          text: "x = b + c. This is b's last use, so the result can replace it in $a1.",
        },
        {
          range: { start: 2, end: 4 },
          text: "The last two sums replace c and d in the same way. The fourth one reads a, which is why the first sum could not take $a0.",
        },
        {
          text: "Nothing here is saved or restored, because nothing here outlives a call. A function that called something would have had to keep these in $s registers instead.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. One row uses a different instruction, and the rest match.",
    },
    {
      stage: 2,
      text: "The highlighted row combines the second and fourth sums. It is an or in the target.",
      highlight: { start: 9, end: 10 },
    },
    {
      stage: 3,
      text: "Where the sums live does not change with the operator. $t0 appears because of when the arguments are last read, which your source already gets right.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 4,
      text: "Change the last operator on the return line.",
    },
    {
      stage: 9,
      text: "Combine x and z with |.",
      revealSolution: true,
    },
  ],
  difficulty: callDifficulty(12, 1, 1, 1),
};
