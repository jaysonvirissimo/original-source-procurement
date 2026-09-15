import { describe, expect, it } from "vitest";
import { accessText, hex, wordList } from "./format";

describe("scan formatting", () => {
  it("writes addresses in hexadecimal, including values stored signed", () => {
    expect(hex(0x1000)).toBe("0x1000");
    expect(hex(0x3020)).toBe("0x3020");
    expect(hex(-1)).toBe("0xFFFFFFFF");
  });

  it("lists word indexes", () => {
    expect(wordList([])).toBe("—");
    expect(wordList([2])).toBe("word 2");
    expect(wordList([0, 3])).toBe("words 0, 3");
  });

  it.each([
    [
      {
        kind: "load",
        register: "$v0",
        base: "$a0",
        offset: 0,
        bytes: 4,
        signed: true,
      },
      "Word 0 loads 4 bytes into $v0",
    ],
    [
      {
        kind: "load",
        register: "$v0",
        base: "$a0",
        offset: 4,
        bytes: 1,
        signed: true,
      },
      "Word 0 loads 1 byte into $v0, sign-extended",
    ],
    [
      {
        kind: "load",
        register: "$v0",
        base: "$a0",
        offset: 5,
        bytes: 1,
        signed: false,
      },
      "Word 0 loads 1 byte into $v0, zero-extended",
    ],
    [
      { kind: "store", register: "$a1", base: "$a0", offset: 0, bytes: 2 },
      "Word 0 stores 2 bytes from $a1",
    ],
  ] as const)("describes an access as %j", (access, text) => {
    expect(accessText(0, access)).toBe(text);
  });
});
