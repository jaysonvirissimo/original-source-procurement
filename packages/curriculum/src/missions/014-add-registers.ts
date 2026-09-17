import {
  translationDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const addRegisters: MissionDraft = {
  schemaVersion: 1,
  id: "014",
  title: "ADD REGISTERS",
  phase: "Arithmetic",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.ARITH.ADD_IMMEDIATE"],
  teaches: ["MIPS.ARITH.ADD"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("add_registers.c"),
  briefing: {
    objective: "Add two arguments together and return the sum.",
    newTechnique:
      "Adding a register to a register uses a different instruction from adding a constant. It carries no constant at all, so all three of its operands are registers.",
  },
  terms: ["glossary.addu", "glossary.addiu", "glossary.a0", "glossary.v0"],
  starterSource: "int add_registers(int a, int b)\n{\n    return a;\n}\n",
  solution: "int add_registers(int a, int b)\n{\n    return a + b;\n}\n",
  symbol: "add_registers",
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "Where the two values come from. Both arguments arrive in registers, and the sum leaves in the return register. Values are illustrative.",
      skill: "MIPS.ARITH.ADD",
      code: "int total = add_registers(7, 5);",
      rows: [
        { name: "$a0", before: 7, note: "the first argument, a" },
        { name: "$a1", before: 5, note: "the second argument, b" },
        { name: "$v0", after: 12, note: "the sum, returned" },
        { name: "total", after: 12 },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target adds the two arguments and returns the result. Nothing is loaded, stored, or shifted.",
    },
    {
      stage: 2,
      text: "The highlighted row is the whole body. Read its three operands: a destination and two sources, all registers. Compare it with the instruction mission 003 used, which had a constant as its last operand.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "It sits after the return, in the delay slot, so it still runs. The starting source already returns one argument; the difference is the second source operand.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 4,
      text: "The body is one return of a sum of both parameters. No local variable, no constant, no condition.",
    },
    {
      stage: 9,
      text: "Return the two arguments added together.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(2),
};
