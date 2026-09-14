import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCT =
  "struct Rec\n{\n    int id;\n    signed char delta;\n    unsigned char count;\n};\n\n";

export const signedByte: MissionDraft = {
  schemaVersion: 1,
  id: "010",
  title: "SIGNED BYTE",
  phase: "Memory",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.STRUCT.FIELD"],
  teaches: ["MIPS.LOAD.BYTE"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("signed_byte.c"),
  briefing: {
    objective:
      "Read a signed 8-bit field, and see how its load differs from an unsigned one.",
    newTechnique: "lb sign-extends an 8-bit load; lbu zero-extends it.",
  },
  starterSource: `${STRUCT}int signed_byte(struct Rec *r)\n{\n    return r->id;\n}\n`,
  solution: `${STRUCT}int signed_byte(struct Rec *r)\n{\n    return r->delta;\n}\n`,
  symbol: "signed_byte",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "Reading count instead would load offset 5 with lbu, because count is unsigned char. A plain char field also loads with lbu.",
      manualEntry: "mips.loads-and-stores",
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target reads one byte field of the struct that r points to.",
    },
    {
      stage: 2,
      text: "lb $v0,0x4($a0) loads 8 bits at offset 4 and sign-extends them to 32 bits.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "id takes offsets 0 to 3, so delta is at offset 4 and count at offset 5.",
    },
    {
      stage: 4,
      text: "A signed byte loads with lb and an unsigned byte with lbu. Read the field whose type and offset both match.",
    },
    {
      stage: 9,
      text: "Return the field delta.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 1),
};
