import { describe, expect, it } from "vitest";
import { hintUsageText } from "./hintUsageText";

describe("hintUsageText", () => {
  it("says None before any hint is opened", () => {
    expect(hintUsageText({ opened: 0, stage: 0, reached: undefined })).toBe(
      "None",
    );
  });

  it("names how far the ladder was opened by position, never by stage", () => {
    expect(hintUsageText({ opened: 2, stage: 4, reached: "Hint 2 of 5" })).toBe(
      "Through Hint 2 of 5",
    );
    expect(
      hintUsageText({ opened: 6, stage: 9, reached: "Solution reveal" }),
    ).toBe("Through Solution reveal");
  });
});
