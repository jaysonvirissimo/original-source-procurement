import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCTS =
  "struct Inner\n{\n    int x;\n    signed char level;\n};\n\nstruct Holder\n{\n    int pad[8];\n    struct Inner *inner;\n};\n\n";

export const qualification01: MissionDraft = {
  schemaVersion: 1,
  id: "012",
  title: "QUALIFICATION 01",
  phase: "Memory",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [],
  teaches: [],
  practices: [
    "C.POINTER.DEREFERENCE",
    "C.STRUCT.FIELD",
    "MIPS.LOAD.WORD",
    "MIPS.LOAD.BYTE",
    "MIPS.STORE.WORD",
    "C.ARRAY",
    "C.STRUCT.NESTED",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification.c"),
  briefing: {
    objective:
      "Copy a byte field into a word field of the struct that a pointer stored inside h points to.",
  },
  terms: [
    "glossary.pointer",
    "glossary.struct",
    "glossary.temporary",
    "glossary.lw",
    "glossary.lb",
    "glossary.sw",
    "glossary.nop",
  ],
  starterSource: `${STRUCTS}void qualification(struct Holder *h)\n{\n}\n`,
  solution: `${STRUCTS}void qualification(struct Holder *h)\n{\n    h->inner->x = h->inner->level;\n}\n`,
  symbol: "qualification",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "$v1 holds the inner pointer only while this function runs. The function is void and returns nothing, so the compiler is free to use $v1 and $v0 as temporaries.",
      manualEntry: "abi.return-values",
    },
  ],
  example: {
    caption:
      "h holds 0x3000. pad fills offsets 0 to 0x1F, eight 4-byte ints, so inner sits at +0x20. inner holds another address, 0x4000, where a struct Inner starts. Its x is at +0 and level at +4.",
    registers: [{ register: "$a0", value: 0x3000, note: "h" }],
    regions: [
      {
        label: "struct Holder",
        address: 0x3000,
        cells: [
          {
            offset: 0x20,
            size: 4,
            label: "inner",
            value: 0x4000,
            pointsTo: "struct Inner",
          },
        ],
      },
      {
        label: "struct Inner",
        address: 0x4000,
        cells: [
          { offset: 0, size: 4, label: "x", value: 7 },
          { offset: 4, size: 1, label: "level", value: -3 },
        ],
      },
    ],
  },
  walkthroughs: [
    {
      kind: "timeline",
      caption:
        "Why only the first load gets a nop. A loaded register is ready one instruction late, and the assembler inserts a nop only when the very next instruction reads it.",
      lanes: [
        {
          label: "This target",
          steps: [
            {
              range: { start: 0, end: 1 },
              text: "lw loads inner, an address, into $v1.",
            },
            {
              range: { start: 1, end: 2 },
              text: "The next instruction reads $v1, which is not ready yet, so the assembler inserted a load delay nop.",
            },
            {
              range: { start: 2, end: 3 },
              text: "lb reads level through $v1 into $v0. $v1 is ready now.",
            },
            {
              range: { start: 3, end: 4 },
              text: "jr $ra starts the return. It does not read $v0, so the lb needs no nop.",
            },
            {
              range: { start: 4, end: 5 },
              text: "sw runs in jr's delay slot and stores $v0 into x through $v1. jr came between lb and sw, so $v0 is ready.",
            },
          ],
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target loads a pointer from the struct, then reads and writes through that pointer.",
    },
    {
      stage: 2,
      text: "lw $v1,0x20($a0) loads the pointer at offset 32. pad takes eight ints, which is 32 bytes.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "lb $v0,0x4($v1) reads the signed byte at offset 4 of the inner struct. The nop before it waits for the load into $v1.",
      highlight: { start: 2, end: 3 },
    },
    {
      stage: 4,
      text: "sw $v0,0x0($v1) stores the byte into the int at offset 0 of the same inner struct, in the delay slot of jr.",
    },
    {
      stage: 9,
      text: "Copy level into x, both reached through inner.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(5, 2),
};
