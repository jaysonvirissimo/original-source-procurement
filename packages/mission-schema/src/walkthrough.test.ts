import { describe, expect, it } from "vitest";
import { MissionSchema } from "./mission.ts";
import { issuesOf, realMission, syntheticMission } from "./testing.ts";
import { derivedBits, type MissionWalkthrough } from "./walkthrough.ts";

function issues(walkthroughs: MissionWalkthrough[]) {
  return issuesOf(MissionSchema, syntheticMission({ walkthroughs }));
}

const trace: MissionWalkthrough = {
  kind: "trace",
  caption: "The jump is prepared, the next word runs, then the caller resumes.",
  skill: "ABI.RETURN",
  steps: [
    { range: { start: 0, end: 1 }, text: "The jump is prepared." },
    { range: { start: 1, end: 2 }, text: "The delay slot runs." },
    { text: "The caller resumes." },
  ],
};

const shift: MissionWalkthrough = {
  kind: "bits",
  caption: "5 shifted left by 3 is 40.",
  rows: [
    { label: "a = 5", width: 8, value: 0b0000_0101 },
    {
      label: "a << 3 = 40",
      width: 8,
      value: 0b0010_1000,
      derive: { op: "shl", from: 0, amount: 3 },
    },
  ],
};

const widening: MissionWalkthrough = {
  kind: "bits",
  caption: "0xFD widened both ways.",
  rows: [
    { label: "byte", width: 8, value: 0xfd },
    {
      label: "sign-extended",
      width: 32,
      value: 0xffff_fffd,
      derive: { op: "sign-extend", from: 0 },
    },
    {
      label: "zero-extended",
      width: 32,
      value: 0xfd,
      derive: { op: "zero-extend", from: 0 },
    },
  ],
};

describe("walkthroughs", () => {
  it.each<[string, MissionWalkthrough]>([
    ["a trace", trace],
    ["a shift", shift],
    ["widening", widening],
    [
      "a timeline",
      {
        kind: "timeline",
        caption: "Two kinds of delay.",
        lanes: [
          {
            label: "branch",
            steps: [{ range: { start: 1, end: 2 }, text: "nop" }],
          },
          { label: "load", steps: [{ text: "described only" }] },
        ],
      },
    ],
    [
      "a caller table",
      {
        kind: "caller",
        caption: "argument_zero(7) returns 7.",
        code: "int r = argument_zero(7);",
        rows: [
          { name: "$a0", before: 7, after: 7 },
          { name: "$v0", after: 7, note: "the return value" },
        ],
      },
    ],
    ["operands", { kind: "operands", caption: "Word 0.", word: 0 }],
  ])("accepts %s", (_name, walkthrough) => {
    expect(issues([walkthrough])).toEqual([]);
  });

  it.each<[string, MissionWalkthrough, string, string]>([
    [
      "a skill the mission does not list",
      { ...trace, skill: "MIPS.LOAD.WORD" },
      "walkthroughs.0.skill",
      "A walkthrough's skill must be one the mission teaches or practices.",
    ],
    [
      "a trace step past the target",
      {
        ...trace,
        steps: [
          { text: "start" },
          { range: { start: 1, end: 3 }, text: "past" },
        ],
      },
      "walkthroughs.0.steps.1.range",
      "A walkthrough step must stay inside the target function.",
    ],
    [
      "a timeline step past the target",
      {
        kind: "timeline",
        caption: "c",
        lanes: [
          { label: "l", steps: [{ range: { start: 2, end: 3 }, text: "t" }] },
        ],
      },
      "walkthroughs.0.lanes.0.steps.0.range",
      "A walkthrough step must stay inside the target function.",
    ],
    [
      "repeated lane labels",
      {
        kind: "timeline",
        caption: "c",
        lanes: [
          { label: "l", steps: [{ text: "a" }] },
          { label: "l", steps: [{ text: "b" }] },
        ],
      },
      "walkthroughs.0.lanes",
      "Each lane has its own label.",
    ],
    [
      "a value wider than its row",
      {
        kind: "bits",
        caption: "c",
        rows: [{ label: "b", width: 8, value: 0x100 }],
      },
      "walkthroughs.0.rows.0.value",
      "A bit row's value must fit its width.",
    ],
    [
      "a derived value that does not follow",
      {
        kind: "bits",
        caption: "c",
        rows: [
          { label: "a", width: 8, value: 5 },
          {
            label: "b",
            width: 8,
            value: 41,
            derive: { op: "shl", from: 0, amount: 3 },
          },
        ],
      },
      "walkthroughs.0.rows.1.value",
      "A derived row's value must follow from its source row.",
    ],
    [
      "a derivation from a later row",
      {
        kind: "bits",
        caption: "c",
        rows: [
          {
            label: "a",
            width: 8,
            value: 5,
            derive: { op: "zero-extend", from: 1 },
          },
          { label: "b", width: 8, value: 5 },
        ],
      },
      "walkthroughs.0.rows.0.derive",
      "A derived row follows an earlier row that is no wider.",
    ],
    [
      "an extension to a narrower row",
      {
        kind: "bits",
        caption: "c",
        rows: [
          { label: "a", width: 16, value: 5 },
          {
            label: "b",
            width: 8,
            value: 5,
            derive: { op: "sign-extend", from: 0 },
          },
        ],
      },
      "walkthroughs.0.rows.1.derive",
      "A derived row follows an earlier row that is no wider.",
    ],
    [
      "repeated caller names",
      {
        kind: "caller",
        caption: "c",
        code: "f();",
        rows: [{ name: "x" }, { name: "x" }],
      },
      "walkthroughs.0.rows",
      "Each caller row has its own name.",
    ],
    [
      "an operand word past the target",
      { kind: "operands", caption: "c", word: 2 },
      "walkthroughs.0.word",
      "The labeled word must be inside the target function.",
    ],
  ])("rejects %s", (_name, walkthrough, path, message) => {
    expect(issues([walkthrough])).toEqual([{ path, message }]);
  });

  it("rejects walkthroughs on a mission with a remote target", () => {
    expect(
      issuesOf(MissionSchema, realMission({ walkthroughs: [trace] })),
    ).toContainEqual({
      path: "walkthroughs",
      message: "Only missions with an inline target carry walkthroughs.",
    });
  });

  it.each([
    [{ width: 8, value: 0x7f }, "sign-extend", 32, 0x7f],
    [{ width: 8, value: 0x80 }, "sign-extend", 16, 0xff80],
    [{ width: 16, value: 0xfffd }, "sign-extend", 32, 0xffff_fffd],
    [{ width: 8, value: 0xfd }, "zero-extend", 32, 0xfd],
  ] as const)("extends %o by %s to %i bits", (source, op, width, expected) => {
    expect(derivedBits(source, { op, from: 0 }, width)).toBe(expected);
  });

  it("drops bits shifted past the row width", () => {
    expect(
      derivedBits(
        { width: 32, value: 0xf000_0001 },
        { op: "shl", from: 0, amount: 4 },
        32,
      ),
    ).toBe(0x10);
  });
});
