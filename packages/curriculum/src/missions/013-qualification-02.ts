import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

/*
 * One header, so the player reads declarations the way a field mission's
 * Context panel shows them rather than from the top of their own source.
 * Row is padded: tag is one byte, span needs an even address, and total
 * needs a multiple of four, so a Row spans eight bytes. Frame therefore
 * holds its array in twenty-four bytes, and active follows it.
 */
const HEADER =
  "typedef struct\n{\n    char tag;\n    short span;\n    int total;\n} Row;\n\ntypedef struct\n{\n    int count;\n    Row rows[3];\n    Row *active;\n} Frame;\n";

const INCLUDE = '#include "qual_types.h"\n\n';

export const qualification02: MissionDraft = {
  schemaVersion: 1,
  id: "013",
  title: "QUALIFICATION 02",
  phase: "Types and layout",
  kind: "synthesis",
  source: { kind: "synthetic" },
  requires: [],
  teaches: [],
  practices: [
    "C.TYPEDEF",
    "C.ARRAY",
    "C.STRUCT.FIELD",
    "C.STRUCT.NESTED",
    "C.STRUCT.LAYOUT",
    "C.INTEGER.WIDTH",
    "C.POINTER.DEREFERENCE",
    "C.POINTER.ARITHMETIC",
    "MIPS.LOAD.WORD",
  ],
  scaffold: "independent",
  completion: "exact",
  compiler: trainingCompiler("qualification_02.c", {
    "qual_types.h": HEADER,
  }),
  briefing: {
    objective:
      "Read a half-width field of the second element of the array a pointer inside Frame refers to. Every offset in the target follows from the declarations: work each one out before you write anything. Open Context to read them.",
  },
  terms: [
    "glossary.typedef",
    "glossary.header",
    "glossary.array",
    "glossary.element",
    "glossary.embedded-struct",
    "glossary.padding",
    "glossary.alignment",
    "glossary.short",
    "glossary.pointer",
    "glossary.offset",
    "glossary.nop",
  ],
  contextTypes: ["Frame", "Row"],
  starterSource: `${INCLUDE}short frame_span(Frame *f)\n{\n    return f->rows[0].span;\n}\n`,
  solution: `${INCLUDE}short frame_span(Frame *f)\n{\n    return f->active[1].span;\n}\n`,
  symbol: "frame_span",
  example: {
    caption:
      "f holds 0x2000. count takes the first four bytes. rows is three Rows of eight bytes each, so it fills 0x4 to 0x1B, and active follows at 0x1C. active holds 0x5000, where a run of Rows starts. Inside a Row, tag takes one byte, one byte is skipped so span lands on an even address, and total starts at the next multiple of four. Values are illustrative.",
    skill: "C.STRUCT.LAYOUT",
    registers: [{ register: "$a0", value: 0x2000, note: "f" }],
    regions: [
      {
        label: "Frame",
        address: 0x2000,
        cells: [
          { offset: 0, size: 4, label: "count", value: 3 },
          { offset: 0x4, size: 2, label: "rows[0].span", value: 11 },
          { offset: 0xc, size: 2, label: "rows[1].span", value: 22 },
          { offset: 0x14, size: 2, label: "rows[2].span", value: 33 },
          {
            offset: 0x1c,
            size: 4,
            label: "active",
            value: 0x5000,
            pointsTo: "Row",
          },
        ],
      },
      {
        label: "Row",
        address: 0x5000,
        cells: [
          { offset: 0, size: 1, label: "[0].tag", value: 1 },
          { offset: 2, size: 2, label: "[0].span", value: 44 },
          { offset: 4, size: 4, label: "[0].total", value: 400 },
          { offset: 8, size: 1, label: "[1].tag", value: 2 },
          { offset: 0xa, size: 2, label: "[1].span", value: 55 },
          { offset: 0xc, size: 4, label: "[1].total", value: 500 },
        ],
      },
    ],
  },
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "Where the address comes from. The caller owns the Rows; Frame only points at them, so the function reaches them in two steps. Values are illustrative.",
      skill: "C.STRUCT.NESTED",
      code: `/* qual_types.h */\n${HEADER}\n/* caller */\n${INCLUDE}Row batch[2];\nFrame frame;\n\nbatch[1].span = 55;\nframe.active = batch;\n\nshort span = frame_span(&frame);`,
      rows: [
        {
          name: "batch",
          after: 0x5000,
          note: "Two Rows the caller owns. The array lives here, not inside Frame.",
        },
        {
          name: "frame.active",
          after: 0x5000,
          note: "Assigning an array name stores its address. The Rows do not move.",
        },
        {
          name: "$a0",
          before: 0x2000,
          note: "The address of frame, so the first step reads active out of it.",
        },
        {
          name: "batch[1].span",
          before: 55,
          after: 55,
          note: "Reached by stepping one whole element past the address in active.",
        },
        { name: "$v0", after: 55, note: "The same value, returned." },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Two steps reach the value. The first reads a pointer out of the struct the argument points at. The second reads a half-width field through that pointer, past one whole element.",
    },
    {
      stage: 2,
      text: "The highlighted row loads the pointer. Its offset is where active sits, which is after count and after all three elements of rows. Work out how many bytes one Row takes before you decide.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "The highlighted rows wait for that load, then read two bytes through it. The offset counts one whole element, then the position of span inside an element. A byte is skipped after tag so that span starts on an even address.",
      highlight: { start: 1, end: 3 },
    },
    {
      stage: 4,
      text: "The body is one return of a half-width field, reached by following a pointer held in the struct and then stepping one element along. There is no local variable, no arithmetic you write yourself, and no condition.",
    },
    {
      stage: 9,
      text: "Return span of the element after the one active points at.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(5, 2),
};
