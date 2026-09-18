import {
  callDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

export const theFrame: MissionDraft = {
  schemaVersion: 1,
  id: "043",
  title: "THE FRAME",
  phase: "Functions",
  kind: "training",
  source: { kind: "synthetic" },
  requires: ["ABI.CALL", "MIPS.STORE.WORD"],
  teaches: ["ABI.FRAME"],
  practices: ["ABI.CALL", "MIPS.STORE.WORD", "C.POINTER.DEREFERENCE"],
  scaffold: "guided",
  completion: "exact",
  compiler: trainingCompiler("the_frame.c"),
  briefing: {
    objective:
      "Copy the argument into a local int and pass fill the address of that local. The starting source keeps the value one int too far up in its frame; the comparison names the offset.",
    newTechnique:
      "A function that calls another makes itself a stack frame: it moves $sp down on entry, keeps $ra and anything else it needs between the old and new values, and moves $sp back before returning. A local whose address is taken lives there too, because an address has to point at memory.",
  },
  terms: [
    "glossary.sp",
    "glossary.stack-frame",
    "glossary.prologue",
    "glossary.jal",
    "glossary.sw",
    "glossary.address",
  ],
  starterSource:
    "int fill(int *p);\n\nint the_frame(int a)\n{\n    int x[2];\n    x[1] = a;\n    return fill(x);\n}\n",
  solution:
    "int fill(int *p);\n\nint the_frame(int a)\n{\n    int x;\n    x = a;\n    return fill(&x);\n}\n",
  symbol: "the_frame",
  annotations: [
    {
      range: { start: 0, end: 1 },
      text: "The prologue. $sp moves down 32 bytes, and those bytes are this function's frame until it returns.",
      manualEntry: "abi.stack-frames",
    },
    {
      range: { start: 1, end: 2 },
      text: "The local x, stored at 0x10 in the frame: just above the 16-byte argument area every caller reserves.",
      manualEntry: "abi.stack-frames",
    },
    {
      range: { start: 4, end: 5 },
      text: "The address of x, which is $sp plus 0x10, passed as fill's argument in the call's delay slot.",
      manualEntry: "abi.stack-frames",
    },
    {
      range: { start: 8, end: 9 },
      text: "The epilogue's last step, in jr's delay slot: $sp moves back up and the frame is given back.",
      manualEntry: "abi.stack-frames",
    },
  ],
  walkthroughs: [
    {
      kind: "caller",
      caption:
        "The frame with illustrative values. Suppose $sp holds 0x8000 when the function starts and a is 7. The frame is the 32 bytes just below.",
      skill: "ABI.FRAME",
      code: "int r = the_frame(7);",
      rows: [
        {
          name: "$sp",
          before: 0x8000,
          after: 0x8000,
          note: "0x7FE0 while the function runs",
        },
        { name: "x", after: 7, note: "at 0x7FF0: $sp + 0x10" },
        { name: "$ra", note: "kept at 0x7FF8: $sp + 0x18" },
        { name: "$a0", before: 7, note: "a, then 0x7FF0, the address of x" },
        { name: "r", note: "whatever fill returns" },
      ],
    },
    {
      kind: "operands",
      caption:
        "The store of x read part by part. The base is $sp, so the offset is a place in the frame.",
      skill: "ABI.FRAME",
      word: 1,
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Compile the starting source. One store differs, and only in its offset.",
    },
    {
      stage: 2,
      text: "The highlighted row stores the value into the frame. In the target it goes to 0x10, the first word above the argument area; yours goes 4 bytes higher.",
      highlight: { start: 1, end: 2 },
    },
    {
      stage: 3,
      text: "The highlighted row passes the address $sp + 0x10 to fill. The value has to be at that same address, so it must be the first int of whatever lives there.",
      highlight: { start: 4, end: 5 },
    },
    {
      stage: 4,
      text: "Use a single int local instead of the array. Copy the argument into it, and pass its address with &.",
    },
    {
      stage: 9,
      text: "Store the argument in one int local and pass &x.",
      revealSolution: true,
    },
  ],
  difficulty: callDifficulty(9, 3, 7, 2, 2),
};
