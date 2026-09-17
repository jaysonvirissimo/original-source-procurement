import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const STRUCTS =
  "struct Pair16\n{\n    short a;\n    short b;\n};\n\nstruct Mixed\n{\n    char tag;\n    int count;\n    short span;\n    struct Pair16 in;\n};\n\n";

export const padding: MissionDraft = {
  schemaVersion: 1,
  id: "012B",
  title: "PADDING",
  phase: "Types and layout",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.INTEGER.WIDTH", "C.STRUCT.NESTED", "C.ARRAY"],
  teaches: ["C.STRUCT.LAYOUT"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("padding.c"),
  briefing: {
    objective:
      "Read a field of a struct embedded inside another, where padding moves the offsets.",
    newTechnique:
      "Each field starts at a multiple of its alignment. Skipped bytes are padding, so an offset is not always the sum of the sizes before it.",
  },
  terms: [
    "glossary.padding",
    "glossary.alignment",
    "glossary.embedded-struct",
    "glossary.short",
  ],
  contextTypes: ["struct Mixed", "struct Pair16"],
  starterSource: `${STRUCTS}int padding(struct Mixed *m)\n{\n    return m->span;\n}\n`,
  solution: `${STRUCTS}int padding(struct Mixed *m)\n{\n    return m->in.b;\n}\n`,
  symbol: "padding",
  example: {
    caption:
      "m holds 0x2000. tag takes 1 byte at +0. count is an int, aligned to 4, so it starts at +4 and bytes +1 to +3 are padding. span is a short at +8. in is embedded: its a and b sit inside struct Mixed at +0xA and +0xC. Adding sizes alone, 1 + 4 + 2 + 2, would put b at +9. Values are illustrative.",
    skill: "C.STRUCT.LAYOUT",
    registers: [{ register: "$a0", value: 0x2000, note: "m" }],
    regions: [
      {
        label: "struct Mixed",
        address: 0x2000,
        cells: [
          { offset: 0, size: 1, label: "tag", value: 7 },
          { offset: 4, size: 4, label: "count", value: 100 },
          { offset: 8, size: 2, label: "span", value: 3 },
          { offset: 0xa, size: 2, label: "in.a", value: 10 },
          { offset: 0xc, size: 2, label: "in.b", value: -20 },
        ],
      },
    ],
  },
  hints: [
    {
      stage: 1,
      text: "The target reads a short from the struct embedded in Mixed.",
    },
    {
      stage: 2,
      text: "lh $v0,0xC($a0) loads 16 bits at offset 12.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "tag is at 0. count is an int, so it starts at the next multiple of 4, offset 4, after 3 padding bytes. span is at 8, and in starts at 10.",
    },
    {
      stage: 4,
      text: "in is embedded, not a pointer, so its fields sit inside Mixed and you reach them with a dot: b is at 10 + 2.",
    },
    {
      stage: 9,
      text: "Return field b of the embedded struct in.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 2),
};
