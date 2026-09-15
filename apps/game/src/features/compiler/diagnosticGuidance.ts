import type { AssemblerDiagnostic, CompilerDiagnostic } from "./types";

type Diagnostic = CompilerDiagnostic | AssemblerDiagnostic;

interface GuidanceRule {
  readonly pattern: RegExp;
  /** `name` is the pattern's quoted name, or empty when it has none. */
  readonly guidance: (name: string, diagnostic: Diagnostic) => string;
}

// PsyQ's cc1psx quotes names as `name'.
const RULES: readonly GuidanceRule[] = [
  {
    pattern: /^parse error before `(.+)'$/,
    guidance: (name, { line }) =>
      line === undefined || line <= 1
        ? `The compiler did not expect ${name} here. Check the statement before it; a missing semicolon is a common cause.`
        : `The compiler did not expect ${name} on line ${String(line)}. Check the statement before it, on line ${String(line - 1)} or earlier; a missing semicolon is a common cause.`,
  },
  {
    pattern: /^parse error at end of input$/,
    guidance: () =>
      "The file ended while the compiler still expected more. Check for a missing closing brace or parenthesis.",
  },
  {
    pattern: /^`(.+)' undeclared/,
    guidance: (name) =>
      `${name} is not declared where it is used. Check its spelling, and whether it should be a parameter or a declared variable.`,
  },
  {
    pattern: /^implicit declaration of function `(.+)'$/,
    guidance: (name) =>
      `The compiler has not seen a declaration of ${name} before this call, so it assumes the function returns int. Check that it is declared before it is called.`,
  },
  {
    pattern: /^incompatible types in return$/,
    guidance: () =>
      "The returned value's type does not fit the function's return type. Check what the function declares it returns.",
  },
  {
    pattern: /^return makes integer from pointer without a cast$/,
    guidance: () =>
      "This returns a pointer from a function that returns an integer. Check whether you meant the value the pointer points to.",
  },
];

/**
 * A likely source mistake behind a compiler message, phrased as something to
 * check. The message itself is always shown as the compiler wrote it.
 */
export function diagnosticGuidance(diagnostic: Diagnostic): string | undefined {
  for (const rule of RULES) {
    const match = rule.pattern.exec(diagnostic.message);
    if (match !== null) {
      return rule.guidance(match.slice(1).join(""), diagnostic);
    }
  }
  return undefined;
}

/**
 * The line a parse error most likely points back to: the reported line for
 * most messages, but the line before for "parse error before", because the
 * compiler notices a missing semicolon only at the next token.
 */
export function likelyLine(diagnostic: Diagnostic): number | undefined {
  const { line } = diagnostic;
  if (line === undefined) {
    return undefined;
  }
  return diagnostic.message.startsWith("parse error before ") && line > 1
    ? line - 1
    : line;
}
