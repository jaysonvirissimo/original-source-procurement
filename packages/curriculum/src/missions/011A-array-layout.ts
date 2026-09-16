import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCT = "struct Log\n{\n    int samples[4];\n    int total;\n};\n\n";

export const arrayLayout: MissionDraft = {
  schemaVersion: 1,
  id: "011A",
  title: "ARRAY LAYOUT",
  phase: "Memory",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.STRUCT.FIELD"],
  teaches: ["C.ARRAY"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("array_layout.c"),
  briefing: {
    objective: "Read one element of an int array stored inside a struct.",
    newTechnique:
      "An array places its elements back to back. Element i sits i element sizes from the start.",
  },
  terms: [
    "glossary.array",
    "glossary.element",
    "glossary.offset",
    "glossary.struct",
  ],
  starterSource: `${STRUCT}int array_layout(struct Log *l)\n{\n    return l->total;\n}\n`,
  solution: `${STRUCT}int array_layout(struct Log *l)\n{\n    return l->samples[3];\n}\n`,
  symbol: "array_layout",
  example: {
    caption:
      "l holds 0x2000. int samples[4] is four ints back to back, 16 bytes in all: samples[0] at +0, samples[1] at +4, samples[2] at +8, samples[3] at +0xC. total follows the whole array, at +0x10. Values are illustrative.",
    skill: "C.ARRAY",
    registers: [{ register: "$a0", value: 0x2000, note: "l" }],
    regions: [
      {
        label: "struct Log",
        address: 0x2000,
        cells: [
          { offset: 0, size: 4, label: "samples[0]", value: 10 },
          { offset: 4, size: 4, label: "samples[1]", value: 20 },
          { offset: 8, size: 4, label: "samples[2]", value: 30 },
          { offset: 0xc, size: 4, label: "samples[3]", value: 40 },
          { offset: 0x10, size: 4, label: "total", value: 100 },
        ],
      },
    ],
  },
  hints: [
    {
      stage: 1,
      text: "The target reads one int from the struct that l points to.",
    },
    {
      stage: 2,
      text: "lw $v0,0xC($a0) reads 32 bits at offset 12 from the address in $a0.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "samples holds four ints, 16 bytes. samples[0] is at offset 0, samples[1] at 4, samples[2] at 8, and samples[3] at 12. total comes after the array, at 16.",
    },
    {
      stage: 4,
      text: "Indexes count from 0. Divide the offset by the element size, 4, to get the index.",
    },
    {
      stage: 9,
      text: "Return element 3 of samples.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 1),
};
