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
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification.c"),
  briefing: {
    objective: "Copy a byte field into a word field through two pointers.",
  },
  starterSource: `${STRUCTS}void qualification(struct Holder *h)\n{\n}\n`,
  solution: `${STRUCTS}void qualification(struct Holder *h)\n{\n    h->inner->x = h->inner->level;\n}\n`,
  symbol: "qualification",
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
