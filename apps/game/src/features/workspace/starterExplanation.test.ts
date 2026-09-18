import { compareFunction, functionFromWords } from "@osp/matching-core";
import { describe, expect, it } from "vitest";
import { starterExplanation } from "./starterExplanation";

// OSP-authored instruction words.
const JR_RA = 0x03e00008;
const ADDIU_V0_A0_5 = 0x24820005; // addiu $v0,$a0,0x5
const MOVE_V0_A0 = 0x00801021; // addu $v0,$a0,$zero
const ADDIU_V1_A0_5 = 0x24830005; // addiu $v1,$a0,0x5
const SW_A1_A0 = 0xac850000; // sw $a1,0x0($a0)
const SB_A1_A0 = 0xa0850000; // sb $a1,0x0($a0)

function compare(target: number[], generated: number[]) {
  return compareFunction(functionFromWords("f", generated), {
    kind: "linked",
    calls: [],
    words: target,
  });
}

const LEAD =
  "This is the starting source, unchanged. It compiles, but it does not do what the target does yet. Compare the rows marked as different.";

describe("starterExplanation", () => {
  it("says nothing about an exact match", () => {
    expect(starterExplanation(compare([JR_RA, 0], [JR_RA, 0]))).toEqual([]);
  });

  it("names both instructions when they write the same register differently", () => {
    expect(
      starterExplanation(compare([JR_RA, ADDIU_V0_A0_5], [JR_RA, MOVE_V0_A0])),
    ).toEqual([
      LEAD,
      "Both sides write $v0, but they compute it differently: the target runs addiu $v0,$a0,0x5, and your output runs move $v0,$a0.",
    ]);
  });

  it("names what the target writes when your output writes somewhere else", () => {
    expect(
      starterExplanation(
        compare([JR_RA, ADDIU_V0_A0_5], [JR_RA, ADDIU_V1_A0_5]),
      ),
    ).toEqual([
      LEAD,
      "The target runs addiu $v0,$a0,0x5, which writes $v0; your output runs addiu $v1,$a0,0x5 there.",
    ]);
  });

  it("keeps to the lead for several mismatches, other kinds, or a store", () => {
    expect(
      starterExplanation(compare([ADDIU_V0_A0_5, JR_RA, 0], [JR_RA, 0])),
    ).toEqual([LEAD]);
    expect(
      starterExplanation(
        compare([ADDIU_V0_A0_5, ADDIU_V0_A0_5], [ADDIU_V1_A0_5, ADDIU_V1_A0_5]),
      ),
    ).toEqual([LEAD]);
    expect(starterExplanation(compare([SW_A1_A0], [SB_A1_A0]))).toEqual([LEAD]);
    expect(starterExplanation(compare([SW_A1_A0], [ADDIU_V0_A0_5]))).toEqual([
      LEAD,
    ]);
  });
});
