import { wordFacts } from "@osp/matching-core";
import { describe, expect, it } from "vitest";
import {
  inlineWords,
  shippedMission,
} from "../workspace/workspace.test-helpers";
import { bitGroups } from "./bits";
import { operandReading } from "./operands";

// lw $v1,0x20($a0); nop; lb $v0,0x4($v1); jr $ra; sw $v0,0x0($v1)
const qualification = wordFacts(inlineWords(shippedMission("012")));

describe("operandReading", () => {
  it("labels a load's destination, offset, and base", () => {
    const reading = operandReading(qualification[0]);
    expect(reading?.parts.map(({ role, value }) => [role, value])).toEqual([
      ["destination", "$v1"],
      ["offset", "0x20"],
      ["base", "$a0"],
    ]);
    expect(reading?.summary).toBe(
      "Read 4 bytes from memory at $a0 + 0x20, and put the value in $v1.",
    );
    expect(operandReading(qualification[2])?.summary).toBe(
      "Read 1 byte from memory at $v1 + 0x4, and put the value in $v0.",
    );
  });

  it("labels a store's first operand as its source", () => {
    const reading = operandReading(qualification[4]);
    expect(reading?.parts.map(({ role, value }) => [role, value])).toEqual([
      ["source", "$v0"],
      ["offset", "0x0"],
      ["base", "$v1"],
    ]);
    expect(reading?.summary).toBe(
      "$v0 → memory: write 4 bytes from $v0 to memory at $v1 + 0x0.",
    );
  });

  it("has no reading for words without memory access, or no word", () => {
    expect(operandReading(qualification[3])).toBeUndefined();
    expect(operandReading(undefined)).toBeUndefined();
  });

  it("labels a branch's tested register and its distance in rows", () => {
    // bltz $a0,.+12; move $v0,$zero; addu $v0,$a0,$a1; jr $ra; nop
    const branchOnSign = wordFacts(inlineWords(shippedMission("032")));
    const reading = operandReading(branchOnSign[0]);

    expect(reading?.parts.map(({ role, value }) => [role, value])).toEqual([
      ["tested", "$a0"],
      ["distance", "+12"],
    ]);
    expect(reading?.summary).toBe(
      "Read $a0; when the branch is taken, continue 3 rows further down, at word 3. The row directly below runs either way.",
    );
  });

  it("labels both registers of a branch that compares two", () => {
    // slt $a0,$a0,$a1; bnez $a0,.+12; ...
    const branchOnTest = wordFacts(inlineWords(shippedMission("031")));
    const reading = operandReading(branchOnTest[1]);

    expect(reading?.parts.map(({ role }) => role)).toEqual([
      "tested 1",
      "tested 2",
      "distance",
    ]);
  });
});

describe("bitGroups", () => {
  it("pads to the width and groups by four", () => {
    expect(bitGroups(5, 8)).toBe("0000 0101");
    expect(bitGroups(0xfd, 8)).toBe("1111 1101");
    expect(bitGroups(0xffff_fffd, 32)).toBe(
      "1111 1111 1111 1111 1111 1111 1111 1101",
    );
  });
});
