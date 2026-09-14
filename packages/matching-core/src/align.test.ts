import { describe, expect, it } from "vitest";
import { ALIGNMENT_COSTS, align, maskedEqual } from "./align.ts";
import { functionFromWords } from "./extract.ts";
import { wordsOf } from "./fixtures.test-helpers.ts";

const NOP = 0;

describe("maskedEqual", () => {
  it("ignores bits inside the mask only", () => {
    expect(maskedEqual(0x3c028001, 0x3c020000, 0xffff)).toBe(true);
    expect(maskedEqual(0x3c038001, 0x3c020000, 0xffff)).toBe(false);
    expect(maskedEqual(0xffffffff, 0, 0xffffffff)).toBe(true);
  });
});

describe("align", () => {
  it("uses the recorded costs", () => {
    expect(ALIGNMENT_COSTS).toEqual({
      sameMnemonic: 1,
      sameClass: 2,
      unrelated: 4,
      gap: 3,
    });
  });

  it("aligns empty sequences to no rows", () => {
    expect(align([], [])).toEqual([]);
  });

  it("pairs the last equal word and inserts the earlier one on a tie", () => {
    expect(align([NOP], functionFromWords("f", [NOP, NOP]).words)).toEqual([
      { status: "inserted", generated: 0 },
      { status: "equal", target: 0, generated: 1 },
    ]);
  });

  it("keeps surrounding instructions paired around an insertion", () => {
    const target = wordsOf(["addiu $2,$4,5", "j $31"]);
    const generated = functionFromWords(
      "f",
      wordsOf(["addiu $2,$4,5", "addiu $2,$2,1", "j $31"]),
    ).words;

    expect(align(target, generated).map((row) => row.status)).toEqual([
      "equal",
      "inserted",
      "equal",
      "equal",
    ]);
  });

  it("marks deleted target words", () => {
    const target = wordsOf(["addiu $2,$4,5", "addiu $2,$2,1", "j $31"]);
    const generated = functionFromWords(
      "f",
      wordsOf(["addiu $2,$4,5", "j $31"]),
    ).words;

    expect(align(target, generated)).toEqual([
      { status: "equal", target: 0, generated: 0 },
      { status: "deleted", target: 1 },
      { status: "equal", target: 2, generated: 1 },
      { status: "equal", target: 3, generated: 2 },
    ]);
  });

  it("pairs a same-class instruction rather than leaving gaps", () => {
    const target = wordsOf(["lb $2,4($4)", "j $31"]);
    const generated = functionFromWords(
      "f",
      wordsOf(["sw $5,0($4)", "j $31"]),
    ).words;

    expect(align(target, generated)[0]).toEqual({
      status: "different",
      target: 0,
      generated: 0,
    });
  });
});
