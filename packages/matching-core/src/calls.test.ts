import { describe, expect, it } from "vitest";
import { callText, callWords, generatedCalls, targetCallees } from "./calls.ts";
import { extractFunction } from "./extract.ts";
import {
  assembleObject,
  functionSource,
  generatedFrom,
  unlinkedTarget,
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

describe("callText", () => {
  it("names the callee of a call", () => {
    const [jal] = wordsOf(["jal g"]);
    expect(callText("jal 0x0", jal ?? 0, "g")).toBe("jal g");
  });

  it("leaves other words, and calls with no known callee, alone", () => {
    const [jal, jump] = wordsOf(["jal g", "j g"]);
    expect(callText("jal 0x0", jal ?? 0, undefined)).toBe("jal 0x0");
    expect(callText("j 0x0", jump ?? 0, "g")).toBe("j 0x0");
  });
});

describe("targetCallees", () => {
  it("reads a linked target's recorded calls", () => {
    expect(
      targetCallees({
        kind: "linked",
        words: wordsOf(["jal g", ...RETURN]),
        calls: [{ word: 0, callee: "g" }],
      }),
    ).toEqual(new Map([[0, "g"]]));
  });

  it("reads an unlinked target's call relocations and nothing else", () => {
    const target = unlinkedTarget(["jal g", "la $2,h", "jal k+4", ...RETURN]);
    expect(targetCallees(target)).toEqual(new Map([[0, "g"]]));
  });
});
