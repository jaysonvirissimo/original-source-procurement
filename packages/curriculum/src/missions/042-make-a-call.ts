import {
  callDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const makeACall: MissionDraft = {
  schemaVersion: 1,
  id: "042",
  title: "MAKE A CALL",
  phase: "Functions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["ABI.ARGUMENT", "ABI.RETURN", "MIPS.JUMP"],
  teaches: ["ABI.CALL"],
  practices: ["ABI.ARGUMENT", "ABI.RETURN", "MIPS.ARITH.ADD_IMMEDIATE"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("make_a_call.c"),
  briefing: {
    objective:
      "Pass the argument to helper and return one more than its answer. The starting source already has that shape and calls the wrong function; helper and other are declared at the top and defined somewhere else, which is the linker's business, not yours.",
    newTechnique:
      "jal calls another function. It jumps there and leaves the way back in $ra, so the callee's own jr $ra returns to the row after the call. The arguments go in $a0 to $a3 and the answer comes back in $v0, the same agreement every function so far has kept from the other side.",
  },
  terms: [
    "glossary.jal",
    "glossary.ra",
    "glossary.relocation",
    "glossary.sp",
    "glossary.stack-frame",
    "glossary.delay-slot",
  ],
  starterSource:
    "int helper(int x);\nint other(int x);\n\nint make_a_call(int a)\n{\n    return other(a) + 1;\n}\n",
  solution:
    "int helper(int x);\nint other(int x);\n\nint make_a_call(int a)\n{\n    return helper(a) + 1;\n}\n",
  symbol: "make_a_call",
  annotations: [
    {
      range: { start: 0, end: 2 },
      text: "Making room and keeping $ra. The call is about to overwrite $ra, so it is put somewhere safe first. The next mission is about where.",
      manualEntry: "abi.stack-frames",
    },
    {
      range: { start: 2, end: 3 },
      text: "The call. It reads 0x0 because the linker fills in helper's address; the relocation names helper, and the comparison checks that name.",
      manualEntry: "abi.calls",
    },
    {
      range: { start: 4, end: 5 },
      text: "$ra loaded back, so this function can return to its own caller.",
      manualEntry: "abi.calls",
    },
  ],
  walkthroughs: [
    {
      kind: "operands",
      caption:
        "The call read part by part. Like j, its one operand is a destination the linker has not filled in yet.",
      skill: "ABI.CALL",
      word: 2,
    },
    {
      kind: "trace",
      caption:
        "Both sides of the call. This function's rows run, helper runs somewhere else, and then this function carries on where the call left off.",
      skill: "ABI.CALL",
      steps: [
        {
          range: { start: 0, end: 2 },
          text: "Before calling anything, $ra, which says where this function must return to, is kept safe.",
        },
        {
          range: { start: 2, end: 4 },
          text: "The argument is already in $a0, where helper expects it, so the delay slot has nothing to do. jal sets $ra to point at row 4 and goes to helper.",
        },
        {
          text: "helper runs. It finds its argument in $a0, leaves its answer in $v0, and its own jr $ra comes back here, to row 4.",
        },
        {
          range: { start: 4, end: 6 },
          text: "$ra is loaded back, and one is added to helper's answer, which is already in $v0.",
        },
        {
          range: { start: 6, end: 8 },
          text: "Return to this function's caller. The row in the delay slot gives back the room made on the first row.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. Everything matches except one row, and the finding is about which function that row calls.",
    },
    {
      stage: 2,
      text: "The highlighted row is the call. The listing shows 0x0 in both versions, so read the finding instead: it names the function the target calls.",
      highlight: { start: 2, end: 3 },
    },
    {
      stage: 3,
      text: "The rows around the call, which save $ra and load it back, are the same in both versions. Any function that calls another has them, and you do not write them.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 4,
      text: "Keep the addition. Call the other declared function instead.",
    },
    {
      stage: 9,
      text: "Call helper, not other.",
      revealSolution: true,
    },
  ],
  difficulty: callDifficulty(8, 3, 4, 2),
};
