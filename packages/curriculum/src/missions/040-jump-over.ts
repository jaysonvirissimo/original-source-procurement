import {
  loopDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const jumpOver: MissionDraft = {
  schemaVersion: 1,
  id: "040",
  title: "JUMP OVER",
  phase: "Loops",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MATCH.SCHEDULING", "C.STORAGE.STATIC"],
  teaches: ["MIPS.JUMP"],
  practices: ["MIPS.BRANCH", "MATCH.SCHEDULING", "C.BITMASK", "C.SHIFT"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("jump_over.c"),
  briefing: {
    objective:
      "When the first argument is odd, work with one more than the second argument, and otherwise with one less; return half of it. The starting source sets a default and overrides it, which is the same program without the instruction this mission is about.",
    newTechnique:
      "j always goes, with no question asked. An if/else needs one, because when the first arm finishes something has to carry it past the second. Its destination is filled in by the linker, so the target shows 0x0.",
  },
  terms: [
    "glossary.j",
    "glossary.relocation",
    "glossary.beq",
    "glossary.path",
    "glossary.delay-slot",
    "glossary.nop",
  ],
  starterSource:
    "int jump_over(int a, int b)\n{\n    int n = b - 1;\n    if (a & 1) {\n        n = b + 1;\n    }\n    return n >> 1;\n}\n",
  solution:
    "int jump_over(int a, int b)\n{\n    int n;\n    if (a & 1) {\n        n = b + 1;\n    } else {\n        n = b - 1;\n    }\n    return n >> 1;\n}\n",
  symbol: "jump_over",
  annotations: [
    {
      range: { start: 3, end: 4 },
      text: "The jump. It reads 0x0 because the linker has not placed the code yet; the relocation behind it points at the return, three rows down.",
      manualEntry: "mips.jumps",
    },
    {
      range: { start: 4, end: 5 },
      text: "The jump's delay slot holds the first arm's work, so it runs before the jump lands and belongs to the arm above it.",
      manualEntry: "mips.delay-slots",
    },
    {
      range: { start: 5, end: 6 },
      text: "The else. Only the branch at the top ever reaches this row; the first arm always jumps over it.",
      manualEntry: "mips.jumps",
    },
  ],
  walkthroughs: [
    {
      kind: "operands",
      caption:
        "The jump read part by part. There is only one operand, and in this listing it is not the real destination yet.",
      skill: "MIPS.JUMP",
      word: 3,
    },
    {
      kind: "trace",
      caption:
        "Both arms, one after the other. Each skips something: the branch skips the first arm, and the jump skips the second.",
      skill: "MIPS.JUMP",
      steps: [
        {
          range: { start: 0, end: 1 },
          text: "Keep only the lowest bit of the first argument. Suppose it is 1: the argument is odd.",
        },
        {
          range: { start: 1, end: 3 },
          text: "The branch goes when that bit is zero, so it is not taken. Its delay slot has nothing to do and holds a nop.",
        },
        {
          range: { start: 3, end: 5 },
          text: "The jump, and its delay slot, which adds one to the second argument. The slot runs first; then the jump lands.",
        },
        {
          range: { start: 6, end: 8 },
          text: "The jump lands on the return, skipping the row between. The shift halves the value in the return's delay slot.",
        },
        {
          text: "Now suppose the argument is even. The branch is taken and goes four rows down, past the jump and its slot, to the row that subtracts one. From there the function runs straight on into the same return.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source and read the three findings as one. The target has two rows yours lacks, a nop and a jump, and the other findings are what their absence moves.",
    },
    {
      stage: 2,
      text: "The highlighted rows are the jump and its delay slot. The slot holds the first arm's work, and the jump then carries that arm past the second.",
      highlight: { start: 3, end: 5 },
    },
    {
      stage: 3,
      text: "The highlighted row is the second arm. Nothing falls into it from above, because the jump always goes, so it can only be an else.",
      highlight: { start: 5, end: 6 },
    },
    {
      stage: 4,
      text: "Write an if with an else, each setting the value, and keep the halving on the return. A default overridden by a one-armed if needs no jump, which is why the starting source has none.",
    },
    {
      stage: 9,
      text: "Set the value in both arms of an if/else, then return half of it.",
      revealSolution: true,
    },
  ],
  difficulty: loopDifficulty(8, 7, 3),
};
