import {
  trainingCompiler,
  translationDifficulty,
  type MissionDraft,
} from "./authoring.ts";

const SOURCE = "int return_path(void)\n{\n    return 42;\n}\n";

export const returnPath: MissionDraft = {
  schemaVersion: 1,
  id: "001",
  title: "RETURN PATH",
  phase: "Translation",
  kind: "demo",
  source: { kind: "synthetic" },
  requires: [],
  teaches: ["ABI.RETURN"],
  practices: [],
  scaffold: "guided",
  completion: "acknowledge-evidence",
  compiler: trainingCompiler("return_path.c"),
  briefing: {
    objective:
      "Compile, then acknowledge the evidence: the instruction that puts the return value in $v0.",
    newTechnique: "A function returns an int in $v0.",
  },
  starterSource: SOURCE,
  solution: SOURCE,
  symbol: "return_path",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "The constant 42 lands in $v0, the register that carries the return value.",
      manualEntry: "abi.return-values",
      skill: "ABI.RETURN",
    },
  ],
  hints: [
    {
      stage: 1,
      text: "An int result leaves the function in one register, $v0.",
    },
    {
      stage: 2,
      text: "This instruction puts 42 (0x2A) into $v0. It runs in the delay slot of jr, before the return takes effect.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 9,
      text: "The starting source is already complete. Compile it, find $v0, and acknowledge the evidence.",
      revealSolution: true,
    },
  ],
  difficulty: translationDifficulty(2),
};
