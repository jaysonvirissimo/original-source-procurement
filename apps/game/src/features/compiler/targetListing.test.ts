import { describe, expect, it } from "vitest";
import { targetListing } from "./targetListing";

describe("targetListing", () => {
  it("formats target words as instructions", () => {
    // OSP-authored words: jr $ra, then addiu $v0,$a0,5.
    expect(targetListing([0x03e00008, 0x24820005])).toEqual([
      "jr $ra",
      "addiu $v0,$a0,0x5",
    ]);
  });
});
