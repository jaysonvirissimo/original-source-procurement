import {
  translationDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const subtractRegisters: MissionDraft = {
  schemaVersion: 1,
  id: "015",
  title: "SUBTRACT REGISTERS",
  phase: "Arithmetic",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.ARITH.ADD"],
  teaches: ["MIPS.ARITH.SUBTRACT"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("subtract_registers.c"),
  briefing: {
    objective:
      "Subtract the second argument from the first and return the difference. The starting source subtracts a constant instead, which compiles to something worth reading before you change it.",
    newTechnique:
      "Subtracting two registers has its own instruction, and the operands keep the order of the source. Subtracting a constant does not: there is no subtract-immediate, so the compiler adds a negative one.",
  },
  terms: ["glossary.subu", "glossary.addiu", "glossary.addu", "glossary.a0"],
  starterSource:
    "int subtract_registers(int a, int b)\n{\n    return a - 5;\n}\n",
  solution: "int subtract_registers(int a, int b)\n{\n    return a - b;\n}\n",
  symbol: "subtract_registers",
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "Subtraction keeps the order of the source. The first argument is what is subtracted from, and the second is what is taken away, so swapping the parameters changes the answer. Values are illustrative.",
      skill: "MIPS.ARITH.SUBTRACT",
      code: "int left = subtract_registers(9, 4);",
      rows: [
        { name: "$a0", before: 9, note: "the first argument, a" },
        { name: "$a1", before: 4, note: "the second argument, b" },
        { name: "$v0", after: 5, note: "a minus b, returned" },
        { name: "left", after: 5, note: "b minus a would be -5" },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target subtracts one argument from the other. Compile the starting source first: subtracting a constant produces a different instruction, and seeing the difference is the point of this mission.",
    },
    {
      stage: 2,
      text: "Your first attempt shows an add carrying a negative constant, because no instruction subtracts a constant. The target's highlighted row is a true subtract, with two register sources and no constant at all.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "Read the order of its two sources. The first is what is subtracted from; the second is what is taken away. Writing the parameters the other way round compiles to the same instruction with the sources swapped, which is a different answer.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 4,
      text: "The body is one return of one parameter minus the other, in that order. No constant, no local variable, no condition.",
    },
    {
      stage: 9,
      text: "Return the first argument minus the second.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(2),
};
