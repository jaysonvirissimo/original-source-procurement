import {
  loopDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const noMultiply: MissionDraft = {
  schemaVersion: 1,
  id: "039",
  title: "NO MULTIPLY",
  phase: "Loops",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.LOOP", "C.POINTER.ARITHMETIC"],
  teaches: ["MATCH.LOOP_INDEX"],
  practices: [
    "C.LOOP",
    "C.ARRAY",
    "MIPS.LOAD.WORD",
    "MIPS.COMPARE",
    "MIPS.REGISTER.TEMP",
  ],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("no_multiply.c"),
  briefing: {
    objective:
      "Add up the first n ints of an array with a for loop and return the total. The starting source visits the wrong elements, and the comparison shows the mistake in two places at once. Edit only the for loop's header.",
    newTechnique:
      "Indexing an array inside a loop does not multiply anything. The compiler keeps a pointer that moves one element forward on every pass, so the load always reads offset 0, and the counter is left only to answer the loop's question.",
  },
  terms: [
    "glossary.array",
    "glossary.element",
    "glossary.lw",
    "glossary.slt",
    "glossary.back-edge",
    "glossary.guard",
    "glossary.temporary",
  ],
  starterSource:
    "int no_multiply(int *p, int n)\n{\n    int i;\n    int s = 0;\n    for (i = 0; i < n; i = i + 2) {\n        s = s + p[i];\n    }\n    return s;\n}\n",
  solution:
    "int no_multiply(int *p, int n)\n{\n    int i;\n    int s = 0;\n    for (i = 0; i < n; i = i + 1) {\n        s = s + p[i];\n    }\n    return s;\n}\n",
  symbol: "no_multiply",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "The guard. Because i starts at zero, i < n is the same question as whether n is above zero, so the compiler asks that instead.",
      manualEntry: "mips.loops",
    },
    {
      range: { start: 3, end: 4 },
      text: "The load always reads offset 0. It is the address in $a0 that moves, not the offset.",
      manualEntry: "matching.loop-shape",
    },
    {
      range: { start: 8, end: 9 },
      text: "The back edge's delay slot moves the pointer one int, 4 bytes, forward. This is p[i] with the multiply by 4 worked out by the compiler.",
      manualEntry: "matching.loop-shape",
    },
  ],
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "Where p and n come from, with illustrative values. The caller passes an array of three ints that happens to live at 0x3000, and its length.",
      skill: "MATCH.LOOP_INDEX",
      code: "int values[3] = {5, 7, 9};\nint r = no_multiply(values, 3);",
      rows: [
        {
          name: "values",
          before: 5,
          after: 5,
          note: "three ints from 0x3000 to 0x300B; the array itself never changes",
        },
        {
          name: "$a0",
          before: 0x3000,
          after: 0x300c,
          note: "p, stepped 4 bytes a pass",
        },
        { name: "$a1", before: 3, after: 3, note: "n" },
        { name: "$v1", after: 3, note: "i, the counter the test reads" },
        { name: "$v0", after: 21, note: "the total, returned" },
        { name: "r", after: 21 },
      ],
    },
    {
      kind: "trace",
      caption:
        "One pass through the loop with those values. The counter and the pointer move together, but only the pointer is used to reach memory.",
      skill: "MATCH.LOOP_INDEX",
      steps: [
        {
          range: { start: 3, end: 4 },
          text: "Load the int at the pointer, offset 0: 5 on the first pass.",
        },
        {
          range: { start: 4, end: 5 },
          text: "Add one to the counter. This row is i = i + 1.",
        },
        {
          range: { start: 5, end: 6 },
          text: "Add the loaded value to the total, which lives in $a2, a register borrowed as a temporary.",
        },
        {
          range: { start: 6, end: 8 },
          text: "Ask whether the counter is still below n, and go back up four rows while it is.",
        },
        {
          range: { start: 8, end: 9 },
          text: "The delay slot moves the pointer 4 bytes, to the next int, on every pass. That is p[i] advancing without a single multiply.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. Two constants differ, one by 1 and the other by 4, which is the size of one int. They are the same mistake seen twice.",
    },
    {
      stage: 2,
      text: "The highlighted row steps the counter. It adds one per pass, and this is the only place the loop's own step appears as written.",
      highlight: { start: 4, end: 5 },
    },
    {
      stage: 3,
      text: "The highlighted row steps the pointer. It moves one int per pass, which is the counter's step multiplied by the size of an element.",
      highlight: { start: 8, end: 9 },
    },
    {
      stage: 4,
      text: "Only the for loop's header needs to change: step the counter by one each pass.",
    },
    {
      stage: 9,
      text: "Step i by one, so every element is visited.",
      revealSolution: true,
    },
  ],
  difficulty: loopDifficulty(11, 8, 3, 2),
};
