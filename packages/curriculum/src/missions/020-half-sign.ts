import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

/** The declaration is the editable part, as in the byte-width diagnosis. */
const source = (readingType: string) =>
  `struct Gauge\n{\n    int id;\n    ${readingType} reading;\n};\n\nint gauge_signed(struct Gauge *g)\n{\n    return g->reading;\n}\n`;

export const halfSign: MissionDraft = {
  schemaVersion: 1,
  id: "020",
  title: "HALF SIGN",
  phase: "Memory widths",
  kind: "diagnosis",
  source: { kind: "synthetic" },
  requires: ["MIPS.LOAD.HALF"],
  teaches: ["MIPS.LOAD.SIGNEDNESS"],
  practices: ["MATCH.SIGNEDNESS"],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("half_sign.c"),
  briefing: {
    objective:
      "The body already reads the right field at the right offset, and the listing still does not match. The struct declaration is part of your source, and you may edit it.",
    newTechnique:
      "Signedness picks the load at every width, not only at a byte. The body cannot show it, because the choice is made where the field is declared.",
  },
  terms: [
    "glossary.lh",
    "glossary.halfword",
    "glossary.sign-extension",
    "glossary.short",
  ],
  starterSource: source("short"),
  solution: source("unsigned short"),
  symbol: "gauge_signed",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "This load follows the declared type of reading, not anything in the function body.",
      manualEntry: "matching.signedness",
    },
  ],
  example: {
    caption:
      "g holds 0x2000, and reading sits at +4 whichever way it is declared. The same two bytes are 65534 read as unsigned and -2 read as signed, so only the instruction tells them apart. Values are illustrative.",
    skill: "MIPS.LOAD.SIGNEDNESS",
    registers: [{ register: "$a0", value: 0x2000, note: "g" }],
    regions: [
      {
        label: "struct Gauge",
        address: 0x2000,
        cells: [
          { offset: 0, size: 4, label: "id", value: 9 },
          { offset: 4, size: 2, label: "reading", value: 0xfffe },
        ],
      },
    ],
  },
  hints: [
    {
      stage: 1,
      text: "One instruction differs, and it is the only instruction in the body. The offset is right, the width is right, and the field is right.",
    },
    {
      stage: 2,
      text: "The highlighted row is the target's load. Compare it with the one your source produces: the two read the same 2 bytes from the same place and differ only in what they put in the top half of the register.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "The one that fills the top with zeros belongs to an unsigned field; the one that copies the sign bit belongs to a signed one. Nothing you write in the body can change which appears.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 4,
      text: "Change the declaration, not the return. This is the halfword version of the byte-width mismatch you met earlier.",
    },
    {
      stage: 9,
      text: "Declare the field unsigned.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 2),
};
