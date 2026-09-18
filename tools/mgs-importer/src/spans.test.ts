import { describe, expect, it } from "vitest";
import { functionSpan } from "./spans.ts";

/*
 * Every source here is OSP-authored placeholder C. It is shaped like a file
 * with a prototype, a comment, a call, and a definition, and describes no
 * real function.
 */

const SAMPLE = [
  '#include "sample.h"',
  "",
  "int sample_count(int limit);",
  "",
  "/* sample_count(limit) walks up to the limit. */",
  "static int helper(int n)",
  "{",
  "    return sample_count(n) + 1;",
  "}",
  "",
  "int sample_count(int limit)",
  "{",
  "    int i;",
  "    for (i = 0; i < limit; i++) {",
  "        if (i == 3) {",
  "            break;",
  "        }",
  "    }",
  "    return i;",
  "}",
  "",
  "void sample_tail(void) {",
  "    helper(2);",
  "}",
  "",
].join("\n");

describe("functionSpan", () => {
  it("finds the definition, not the prototype, comment, or call", () => {
    expect(functionSpan(SAMPLE, "sample_count")).toEqual({
      start: 11,
      end: 20,
      signature: "int sample_count(int limit)",
    });
  });

  it("handles a brace on the definition line", () => {
    expect(functionSpan(SAMPLE, "sample_tail")).toEqual({
      start: 22,
      end: 24,
      signature: "void sample_tail(void) {",
    });
  });

  it("finds a definition whose parameter list ends the line", () => {
    const source = "int helper(int n)\n\n{\n    return n;\n}\n";
    expect(functionSpan(source, "helper")).toEqual({
      start: 1,
      end: 5,
      signature: "int helper(int n)",
    });
  });

  it("reads CRLF sources by the same line numbers", () => {
    expect(
      functionSpan(SAMPLE.replaceAll("\n", "\r\n"), "sample_count"),
    ).toEqual({ start: 11, end: 20, signature: "int sample_count(int limit)" });
  });

  it("does not match a longer symbol", () => {
    expect(functionSpan(SAMPLE, "sample")).toBeUndefined();
  });

  it("returns undefined when only a prototype exists", () => {
    expect(functionSpan("int lonely(void);\n", "lonely")).toBeUndefined();
  });

  it("falls back to the definition line when the body never closes", () => {
    expect(functionSpan("int open(void)\n{\n    return 1;\n", "open")).toEqual({
      start: 1,
      end: 1,
      signature: "int open(void)",
    });
  });
});
