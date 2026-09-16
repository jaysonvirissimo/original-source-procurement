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
    objective:
      "Compile, select the lw that reads a 32-bit value from memory, then acknowledge it.",
    newTechnique: "lw reads 32 bits from a base register plus an offset.",
  },
  terms: [
    "glossary.lw",
    "glossary.pointer",
    "glossary.address",
    "glossary.offset",
    "glossary.bit",
    "glossary.byte",
    "glossary.word",
    "glossary.nop",
    "glossary.compiler",
    "glossary.assembler",
  ],
  starterSource: SOURCE,
  solution: SOURCE,
  symbol: "load_word",
  evidence: {
    question: "Which instruction reads the int from memory?",
    range: { start: 0, end: 1 },
    retry:
      "Not that one. Look for the instruction that reads memory at an offset from the address in $a0.",
  },
  example: {
    caption:
      "p holds an address, not an int: here 0x1000. The int stored at address 0x1000 is 42. lw uses the address in $a0 to copy that 42 into $v0.",
    skill: "MIPS.LOAD.WORD",
    registers: [{ register: "$a0", value: 0x1000, note: "p" }],
    regions: [
      {
        label: "int at p",
        address: 0x1000,
        cells: [{ offset: 0, size: 4, label: "*p", value: 42 }],
      },
    ],
  },
  walkthroughs: [
    {
      kind: "operands",
      caption:
        "lw destination,offset(base). The parentheses do not call anything: they hold the base register, whose value is an address. The offset is added to that address, and memory there is read.",
      skill: "MIPS.LOAD.WORD",
      word: 0,
    },
    {
      kind: "timeline",
      caption:
        "Two kinds of nop. A nop is an instruction that does nothing. The compiler's output has none here: the assembler adds one where the machine needs a gap.",
      lanes: [
        {
          label: "Branch delay nop, in this target",
          steps: [
            {
              range: { start: 0, end: 1 },
              text: "lw reads the int into $v0. The compiler placed this load before the jump.",
            },
            {
              range: { start: 1, end: 2 },
              text: "jr $ra starts the return. The next instruction runs before the jump takes effect.",
            },
            {
              range: { start: 2, end: 3 },
              text: "Nothing is left to run in that delay slot, so the assembler filled it with a nop. In 001, addiu did useful work there instead.",
            },
          ],
        },
        {
          label: "Load delay nop, in later missions",
          steps: [
            {
              text: "A load puts its value in the register one instruction late.",
            },
            {
              text: "When the very next instruction reads that register, the assembler inserts a nop between them.",
            },
            {
              text: "Here nothing reads $v0 right after the lw, so no load delay nop is needed.",
            },
          ],
        },
      ],
    },
  ],
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
      text: "The starting source is already complete. Compile it, select the lw, and acknowledge it.",
      revealSolution: true,
    },
  ],
  difficulty: memoryDifficulty(3, 0),
};
