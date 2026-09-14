import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

function source(deltaType: string): string {
  return `struct Rec\n{\n    int id;\n    ${deltaType} delta;\n    unsigned char count;\n};\n\nint wrong_sign(struct Rec *r)\n{\n    return r->delta;\n}\n`;
}

export const wrongSign: MissionDraft = {
  schemaVersion: 1,
  id: "011",
  title: "WRONG SIGN",
  phase: "Memory",
  kind: "diagnosis",
  source: { kind: "synthetic" },
  requires: ["MIPS.LOAD.BYTE"],
  teaches: ["MATCH.SIGNEDNESS"],
  practices: [],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("wrong_sign.c"),
  briefing: {
    objective: "Fix plausible source whose byte load has the wrong signedness.",
    newTechnique:
      "A field's declared type decides which load instruction reads it.",
  },
  // Plain char is unsigned in PsyQ, so the starting source loads with lbu.
  starterSource: source("char"),
  solution: source("signed char"),
  symbol: "wrong_sign",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "This load follows the declared type of delta.",
      manualEntry: "matching.signedness",
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source and compare its byte load with the target's.",
    },
    {
      stage: 2,
      text: "The target loads delta with lb. The starting source loads it with lbu.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 3,
      text: "lb sign-extends and lbu zero-extends. Plain char is unsigned in PsyQ, so it loads with lbu.",
    },
    {
      stage: 4,
      text: "The function body is already right. Change the type where delta is declared.",
    },
    {
      stage: 9,
      text: "Declare delta as signed char.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 2),
};
