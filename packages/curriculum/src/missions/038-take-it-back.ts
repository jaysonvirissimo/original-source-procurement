import {
  loopDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const takeItBack: MissionDraft = {
  schemaVersion: 1,
  id: "038",
  title: "TAKE IT BACK",
  phase: "Loops",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["C.LOOP", "MATCH.SCHEDULING"],
  teaches: ["MATCH.LOOP_UNDO"],
  practices: [
    "MIPS.BRANCH.BACKWARD",
    "MATCH.SCHEDULING",
    "MIPS.ARITH.ADD",
    "MIPS.ARITH.SUBTRACT",
  ],
  scaffold: "assisted",
  completion: "exact",
  compiler: trainingCompiler("take_it_back.c"),
  briefing: {
    objective:
      "Add the argument to a running total, take one off it, and go round again while it is above zero, as a do/while. The starting source has the right lines in the other order, and that order is the whole difference.",
    newTechnique:
      "The back edge's delay slot runs once more on the way out of the loop. When the compiler puts real work there, the last pass does it once too often, and a row after the loop takes it back out.",
  },
  terms: [
    "glossary.back-edge",
    "glossary.delay-slot",
    "glossary.addu",
    "glossary.subu",
    "glossary.loop",
  ],
  starterSource:
    "int take_it_back(int a)\n{\n    int n = 0;\n    do {\n        a = a - 1;\n        n = n + a;\n    } while (a > 0);\n    return n;\n}\n",
  solution:
    "int take_it_back(int a)\n{\n    int n = 0;\n    do {\n        n = n + a;\n        a = a - 1;\n    } while (a > 0);\n    return n;\n}\n",
  symbol: "take_it_back",
  annotations: [
    {
      range: { start: 1, end: 2 },
      text: "The first pass's add, done once above the loop. The loop itself never comes back to this row.",
      manualEntry: "matching.loop-shape",
    },
    {
      range: { start: 4, end: 5 },
      text: "The back edge's delay slot adds the argument after it has been reduced: the next pass's add, done early.",
      manualEntry: "matching.loop-shape",
    },
    {
      range: { start: 6, end: 7 },
      text: "The last pass also ran that early add, for a pass that never happens. This row, in the return's delay slot, subtracts it back out.",
      manualEntry: "matching.loop-shape",
    },
  ],
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "One pass, with the argument starting at -3, so the loop stops straight away. That is where the extra add is easiest to see, because it is not zero.",
      skill: "MATCH.LOOP_UNDO",
      steps: [
        {
          range: { start: 0, end: 2 },
          text: "The total starts at zero and the first add runs above the loop: the total is -3.",
        },
        {
          range: { start: 2, end: 3 },
          text: "Take one off the argument: -3 becomes -4.",
        },
        {
          range: { start: 3, end: 4 },
          text: "The back edge asks whether -4 is above zero. It is not, so the branch is not taken.",
        },
        {
          range: { start: 4, end: 5 },
          text: "The delay slot runs anyway and adds -4, the add for a next pass that will never happen. The total is now -7.",
        },
        {
          range: { start: 5, end: 7 },
          text: "The return's delay slot subtracts the argument again, -4, so the total goes back to -3, which is what the C says the function returns.",
        },
        {
          text: "When the loop does go round, the early add is simply that pass's add. With a positive argument the last add is of zero, so the subtraction takes nothing away; it is still there because the compiler cannot know that in advance.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source and read both findings together. One row is missing near the top and one is missing at the very end. They come from the same decision about the body.",
    },
    {
      stage: 2,
      text: "The highlighted rows are the back edge and its delay slot. The slot adds the argument after the subtraction above has run, which is the add belonging to the next pass.",
      highlight: { start: 3, end: 5 },
    },
    {
      stage: 3,
      text: "The highlighted rows are the return and its delay slot. The subtraction there takes back the add the slot did on the final pass. Your version needs neither this nor the add at the top.",
      highlight: { start: 5, end: 7 },
    },
    {
      stage: 4,
      text: "Keep the loop and its question. Swap the two lines of the body, so the total is added to before the argument is reduced.",
    },
    {
      stage: 9,
      text: "Add first, then subtract one, inside the same do/while.",
      revealSolution: true,
    },
  ],
  difficulty: loopDifficulty(7, 7, 2),
};
