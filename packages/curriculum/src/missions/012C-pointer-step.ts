import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const pointerStep: MissionDraft = {
  schemaVersion: 1,
  id: "012C",
  title: "POINTER STEP",
  phase: "Types and layout",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.ARRAY", "C.INTEGER.WIDTH"],
  teaches: ["C.POINTER.ARITHMETIC"],
  practices: [],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("pointer_step.c"),
  briefing: {
    objective: "Return the address a few ints past a pointer.",
    newTechnique:
      "p + n moves n elements, not n bytes: the compiler multiplies n by the size of what p points to.",
  },
  terms: [
    "glossary.pointer",
    "glossary.element",
    "glossary.array",
    "glossary.addiu",
  ],
  starterSource: "int *pointer_step(int *words)\n{\n    return words;\n}\n",
  solution: "int *pointer_step(int *words)\n{\n    return words + 3;\n}\n",
  symbol: "pointer_step",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "0xC is 12 bytes: three ints of 4 bytes each. For a char *text, text + 3 would add 3.",
      manualEntry: "c.pointer-arithmetic",
      skill: "C.POINTER.ARITHMETIC",
    },
  ],
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "The caller passes the address of an array and gets back the address of its element 3. Only an address is returned: no int is copied, and words itself does not change. Values are illustrative.",
      skill: "C.POINTER.ARITHMETIC",
      code: "int table[8];\nint *third = pointer_step(table);\n/* third == &table[3] */",
      rows: [
        {
          name: "$a0",
          before: 0x1000,
          after: 0x1000,
          note: "words, the address of table[0]",
        },
        {
          name: "$v0",
          after: 0x100c,
          note: "words + 3: three ints, 12 bytes, further on",
        },
        { name: "third", after: 0x100c, note: "&table[3]" },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target returns an address computed from the pointer argument.",
    },
    {
      stage: 2,
      text: "addiu $v0,$a0,0xC runs in jr's delay slot and returns the address in $a0 plus 12.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "Adding n to an int pointer moves n ints, which is n × 4 bytes. The listing shows the byte count.",
    },
    {
      stage: 4,
      text: "Write the step in elements, not bytes: words + 12 would move 48 bytes.",
    },
    {
      stage: 9,
      text: "Return the address 3 ints past words.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(2, 1),
};
