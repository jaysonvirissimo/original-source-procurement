import {
  memoryDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

/*
 * The first mission whose target carries relocations. Both constants in the
 * listing read as zero because neither is known until the linker places the
 * variable, so the comparison checks which symbol each row refers to rather
 * than the bits in those fields.
 */
const GLOBAL = "int level;\n\n";

export const staticStorage: MissionDraft = {
  schemaVersion: 1,
  id: "023",
  title: "STATIC STORAGE",
  phase: "Memory widths",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.LOAD.WORD"],
  teaches: ["C.STORAGE.STATIC"],
  practices: [],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("static_storage.c"),
  briefing: {
    objective:
      "Return the value of a variable the function was not given. It is declared outside the function, so no argument carries it and no pointer leads to it.",
    newTechnique:
      "A variable declared outside any function lives at a fixed place in memory for the whole run. The function has to build that address before it can read it, which takes an instruction of its own. Both constants in the target read as zero, because neither is decided until the program is linked.",
  },
  terms: [
    "glossary.global",
    "glossary.lui",
    "glossary.lw",
    "glossary.address",
    "glossary.relocation",
  ],
  starterSource: `${GLOBAL}int read_level(void)\n{\n    return 0;\n}\n`,
  solution: `${GLOBAL}int read_level(void)\n{\n    return level;\n}\n`,
  symbol: "read_level",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "This row builds the upper half of the variable's address. Its constant reads as zero because the address is not known yet; the linker fills both halves in once it has placed the variable.",
      manualEntry: "c.static-storage",
    },
  ],
  hints: [
    {
      stage: 1,
      text: "The target reads one variable and returns it. No argument is used, and no pointer is followed, because the variable is not passed in at all.",
    },
    {
      stage: 2,
      text: "The highlighted rows are the read. It takes two instructions, not one: the first builds an address, and the second loads a word through it. Compare that with mission 006, where the address arrived in an argument.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 3,
      text: "Both constants show as zero. That is not an offset of zero into something: it is a value the compiler cannot know, because where the variable sits is decided later. The comparison checks which variable each row names, not the zeros.",
      highlight: { start: 0, end: 2 },
    },
    {
      stage: 4,
      text: "The body is one return of the variable declared above the function. No parameter, no pointer, no local.",
    },
    {
      stage: 9,
      text: "Return the variable declared outside the function.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(4, 0),
};
