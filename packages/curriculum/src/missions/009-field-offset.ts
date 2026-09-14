import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCT = "struct Obj\n{\n    int a;\n    int b;\n    int c;\n};\n\n";

export const fieldOffset: MissionDraft = {
  schemaVersion: 1,
  id: "009",
  title: "FIELD OFFSET",
  phase: "Memory",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.POINTER.DEREFERENCE"],
  teaches: ["C.STRUCT.FIELD"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("field_offset.c"),
  briefing: {
    objective: "Read a field at a non-zero offset from a provided struct.",
    newTechnique:
      "o->field reads memory at the field's offset from the address in o.",
  },
  starterSource: `${STRUCT}int field_offset(struct Obj *o)\n{\n    return o->a;\n}\n`,
  solution: `${STRUCT}int field_offset(struct Obj *o)\n{\n    return o->c;\n}\n`,
  symbol: "field_offset",
  hints: [
    {
      stage: 1,
      text: "The target reads one int field of the struct that o points to.",
    },
    {
      stage: 2,
      text: "lw $v0,0x8($a0) reads 32 bits at offset 8 from the address in $a0.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "Each int takes 4 bytes, so a is at offset 0, b at 4, and c at 8.",
    },
    {
      stage: 4,
      text: "Read the field whose offset matches the lw.",
    },
    {
      stage: 9,
      text: "Return the field c.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 1),
};
