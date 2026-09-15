import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const storeWord: MissionDraft = {
  schemaVersion: 1,
  id: "008",
  title: "STORE WORD",
  phase: "Memory",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.POINTER.DEREFERENCE"],
  teaches: ["MIPS.STORE.WORD"],
  practices: [],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("store_word.c"),
  briefing: {
    objective: "Update a pointed-to integer.",
    newTechnique: "sw writes 32 bits to a base register plus an offset.",
  },
  starterSource: "void store_word(int *p, int v)\n{\n}\n",
  solution: "void store_word(int *p, int v)\n{\n    *p = v;\n}\n",
  symbol: "store_word",
  example: {
    caption:
      "p is 0x1000 and v is 7. Before the call, the int at 0x1000 is 42. sw copies the 7 from $a1 into that memory, so afterwards *p is 7. Nothing is returned.",
    skill: "MIPS.STORE.WORD",
    registers: [
      { register: "$a0", value: 0x1000, note: "p" },
      { register: "$a1", value: 7, note: "v" },
    ],
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
      text: "The target writes the second argument through the first.",
    },
    {
      stage: 2,
      text: "sw $a1,0x0($a0) writes the value in $a1 to the address in $a0.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "The store runs in the delay slot of jr, before the return takes effect. A void function sets no $v0.",
    },
    {
      stage: 4,
      text: "Assign through the pointer: put *p on the left of =.",
    },
    {
      stage: 9,
      text: "Store v where p points.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(2, 0),
};
