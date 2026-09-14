import type { AssembledObject } from "psyq-asm";
import { describe, expect, it } from "vitest";
import { definedFunctions, extractFunction } from "./extract.ts";
import { assembleObject, functionSource } from "./fixtures.test-helpers.ts";

describe("extractFunction", () => {
  const object = assembleObject(
    functionSource("g", ["addiu $2,$4,5", "j $31"]),
    functionSource("h", ["la $2,x+4", "j $31"]),
  );

  it("lists the functions an object defines", () => {
    expect(definedFunctions(object)).toEqual(["g", "h"]);
  });

  it("returns undefined for a function the object does not define", () => {
    expect(extractFunction(object, "f")).toBeUndefined();
  });

  it("takes one function's words, provenance, and function-relative relocations", () => {
    const h = extractFunction(object, "h");

    expect(h?.words.map((word) => word.word)).toEqual([
      0x3c020000, 0x24420000, 0x03e00008, 0,
    ]);
    expect(h?.words.map((word) => word.mask)).toEqual([0xffff, 0xffff, 0, 0]);
    expect(h?.words.map((word) => word.origin?.kind)).toEqual([
      "macro",
      "macro",
      "macro",
      "branch-delay-nop",
    ]);
    expect(h?.relocations).toEqual([
      {
        offset: 0,
        kind: "HI16",
        fieldMask: 0xffff,
        fieldValue: 0,
        target: { kind: "symbol", name: "x", addend: 4 },
      },
      {
        offset: 4,
        kind: "LO16",
        fieldMask: 0xffff,
        fieldValue: 0,
        target: { kind: "symbol", name: "x", addend: 4 },
      },
    ]);
  });

  it("returns no words when the function's section is absent", () => {
    const bare: AssembledObject = {
      info: { aspsxVersion: "2.77", gpSize: 0, partialDivExpansion: false },
      sections: [],
      symbols: [],
      functions: [{ name: "f", section: ".text", start: 0, end: 2 }],
      smallData: [],
    };

    expect(extractFunction(bare, "f")).toEqual({
      name: "f",
      words: [],
      relocations: [],
    });
  });
});
