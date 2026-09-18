import { describe, expect, it } from "vitest";
import { renderDecodedTarget } from "./decode.ts";

describe("renderDecodedTarget", () => {
  it("lists each word as an instruction with its registers and hazard", () => {
    // jr $ra; nop; addiu $v0, $zero, 1: placeholder words, not a target.
    const lines = renderDecodedTarget(
      "sample",
      [0x03e0_0008, 0x0000_0000, 0x2402_0001],
    );

    expect(lines[0]).toBe("sample  (3 rows)");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(
      /^ {2}row {3}0 {2}jr .*reads\[31\] writes\[\] hazard=/,
    );
    expect(lines[2]).toMatch(/^ {2}row {3}1 {2}sll /);
    expect(lines[3]).toMatch(/^ {2}row {3}2 {2}addiu .*writes\[2\]/);
  });

  it("shows a word that is not an instruction as data", () => {
    const [, line] = renderDecodedTarget("sample", [0xffff_ffff]);
    expect(line).toMatch(/^ {2}row {3}0 {2}\.word 0xffffffff {2}\S/);
  });
});
