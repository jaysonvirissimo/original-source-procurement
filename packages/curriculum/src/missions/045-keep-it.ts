import {
  callDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const keepIt: MissionDraft = {
  schemaVersion: 1,
  id: "045",
  title: "KEEP IT",
  phase: "Functions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["ABI.FRAME", "MIPS.REGISTER.TEMP"],
  teaches: ["MIPS.REGISTER.SAVED"],
  practices: ["ABI.CALL", "ABI.FRAME", "MATCH.SCHEDULING"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("keep_it.c"),
  briefing: {
    objective:
      "Return helper's answer plus one of the arguments. The starting source adds the wrong one, and the listing shows which argument is kept safe across the call.",
    newTechnique:
      "A called function may overwrite $a0 to $a3, $v0, $v1 and $t0 to $t9. A value needed after the call goes in $s0 to $s7 instead, which the called function has to leave exactly as it found them.",
  },
  terms: [
    "glossary.s0",
    "glossary.jal",
    "glossary.sp",
    "glossary.prologue",
    "glossary.delay-slot",
  ],
  starterSource:
    "int helper(int x);\n\nint keep_it(int a, int b)\n{\n    return helper(a) + b;\n}\n",
  solution:
    "int helper(int x);\n\nint keep_it(int a, int b)\n{\n    return helper(a) + a;\n}\n",
  symbol: "keep_it",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "The caller's $s0 is stored in the frame before this function uses it. The next mission is about why.",
      manualEntry: "abi.saved-registers",
    },
    {
      range: { start: 4, end: 5 },
      text: "In the call's delay slot, the argument is copied into $s0. helper may overwrite $a0, but it must leave $s0 alone.",
      manualEntry: "abi.saved-registers",
    },
    {
      range: { start: 5, end: 6 },
      text: "After the call: helper's answer in $v0, plus the value that survived in $s0.",
      manualEntry: "abi.saved-registers",
    },
  ],
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "The argument's route around the call, with a as 5. It cannot wait in $a0, so it waits in $s0.",
      skill: "MIPS.REGISTER.SAVED",
      steps: [
        {
          range: { start: 3, end: 5 },
          text: "The call, and its delay slot, which runs first: 5 is copied from $a0 into $s0. $a0 still holds 5 too, as helper's argument.",
        },
        {
          text: "helper runs. It is allowed to overwrite $a0, and it may well have, but $s0 still holds 5 when it returns.",
        },
        {
          range: { start: 5, end: 6 },
          text: "helper's answer is added to $s0. That is the only reason $s0 was needed.",
        },
        {
          range: { start: 6, end: 8 },
          text: "$ra and then the caller's own $s0 are loaded back from the frame, so the caller finds its $s0 unchanged.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. One row differs, and it is the row that decides what goes into $s0.",
    },
    {
      stage: 2,
      text: "The highlighted row copies an argument register into $s0, in the call's delay slot. Which argument register it reads is which parameter survives the call.",
      highlight: { start: 4, end: 5 },
    },
    {
      stage: 3,
      text: "The value in $s0 is used once, after the call, added to helper's answer.",
      highlight: { start: 5, end: 6 },
    },
    {
      stage: 4,
      text: "Keep the call as it is. Add the argument that $a0 held, not the one $a1 held.",
    },
    {
      stage: 9,
      text: "Add a, not b, to helper's answer.",
      revealSolution: true,
    },
  ],
  difficulty: callDifficulty(10, 3, 6, 1),
};
