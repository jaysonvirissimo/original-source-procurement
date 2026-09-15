import { describe, expect, it } from "vitest";
import { diagnosticGuidance, likelyLine } from "./diagnosticGuidance";

function error(message: string, line?: number) {
  return {
    severity: "error" as const,
    file: "mission.c",
    ...(line === undefined ? {} : { line }),
    message,
  };
}

describe("diagnosticGuidance", () => {
  it.each([
    [
      error("parse error before `}'", 4),
      "The compiler did not expect } on line 4. Check the statement before it, on line 3 or earlier; a missing semicolon is a common cause.",
    ],
    [
      error("parse error before `return'", 1),
      "The compiler did not expect return here. Check the statement before it; a missing semicolon is a common cause.",
    ],
    [
      error("parse error before `x'"),
      "The compiler did not expect x here. Check the statement before it; a missing semicolon is a common cause.",
    ],
    [
      error("parse error at end of input", 4),
      "The file ended while the compiler still expected more. Check for a missing closing brace or parenthesis.",
    ],
    [
      error("`b' undeclared (first use in this function)", 3),
      "b is not declared where it is used. Check its spelling, and whether it should be a parameter or a declared variable.",
    ],
    [
      {
        ...error("implicit declaration of function `g'", 3),
        severity: "warning" as const,
      },
      "The compiler has not seen a declaration of g before this call, so it assumes the function returns int. Check that it is declared before it is called.",
    ],
    [
      error("incompatible types in return", 4),
      "The returned value's type does not fit the function's return type. Check what the function declares it returns.",
    ],
    [
      error("return makes integer from pointer without a cast", 3),
      "This returns a pointer from a function that returns an integer. Check whether you meant the value the pointer points to.",
    ],
  ])("guides %o", (diagnostic, guidance) => {
    expect(diagnosticGuidance(diagnostic)).toBe(guidance);
  });

  it("offers nothing for a message it does not recognize", () => {
    expect(
      diagnosticGuidance(
        error("(Each undeclared identifier is reported only once", 3),
      ),
    ).toBeUndefined();
  });

  it("phrases every guidance line as something to check", () => {
    for (const message of [
      "parse error before `}'",
      "parse error at end of input",
      "`b' undeclared (first use in this function)",
      "implicit declaration of function `g'",
      "incompatible types in return",
      "return makes integer from pointer without a cast",
    ]) {
      expect(diagnosticGuidance(error(message, 2))).toMatch(/\bCheck\b/);
    }
  });
});

describe("likelyLine", () => {
  it("points a parse error before a token at the line before it", () => {
    expect(likelyLine(error("parse error before `}'", 4))).toBe(3);
    expect(likelyLine(error("parse error before `}'", 1))).toBe(1);
  });

  it("keeps the reported line for other messages, and has none without a line", () => {
    expect(likelyLine(error("incompatible types in return", 4))).toBe(4);
    expect(likelyLine(error("parse error before `}'"))).toBeUndefined();
  });
});
