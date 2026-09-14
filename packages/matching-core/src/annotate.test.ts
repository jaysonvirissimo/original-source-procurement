import { describe, expect, it } from "vitest";
import { observations } from "./annotate.ts";
import { generatedFrom } from "./fixtures.test-helpers.ts";

function observe(lines: readonly string[]) {
  const generated = generatedFrom(lines);
  return observations(
    generated.words.map((word) => word.word),
    generated.words.map((word) => word.origin),
  ).map(({ index, kind }) => ({ index, kind }));
}

describe("observations", () => {
  it("finds an instruction in a return's delay slot", () => {
    expect(observe([".set noreorder", "j $31", "addu $2,$4,5"])).toEqual([
      { index: 1, kind: "delay-slot" },
    ]);
  });

  it("finds a store in a delay slot without inserted nops", () => {
    expect(
      observe([
        ".set noreorder",
        "lw $3,32($4)",
        "lb $2,4($3)",
        "j $31",
        "sw $2,0($3)",
      ]),
    ).toEqual([{ index: 3, kind: "delay-slot" }]);
  });

  it("reports an inserted branch delay nop as a nop, not a delay slot", () => {
    expect(observe(["lw $2,0($4)", "j $31"])).toEqual([
      { index: 2, kind: "branch-delay-nop" },
    ]);
  });

  it("finds load and branch delay nops in one function", () => {
    expect(
      observe(["lw $3,32($4)", "lb $2,4($3)", "j $31", "sw $2,0($3)"]),
    ).toEqual([
      { index: 1, kind: "load-delay-nop" },
      { index: 4, kind: "branch-delay-nop" },
    ]);
  });

  it("keeps the assembler's note", () => {
    const generated = generatedFrom(["lw $3,32($4)", "lb $2,4($3)", "j $31"]);
    const [nop] = observations(
      generated.words.map((word) => word.word),
      generated.words.map((word) => word.origin),
    );
    expect(nop?.note).toEqual(expect.any(String));
  });

  it("finds nothing in words without provenance or jumps", () => {
    expect(observations([0x24820005, 0], [])).toEqual([]);
  });
});
