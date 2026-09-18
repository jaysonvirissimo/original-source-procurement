import { describe, expect, it } from "vitest";
import { callWords, generatedCalls } from "./calls.ts";
import { extractFunction } from "./extract.ts";
import {
  assembleObject,
  functionSource,
  generatedFrom,
  wordsOf,
} from "./fixtures.test-helpers.ts";

// Every assembly fixture here is OSP-authored.
const RETURN = ["j $31"];

describe("callWords", () => {
  it("finds every jal and nothing else", () => {
    expect(callWords(wordsOf(["jal g", "j h", "jal k", ...RETURN]))).toEqual([
      0, 4,
    ]);
  });

  it("is empty for a leaf", () => {
    expect(callWords(wordsOf(["addiu $2,$4,1", ...RETURN]))).toEqual([]);
  });
});

describe("generatedCalls", () => {
  it("names a call to another file's function by its symbol", () => {
    expect(generatedCalls(generatedFrom(["jal g", ...RETURN]))).toEqual([
      { word: 0, callee: "g" },
    ]);
  });

  it("names a call within the file by its label", () => {
    const generated = extractFunction(
      assembleObject(
        functionSource("f", ["jal h", ...RETURN]),
        functionSource("h", RETURN),
      ),
      "f",
    );
    expect(generated && generatedCalls(generated)).toEqual([
      { word: 0, callee: "h" },
    ]);
  });

  it("leaves a call to an offset into a function unnamed", () => {
    expect(generatedCalls(generatedFrom(["jal g+8", ...RETURN]))).toEqual([
      { word: 0, callee: undefined },
    ]);
  });

  it("leaves a call unnamed when no relocation names it", () => {
    const generated = generatedFrom(["jal g", ...RETURN]);
    expect(generatedCalls({ ...generated, relocations: [] })).toEqual([
      { word: 0, callee: undefined },
    ]);
  });
});
