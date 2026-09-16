import { describe, expect, it } from "vitest";
import {
  assemblyNames,
  basenameOf,
  parseInventory,
  statusOf,
} from "./inventory.ts";

describe("parseInventory", () => {
  it("reads an address, a size, and a symbol from every line", () => {
    const entries = parseInventory(
      "80014A40 60 main\n80016EF8 44 GV_VecDir2\n",
    );
    expect(entries).toEqual([
      { symbol: "main", address: 0x80014a40, size: 60 },
      { symbol: "GV_VecDir2", address: 0x80016ef8, size: 44 },
    ]);
  });

  it("ignores blank lines and surrounding whitespace", () => {
    expect(parseInventory("\n  80014A40 60 main  \n\n")).toHaveLength(1);
  });

  it("accepts a tab between the columns", () => {
    expect(parseInventory("80014A40\t60\tmain")[0]?.symbol).toBe("main");
  });

  it("rejects a line that is not an inventory entry, naming its number", () => {
    expect(() => parseInventory("80014A40 60 main\nnot an entry\n")).toThrow(
      /line 2/,
    );
  });

  it("rejects an address that is not eight hexadecimal digits", () => {
    expect(() => parseInventory("8014A40 60 main")).toThrow(/line 1/);
  });
});

describe("assemblyNames", () => {
  it("offers both the bare name and the address-suffixed name", () => {
    expect(
      assemblyNames({ symbol: "GV_VecDir2", address: 0x80016ef8, size: 44 }),
    ).toEqual(["GV_VecDir2.s", "GV_VecDir2_80016EF8.s"]);
  });

  it("pads an address shorter than eight digits", () => {
    expect(assemblyNames({ symbol: "f", address: 0x1000, size: 4 })[1]).toBe(
      "f_00001000.s",
    );
  });
});

describe("basenameOf", () => {
  it("returns the last segment", () => {
    expect(basenameOf("asm/libgv/GV_VecDir2_80016EF8.s")).toBe(
      "GV_VecDir2_80016EF8.s",
    );
  });

  it("returns a bare name unchanged", () => {
    expect(basenameOf("util.c")).toBe("util.c");
  });
});

describe("statusOf", () => {
  const entry = { symbol: "GV_VecDir2", address: 0x80016ef8, size: 44 };

  it("is LIVE while an address-suffixed assembly file remains", () => {
    expect(statusOf(entry, new Set(["GV_VecDir2_80016EF8.s"]))).toBe("LIVE");
  });

  it("is LIVE while a bare assembly file remains", () => {
    expect(statusOf(entry, new Set(["GV_VecDir2.s"]))).toBe("LIVE");
  });

  it("is SOLVED once no assembly file names it", () => {
    expect(statusOf(entry, new Set(["GV_VecDir3_80016EF8.s"]))).toBe("SOLVED");
  });
});
