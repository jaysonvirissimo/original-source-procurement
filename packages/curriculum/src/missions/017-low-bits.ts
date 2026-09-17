import {
  translationDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const lowBits: MissionDraft = {
  schemaVersion: 1,
  id: "017",
  title: "LOW BITS",
  phase: "Arithmetic",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.ARITH.SHIFT"],
  teaches: ["C.BITMASK"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("low_bits.c"),
  briefing: {
    objective:
      "Keep the low eight bits of the argument and discard the rest. The starting source keeps too few; read the constant in the target to see how many.",
    newTechnique:
      "& keeps a bit only where both sides have it, so a constant of all-ones in the places you want acts as a filter. A constant that fits in 16 bits rides inside the instruction.",
  },
  terms: [
    "glossary.mask",
    "glossary.and",
    "glossary.bit",
    "glossary.hexadecimal",
    "glossary.byte",
  ],
  starterSource: "int low_bits(int a)\n{\n    return a & 0xF;\n}\n",
  solution: "int low_bits(int a)\n{\n    return a & 0xFF;\n}\n",
  symbol: "low_bits",
  walkthroughs: [
    {
      kind: "bits",
      caption:
        "A mask keeps a bit only where the mask also has one. With an example a of 0xB7, masking with 0xF keeps one hex digit and masking with 0xFF keeps two. Only the low 8 of the 32 bits are shown; the rest are cleared either way. Values are illustrative.",
      skill: "C.BITMASK",
      rows: [
        { label: "a = 0xB7", width: 8, value: 0xb7 },
        { label: "mask 0xF", width: 8, value: 0x0f },
        { label: "a & 0xF = 0x7", width: 8, value: 0x07 },
        { label: "mask 0xFF", width: 8, value: 0xff },
        { label: "a & 0xFF = 0xB7", width: 8, value: 0xb7 },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target keeps some of the argument's bits and clears the others. Nothing is added, loaded, or shifted.",
    },
    {
      stage: 2,
      text: "The highlighted row masks the argument. Its last operand is the mask, written in hexadecimal. Count the bits that constant sets: each hexadecimal digit of all ones is four bits.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "Your starting source already produces this instruction with a smaller constant, so only the constant differs. The comparison names the mismatch on that one row.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 4,
      text: "The body is one return of the parameter masked with a constant. Choose the constant whose set bits cover exactly the places you want to keep.",
    },
    {
      stage: 9,
      text: "Mask the argument with a constant of eight one bits.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(2),
};
