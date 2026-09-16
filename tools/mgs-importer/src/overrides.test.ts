import { describe, expect, it } from "vitest";
import { parseOverrides } from "./overrides.ts";

const MISSION = {
  symbol: "sample_function",
  id: "R001",
  title: "SAMPLE FIELD WORK",
  phase: "Field work",
  kind: "real-solved",
  scaffold: "field",
  requires: ["ABI.RETURN"],
  practices: [],
  briefing: { objective: "Match the function." },
  starterSource: "void sample_function(void) {\n}\n",
  hints: [{ stage: 1, text: "Look at the return register." }],
  reviewedAt: "2026-09-15",
};

const file = (missions: unknown[]) =>
  JSON.stringify({ schemaVersion: 1, missions });

describe("parseOverrides", () => {
  it("reads a reviewed mission", () => {
    expect(parseOverrides(file([MISSION])).missions).toHaveLength(1);
  });

  it("reads an empty file", () => {
    expect(parseOverrides(file([])).missions).toEqual([]);
  });

  it("rejects text that is not JSON, keeping the cause", () => {
    expect(() => parseOverrides("{")).toThrow(/not valid JSON/);
  });

  it("rejects a synthetic mission kind", () => {
    expect(() =>
      parseOverrides(file([{ ...MISSION, kind: "training" }])),
    ).toThrow(/kind/);
  });

  it("rejects a review date that is not a calendar date", () => {
    expect(() =>
      parseOverrides(file([{ ...MISSION, reviewedAt: "yesterday" }])),
    ).toThrow(/YYYY-MM-DD/);
  });

  it("rejects an unknown field, so a typo is never ignored", () => {
    expect(() =>
      parseOverrides(file([{ ...MISSION, teaches: ["ABI.RETURN"] }])),
    ).toThrow(/not a valid overrides file/);
  });

  it("rejects two reviewed missions that share a symbol", () => {
    expect(() =>
      parseOverrides(file([MISSION, { ...MISSION, id: "R002" }])),
    ).toThrow(/share the symbol/);
  });

  it("rejects two reviewed missions that share an id", () => {
    expect(() =>
      parseOverrides(file([MISSION, { ...MISSION, symbol: "other_function" }])),
    ).toThrow(/share the id/);
  });
  it("rejects hint text that quotes target instructions", () => {
    expect(() =>
      parseOverrides(
        file([
          {
            ...MISSION,
            hints: [{ stage: 1, text: "The first row is sw $a1,0x28($a0)." }],
          },
        ]),
      ),
    ).toThrow(
      /missions.0.hints.0.text: Real-mission text names the register \$a1/,
    );
  });

  it("rejects a briefing that quotes a target value", () => {
    expect(() =>
      parseOverrides(
        file([{ ...MISSION, briefing: { objective: "Store at 0x14." } }]),
      ),
    ).toThrow(/briefing.objective: Real-mission text quotes the value 0x14/);
  });
});
