import { describe, expect, it } from "vitest";
import { realMissionTextIssues } from "./realText.ts";

describe("realMissionTextIssues", () => {
  it.each([
    ["a register", "The value arrives in $a1.", "names the register $a1"],
    ["a numbered register", "Look at $31.", "names the register $31"],
    ["a hexadecimal value", "The offset is 0x14.", "quotes the value 0x14"],
    ["an uppercase hexadecimal value", "Offset 0X2A.", "quotes the value 0X2A"],
    ["a mnemonic", "The first row is an sw.", "names the instruction sw"],
    ["a hyphenated mnemonic", "A nop-like row.", "names the instruction nop"],
    [
      "a mnemonic before operands",
      "addiu then returns.",
      "names the instruction addiu",
    ],
  ])("flags %s", (_, text, issue) => {
    expect(realMissionTextIssues(text)).toEqual([issue]);
  });

  it("lists every kind of quotation in a disassembly excerpt", () => {
    expect(realMissionTextIssues("lw $v0,0x8($a0)")).toEqual([
      "names the register $v0",
      "quotes the value 0x8",
      "names the instruction lw",
    ]);
  });

  it.each([
    "Add a constant to the second argument, then store it and return.",
    "The store after the return still runs. Look at the highlighted rows.",
    "Count field sizes in order: pointers take 4 bytes, and a field may move to line up.",
    "Swap or move the statements and compare again; a filler row is not special.",
    "Subtract, add, and move values between the argument registers.",
  ])("accepts teaching prose: %s", (text) => {
    expect(realMissionTextIssues(text)).toEqual([]);
  });
});
