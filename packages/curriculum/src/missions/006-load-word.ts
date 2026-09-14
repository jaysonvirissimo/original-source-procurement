import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const SOURCE = "int load_word(int *p)\n{\n    return *p;\n}\n";

export const loadWord: MissionDraft = {
  schemaVersion: 1,
  id: "006",
  title: "LOAD WORD",
  phase: "Memory",
  kind: "demo",
  source: { kind: "synthetic" },
  requires: ["ABI.ARGUMENT"],
  teaches: ["MIPS.LOAD.WORD"],
  practices: [],
  scaffold: "guided",
  completion: "acknowledge-evidence",
  compiler: trainingCompiler("load_word.c"),
  briefing: {
    objective: "Find the instruction that reads a 32-bit value from memory.",
    newTechnique: "lw reads 32 bits from a base register plus an offset.",
  },
  starterSource: SOURCE,
  solution: SOURCE,
  symbol: "load_word",
  hints: [
    {
      stage: 1,
      text: "The function reads an int from the address held in its first argument.",
    },
    {
      stage: 2,
      text: "lw $v0,0x0($a0) reads 32 bits from the address in $a0 into $v0.",
      highlight: { start: 0, end: 1 },
    },
    {
      stage: 9,
      text: "The starting source is already complete. Compile it, find the lw, and acknowledge the evidence.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 0),
};
