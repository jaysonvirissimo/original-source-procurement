import {
  conditionsDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const unsignedTest: MissionDraft = {
  schemaVersion: 1,
  id: "026",
  title: "UNSIGNED TEST",
  phase: "Conditions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["MIPS.COMPARE", "MIPS.LOAD.SIGNEDNESS"],
  teaches: ["MIPS.COMPARE.SIGNEDNESS"],
  practices: ["MIPS.COMPARE", "MATCH.SIGNEDNESS"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("unsigned_test.c"),
  briefing: {
    objective:
      "The body already asks the right question and the listing still differs by one instruction. Change what the parameters are declared as, not what the function does.",
    newTechnique:
      "Below means one thing for signed values and another for unsigned ones, so there are two instructions and the declared types pick between them. It is the rule you already know from loads, asked about a test.",
  },
  terms: [
    "glossary.slt",
    "glossary.condition",
    "glossary.sign-extension",
    "glossary.twos-complement",
  ],
  starterSource: "int unsigned_test(int a, int b)\n{\n    return a < b;\n}\n",
  solution:
    "int unsigned_test(unsigned int a, unsigned int b)\n{\n    return a < b;\n}\n",
  symbol: "unsigned_test",
  walkthroughs: [
    {
      kind: "bits",
      caption:
        "The same 32 bits, asked about two ways. Read as signed the top bit means negative, so the value is below 1. Read as unsigned nothing is negative, so the same bits are far above 1. Values are illustrative.",
      skill: "MIPS.COMPARE.SIGNEDNESS",
      rows: [
        { label: "a", width: 32, value: 0xffffffff },
        {
          label: "read as signed = -1",
          width: 32,
          value: 0xffffffff,
          derive: { op: "sign-extend", from: 0 },
        },
        {
          label: "read as unsigned = 4294967295",
          width: 32,
          value: 0xffffffff,
          derive: { op: "zero-extend", from: 0 },
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. It returns the right answer for ordinary numbers and still does not match, because the instruction in the highlighted row is the signed one and the target's is not.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 2,
      text: "The two instructions differ by one letter. The comparison shows both side by side but does not name the problem for you, so read the mnemonics: the target's ends in u.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "Nothing in the body decides this. A test reads its operands as whatever they were declared to be, so the fix is in the parameter list, the way a load's width and signedness come from a field's declaration.",
    },
    {
      stage: 4,
      text: "Keep the body exactly as it is. Change both parameters to the unsigned form of the same type.",
    },
    {
      stage: 9,
      text: "Declare both parameters unsigned int and leave the body alone.",
      revealSolution: true,
    },
  ],
  difficulty: conditionsDifficulty(2, 1),
};
