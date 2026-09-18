import {
  callDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const fifthArgument: MissionDraft = {
  schemaVersion: 1,
  id: "044",
  title: "FIFTH ARGUMENT",
  phase: "Functions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["ABI.FRAME"],
  teaches: ["ABI.STACK"],
  practices: ["ABI.CALL", "ABI.FRAME", "ABI.ARGUMENT"],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("fifth_argument.c"),
  briefing: {
    objective:
      "Call mix with five arguments: the first, the second, the first, the second, and the first again. The starting source gets the last one wrong, and it is the only one you cannot see in a register.",
    newTechnique:
      "There are four argument registers. A fifth argument goes into the caller's own frame, 16 bytes up from $sp, just above the argument area, where the called function knows to look.",
  },
  terms: [
    "glossary.a0",
    "glossary.sp",
    "glossary.stack-frame",
    "glossary.jal",
    "glossary.sw",
  ],
  starterSource:
    "int mix(int a, int b, int c, int d, int e);\n\nint fifth_argument(int a, int b)\n{\n    return mix(a, b, a, b, b);\n}\n",
  solution:
    "int mix(int a, int b, int c, int d, int e);\n\nint fifth_argument(int a, int b)\n{\n    return mix(a, b, a, b, a);\n}\n",
  symbol: "fifth_argument",
  annotations: [
    {
      range: { start: 1, end: 3 },
      text: "The third and fourth arguments, copied into $a2 and $a3. The first two are already in $a0 and $a1.",
      manualEntry: "abi.arguments",
    },
    {
      range: { start: 5, end: 6 },
      text: "The fifth argument, stored at $sp + 0x10 in the call's delay slot. mix will read it from there.",
      manualEntry: "abi.arguments",
    },
  ],
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "The five arguments on their way to mix, with illustrative values: a is 3 and b is 4.",
      skill: "ABI.STACK",
      code: "int r = fifth_argument(3, 4);",
      rows: [
        { name: "$a0", before: 3, after: 3, note: "argument 1: a" },
        { name: "$a1", before: 4, after: 4, note: "argument 2: b" },
        { name: "$a2", after: 3, note: "argument 3: a again" },
        { name: "$a3", after: 4, note: "argument 4: b again" },
        {
          name: "$sp + 0x10",
          after: 3,
          note: "argument 5: a, in this function's frame",
        },
      ],
    },
    {
      kind: "operands",
      caption:
        "The fifth argument read part by part. It is an ordinary store; only where it goes makes it an argument.",
      skill: "ABI.STACK",
      word: 5,
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. One store differs, and only in which register it stores.",
    },
    {
      stage: 2,
      text: "The highlighted row writes to $sp + 0x10, the fifth argument's place. The register it stores is the value the fifth argument has to be.",
      highlight: { start: 5, end: 6 },
    },
    {
      stage: 3,
      text: "$a0 still holds the first argument when that row runs; $a1 holds the second.",
    },
    {
      stage: 4,
      text: "Change only the last argument of the call.",
    },
    {
      stage: 9,
      text: "Pass a as the fifth argument.",
      revealSolution: true,
    },
  ],
  difficulty: callDifficulty(10, 3, 5, 2, 2),
};
