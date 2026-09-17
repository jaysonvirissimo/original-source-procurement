import {
  translationDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

/** The parameter's declared type is the editable part. */
const source = (parameterType: string) =>
  `int shift_right(${parameterType} a)\n{\n    return a >> 4;\n}\n`;

export const shiftRight: MissionDraft = {
  schemaVersion: 1,
  id: "022",
  title: "SHIFT RIGHT",
  phase: "Memory widths",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.ARITH.SHIFT"],
  teaches: ["C.SHIFT"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("shift_right.c"),
  briefing: {
    objective:
      "The expression already shifts by the right amount and still does not match. What differs is the parameter's declared type, which you may edit.",
    newTechnique:
      "Shifting right has two instructions. One fills the vacated top bits with zeros; the other copies the sign bit into them so a negative value stays negative. Which one appears depends on the type being shifted, not on the shift.",
  },
  terms: [
    "glossary.sra",
    "glossary.sll",
    "glossary.bit",
    "glossary.sign-extension",
    "glossary.twos-complement",
  ],
  starterSource: source("int"),
  solution: source("unsigned int"),
  symbol: "shift_right",
  walkthroughs: [
    {
      kind: "bits",
      caption:
        "The same 8 bits shifted right by 4 two ways. Filling with zeros gives 0xF. Copying the sign bit keeps the value negative, which is what a signed shift does so that shifting stays close to dividing. Values are illustrative.",
      skill: "C.SHIFT",
      rows: [
        { label: "a = 0xF5", width: 8, value: 0xf5 },
        { label: "unsigned, filled with zeros", width: 8, value: 0x0f },
        { label: "signed, sign copied down", width: 8, value: 0xff },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "One instruction differs, and it is the only instruction in the body. The shift amount is right and the operand is right.",
    },
    {
      stage: 2,
      text: "The highlighted row shifts right. Compare it with the one your source produces: they move the bits the same distance and differ only in what arrives at the top.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "The one that fills the top with zeros belongs to an unsigned operand. The one that copies the sign bit belongs to a signed one, so that a negative value stays negative.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 4,
      text: "Change the parameter's type, not the expression. This is the same rule you met on the loads: the declaration picks the instruction.",
    },
    {
      stage: 9,
      text: "Declare the parameter unsigned.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(2),
};
