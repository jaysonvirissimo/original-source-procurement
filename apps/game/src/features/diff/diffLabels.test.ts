import { describe, expect, it } from "vitest";
import {
  inRange,
  mismatchKindOf,
  mismatchLabel,
  noteText,
  provenanceLabel,
  rowMarker,
} from "./diffLabels";

describe("rowMarker", () => {
  it.each([
    ["equal", "✓", "Equal"],
    ["field-only", "≈", "Equal outside relocated fields"],
    ["different", "✗", "Different"],
    ["inserted", "+", "Extra in your output"],
    ["deleted", "−", "Missing from your output"],
  ] as const)(
    "marks %s rows with a symbol and a label",
    (status, symbol, label) => {
      expect(rowMarker(status)).toEqual({ symbol, label });
    },
  );
});

describe("provenanceLabel", () => {
  it("labels inserted nops only", () => {
    expect(provenanceLabel({ kind: "load-delay-nop" })).toBe("load delay nop");
    expect(provenanceLabel({ kind: "branch-delay-nop" })).toBe(
      "branch delay nop",
    );
    expect(provenanceLabel({ kind: "instruction" })).toBe("");
    expect(provenanceLabel(undefined)).toBe("");
  });
});

describe("noteText", () => {
  it("joins labels once each, in order, skipping empty ones", () => {
    expect(
      noteText([
        "branch delay nop",
        "branch delay nop",
        "",
        undefined,
        false,
        "HINT",
      ]),
    ).toBe("branch delay nop · HINT");
    expect(noteText([])).toBe("");
  });
});

describe("mismatch names", () => {
  it("turns kinds into sentence case and reads kinds from IDs", () => {
    expect(mismatchLabel("LOAD_SIGNEDNESS")).toBe("Load signedness");
    expect(mismatchKindOf("REGISTER@t0g0")).toBe("REGISTER");
    expect(mismatchKindOf("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("inRange", () => {
  it("includes the start and excludes the end", () => {
    const range = { start: 1, end: 3 };

    expect(inRange(1, range)).toBe(true);
    expect(inRange(2, range)).toBe(true);
    expect(inRange(3, range)).toBe(false);
    expect(inRange(0, range)).toBe(false);
    expect(inRange(undefined, range)).toBe(false);
    expect(inRange(1, undefined)).toBe(false);
  });
});
