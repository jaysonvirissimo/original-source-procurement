import { describe, expect, it } from "vitest";
import { hintUsageText } from "./hintUsageText";

describe("hintUsageText", () => {
  it("says None before any hint is opened", () => {
    expect(hintUsageText({ opened: 0, available: 5, stage: 0 })).toBe("None");
  });

  it("names how many hints were opened and the highest stage", () => {
    expect(hintUsageText({ opened: 2, available: 5, stage: 4 })).toBe(
      "2 of 5 · stage 4",
    );
  });
});
