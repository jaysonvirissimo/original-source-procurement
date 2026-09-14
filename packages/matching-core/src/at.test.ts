import { describe, expect, it } from "vitest";
import { at } from "./at.ts";

describe("at", () => {
  it("returns the item at an index", () => {
    expect(at([3, 5], 1)).toBe(5);
  });

  it("throws for an index outside the items", () => {
    expect(() => at([3], 1)).toThrow(RangeError);
  });
});
