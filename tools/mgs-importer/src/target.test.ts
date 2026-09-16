import { describe, expect, it } from "vitest";
import { wordsSha256 } from "./hash.ts";
import { buildTarget, extractDwWords } from "./target.ts";

const TARGET = [
  "\topt\tc+, at+, e+, n-",
  "\tsection .text",
  "",
  "\txdef f",
  "f:",
  "\tdw 0x03E00008 ; 80016EF8",
  "  dw\t0x24020005 ; 80016EFC",
].join("\n");

describe("extractDwWords", () => {
  it("reads every dw value in order", () => {
    expect(extractDwWords(TARGET)).toEqual([0x03e00008, 0x24020005]);
  });

  it("reads nothing from a file with no dw lines", () => {
    expect(extractDwWords("\tsection .text\n\txdef f\n")).toEqual([]);
  });

  it("ignores a dw that is not at the start of a line", () => {
    expect(extractDwWords("; see dw 0x00000000 above\n")).toEqual([]);
  });

  it("reads a value written with fewer than eight digits", () => {
    expect(extractDwWords("  dw 0x0\n")).toEqual([0]);
  });
});

describe("buildTarget", () => {
  const commit = "a2a563417ea619ab7cdd2e33f4b2ab85e4672a21";
  const path = "asm/libgv/f_80016EF8.s";

  it("pins a target and hashes its words little-endian", () => {
    const outcome = buildTarget(commit, path, TARGET, 2);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.target).toEqual({
      kind: "remote",
      commit,
      path,
      wordCount: 2,
      wordsSha256: wordsSha256([0x03e00008, 0x24020005]),
    });
    expect(outcome.words).toEqual([0x03e00008, 0x24020005]);
  });

  it("rejects a file that holds no words", () => {
    const outcome = buildTarget(commit, path, "\txdef f\n", 2);
    expect(outcome).toEqual({ ok: false, rejection: { reason: "no-words" } });
  });

  it("rejects a file whose word count disagrees with the inventory", () => {
    expect(buildTarget(commit, path, TARGET, 11)).toEqual({
      ok: false,
      rejection: { reason: "word-count", found: 2, expected: 11 },
    });
  });
});
