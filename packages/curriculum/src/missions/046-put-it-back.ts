import {
  callDifficulty,
  trainingCompiler,
  type MissionDraft,
} from "./authoring.ts";

const SOURCE =
  "int helper(int x);\n\nint put_it_back(int a, int b, int c)\n{\n    int s = helper(a);\n    s = s + b;\n    return s + c;\n}\n";

export const putItBack: MissionDraft = {
  schemaVersion: 1,
  id: "046",
  title: "PUT IT BACK",
  phase: "Functions",
  kind: "prediction",
  source: { kind: "synthetic" },
  requires: ["MIPS.REGISTER.SAVED"],
  teaches: ["ABI.SAVED_REGISTER"],
  practices: ["MIPS.REGISTER.SAVED", "ABI.FRAME", "ABI.CALL"],
  scaffold: "guided",
  completion: "prediction-recorded",
  compiler: trainingCompiler("put_it_back.c"),
  briefing: {
    objective:
      "Predict why this function stores $s0 and $s1 at the top and loads them back at the bottom, when its own values in them are never needed again after the additions.",
    newTechnique:
      "$s0 to $s7 come with a promise: a function that uses one must give it back as it found it. That promise is what made $s0 safe across a call in the last mission, and keeping it costs a store at the top and a load at the bottom for each one, the loads in the reverse order of the stores.",
  },
  terms: [
    "glossary.s0",
    "glossary.prologue",
    "glossary.stack-frame",
    "glossary.sp",
    "glossary.jal",
  ],
  starterSource: SOURCE,
  solution: SOURCE,
  symbol: "put_it_back",
  prediction: {
    question:
      "The last two rows before the return load $s1 and $s0 back from the frame. Why must this function do that?",
    choices: [
      "Because helper overwrote them, and this function still needs b and c",
      "Because whoever called this function may be keeping its own values in $s0 and $s1",
      "Because the assembler always adds them to a function with a frame",
      "Because $s registers cannot be written without being stored first",
    ],
    answer: 1,
    revealedBy:
      "By the time those loads run, b and c have already been added in, so this function no longer needs either register. The loads put back what was in them before this function started, which only its caller can want.",
  },
  annotations: [
    {
      range: { start: 1, end: 4 },
      text: "The caller's $s0 and $s1 are stored before this function puts b and c in them.",
      manualEntry: "abi.saved-registers",
    },
    {
      range: { start: 10, end: 12 },
      text: "The caller's values loaded back, $s1 first and $s0 last: the reverse of the stores, like brackets closing.",
      manualEntry: "abi.saved-registers",
    },
  ],
  walkthroughs: [
    {
      kind: "trace",
      caption:
        "The same function seen from its caller, which is keeping something of its own in $s0 and $s1 across this call.",
      skill: "ABI.SAVED_REGISTER",
      steps: [
        {
          range: { start: 0, end: 5 },
          text: "The frame is made, and the caller's $s0 and $s1 are stored in it before b and c go into those registers. $ra goes in above them.",
        },
        {
          range: { start: 5, end: 9 },
          text: "helper is called with b and c safe in $s0 and $s1, and both are added to its answer.",
        },
        {
          range: { start: 9, end: 12 },
          text: "Now this function is finished with b and c. The loads put back the caller's values, in the reverse order they were stored.",
        },
        {
          text: "So the caller finds $s0 and $s1 exactly as it left them, which is the same promise helper kept for this function a moment earlier.",
        },
      ],
    },
  ],
  hints: [
    {
      stage: 1,
      text: "Look at when the loads run. Everything this function wanted from $s0 and $s1 has already happened by then.",
      highlight: { start: 10, end: 12 },
    },
    {
      stage: 2,
      text: "Look at the stores at the top. They run before b and c are copied in, so what they save cannot be b or c.",
      highlight: { start: 1, end: 4 },
    },
    {
      stage: 3,
      text: "The source needs no change: it already compiles to these rows. Record your prediction, then compile and read the result against it.",
    },
  ],
  difficulty: callDifficulty(14, 3, 10, 1),
};
