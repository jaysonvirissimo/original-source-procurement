import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const HEADER = "typedef struct\n{\n    int kind;\n    void *data;\n} Slot;\n";

const INCLUDE = '#include "bridge_types.h"\n\n';

export const typeNames: MissionDraft = {
  schemaVersion: 1,
  id: "012D",
  title: "TYPE NAMES",
  phase: "Types and layout",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.STRUCT.FIELD"],
  teaches: ["C.TYPEDEF"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("type_names.c", { "bridge_types.h": HEADER }),
  briefing: {
    objective:
      "Return the generic pointer stored in a struct whose type is named in a header file.",
    newTechnique:
      "typedef gives a type a name, and #include pulls a header's declarations into the source.",
  },
  terms: [
    "glossary.typedef",
    "glossary.header",
    "glossary.generic-pointer",
    "glossary.void",
    "glossary.lw",
  ],
  starterSource: `${INCLUDE}void *slot_data(Slot *s)\n{\n    return 0;\n}\n`,
  solution: `${INCLUDE}void *slot_data(Slot *s)\n{\n    return s->data;\n}\n`,
  symbol: "slot_data",
  example: {
    caption:
      "bridge_types.h declares typedef struct { int kind; void *data; } Slot;. s holds 0x2000, where a Slot starts: kind at +0 and data at +4. data holds 0x3000, the address of something the function never looks at. Values are illustrative.",
    skill: "C.TYPEDEF",
    registers: [{ register: "$a0", value: 0x2000, note: "s" }],
    regions: [
      {
        label: "Slot",
        address: 0x2000,
        cells: [
          { offset: 0, size: 4, label: "kind", value: 1 },
          { offset: 4, size: 4, label: "data", value: 0x3000 },
        ],
      },
    ],
  },
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "The header's text, and a caller. Slot is a name for the struct, so Slot *s is a pointer to that struct. A void * holds any address: here, the address of an int. Returning it returns the address, not the int. Values are illustrative.",
      skill: "C.TYPEDEF",
      code: `/* bridge_types.h */\n${HEADER}\n/* caller */\n${INCLUDE}Slot slot;\nint level = 3;\nslot.data = &level;\nvoid *found = slot_data(&slot);`,
      rows: [
        { name: "$a0", before: 0x2000, note: "s = &slot" },
        {
          name: "data",
          before: 0x3000,
          after: 0x3000,
          note: "slot.data, the address of level",
        },
        { name: "$v0", after: 0x3000, note: "the same address, returned" },
        { name: "found", after: 0x3000, note: "level itself is not copied" },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target reads one pointer field of the struct that s points to.",
    },
    {
      stage: 2,
      text: "lw $v0,0x4($a0) loads the 32 bits at offset 4 from the address in $a0. They are an address.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "bridge_types.h defines Slot as a typedef for struct { int kind; void *data; }. data is the pointer at offset 4.",
    },
    {
      stage: 4,
      text: "The function returns void *, a generic pointer. Returning data returns the address it holds, not what it points to.",
    },
    {
      stage: 9,
      text: "Return the data field of the Slot that s points to.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 1),
};
