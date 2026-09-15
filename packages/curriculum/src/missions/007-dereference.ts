import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const dereference: MissionDraft = {
  schemaVersion: 1,
  id: "007",
  title: "DEREFERENCE",
  phase: "Memory",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.LOAD.WORD"],
  teaches: ["C.POINTER.DEREFERENCE"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("dereference.c"),
  briefing: {
    objective: "Write the minimal C that loads the pointed-to integer.",
    newTechnique: "*p reads the value that a pointer addresses.",
  },
  starterSource: "int dereference(int *p)\n{\n    return 0;\n}\n",
  solution: "int dereference(int *p)\n{\n    return *p;\n}\n",
  symbol: "dereference",
  example: {
    caption:
      "In a declaration, int *p says p holds an address. In an expression, *p reads what is stored there. Here p is 0x1000, so *p is 42, and returning p itself would return 0x1000.",
    skill: "C.POINTER.DEREFERENCE",
    registers: [{ register: "$a0", value: 0x1000, note: "p" }],
    regions: [
      {
        label: "int at p",
        address: 0x1000,
        cells: [{ offset: 0, size: 4, label: "*p", value: 42 }],
      },
    ],
  },
  hints: [
    {
      stage: 1,
      text: "The target reads memory through the pointer argument.",
    },
    {
      stage: 2,
      text: "lw $v0,0x0($a0) reads the int at the address in $a0. Offset 0 means the address itself.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "The load is the whole body. Nothing useful is left for the delay slot of jr, so the assembler fills it with a nop.",
    },
    {
      stage: 4,
      text: "In C, *p reads the int that p points to.",
    },
    {
      stage: 9,
      text: "Return the value p points to.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 0),
};
