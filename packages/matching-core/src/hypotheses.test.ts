import { describe, expect, it } from "vitest";
import { generatedFrom, linkedTarget } from "./fixtures.test-helpers.ts";
import {
  HYPOTHESIS_HEDGE,
  TEACHING_HYPOTHESIS_KINDS,
  teachingHypotheses,
} from "./hypotheses.ts";
import { compareFunction } from "./match.ts";

// Every assembly fixture in these tests is OSP-authored.

const RETURN = ["j $31"];

function hypothesesFor(
  target: readonly string[],
  generated: readonly string[],
) {
  const result = compareFunction(
    generatedFrom(generated),
    linkedTarget(target),
  );
  return { result, hypotheses: teachingHypotheses(result) };
}

describe("teachingHypotheses", () => {
  it("lists the nine hypothesis kinds", () => {
    expect(TEACHING_HYPOTHESIS_KINDS).toHaveLength(9);
  });

  it("has nothing to say about an exact match", () => {
    const lines = ["lb $2,4($4)", ...RETURN];

    expect(hypothesesFor(lines, lines).hypotheses).toEqual([]);
  });

  it("suggests signedness, and a field type, for a signed byte loaded unsigned", () => {
    const { result, hypotheses } = hypothesesFor(
      ["lb $2,4($4)", ...RETURN],
      ["lbu $2,4($4)", ...RETURN],
    );
    const id = result.mismatches[0]?.id;

    expect(hypotheses).toEqual([
      {
        kind: "LIKELY_SIGNEDNESS",
        confidence: 0.8,
        message:
          "The target sign-extends this 8-bit value; your output does not. The value is likely declared signed in the target. In PsyQ, plain char is unsigned.",
        evidenceMismatchIds: [id],
      },
      {
        kind: "LIKELY_STRUCT_FIELD_TYPE",
        confidence: 0.5,
        message:
          "This access uses offset 0x4 from $a0, which may be a structure field. Check that field's declared type.",
        evidenceMismatchIds: [id],
      },
    ]);
  });

  it("suggests an unsigned declaration for a zero-extended target load", () => {
    const { hypotheses } = hypothesesFor(
      ["lhu $2,0($4)", ...RETURN],
      ["lh $2,0($4)", ...RETURN],
    );

    expect(hypotheses.map((item) => item.message)).toEqual([
      "The target zero-extends this 16-bit value; your output sign-extends it. The value is likely declared unsigned in the target.",
    ]);
  });

  it("suggests an integer width for loads and stores of different sizes", () => {
    expect(
      hypothesesFor(["lw $2,0($4)", ...RETURN], ["lb $2,0($4)", ...RETURN])
        .hypotheses,
    ).toMatchObject([
      {
        kind: "LIKELY_INTEGER_WIDTH",
        message:
          "The target reads a 32-bit value here; your output reads a 8-bit value. The value's type likely has a different width; check its declaration.",
      },
    ]);
    expect(
      hypothesesFor(
        ["sw $5,0($4)", ...RETURN],
        ["sb $5,0($4)", ...RETURN],
      ).hypotheses.map((item) => item.kind),
    ).toEqual(["LIKELY_INTEGER_WIDTH"]);
  });

  it("does not call a stack slot a structure field", () => {
    const { hypotheses } = hypothesesFor(
      ["lb $2,4($29)", ...RETURN],
      ["lbu $2,4($29)", ...RETURN],
    );

    expect(hypotheses.map((item) => item.kind)).toEqual(["LIKELY_SIGNEDNESS"]);
  });

  it("offers nothing for a changed register on a load", () => {
    const { result, hypotheses } = hypothesesFor(
      ["lw $2,4($4)", ...RETURN],
      ["lw $2,4($5)", ...RETURN],
    );

    expect(result.mismatches.map((item) => item.kind)).toEqual(["REGISTER"]);
    expect(hypotheses).toEqual([]);
  });

  it("suggests a missing dereference when the address is returned instead of the value", () => {
    const { result, hypotheses } = hypothesesFor(
      [".set noreorder", "j $31", "lw $2,0($4)"],
      [".set noreorder", "j $31", "addu $2,$4,$0"],
    );

    expect(hypotheses).toEqual([
      {
        kind: "LIKELY_EXPRESSION_SHAPE",
        confidence: 0.6,
        message:
          "The target reads the value stored at the address in $a0; your output copies that address into $v0 instead. The source may use the pointer itself where the target uses the value it points to. Check for a missing dereference.",
        evidenceMismatchIds: result.mismatches.map((item) => item.id),
      },
    ]);
  });

  it("does not suggest a dereference when the copy uses another register", () => {
    const { hypotheses } = hypothesesFor(
      [".set noreorder", "j $31", "lw $2,0($4)"],
      [".set noreorder", "j $31", "addu $2,$5,$0"],
    );

    expect(hypotheses).toEqual([]);
  });

  it("hedges every message", () => {
    const { hypotheses } = hypothesesFor(
      ["lb $2,4($4)", "lw $3,0($5)", ...RETURN],
      ["lbu $2,4($4)", "lb $3,0($5)", ...RETURN],
    );

    expect(hypotheses.length).toBeGreaterThan(0);
    for (const item of hypotheses) {
      expect(item.message).toMatch(HYPOTHESIS_HEDGE);
    }
  });
});
