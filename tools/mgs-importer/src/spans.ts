/**
 * Where a function is defined in its source file.
 *
 * A real mission's stage 5 and stage 9 hints reveal a line span of an
 * upstream file, and the span is recorded by hand in the overrides. This is
 * the one place that computes it, so a reveal never shows the wrong lines.
 */
export interface FunctionSpan {
  /** First line of the definition, counted from 1. */
  readonly start: number;
  /** Line of the closing brace, counted from 1. */
  readonly end: number;
  /** The definition line as written, without its line ending. */
  readonly signature: string;
}

function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*");
}

/**
 * The definition of `symbol` in C source text, or `undefined` when the file
 * has none. The definition line names the symbol before a parenthesis and is
 * followed by a body: it opens the brace itself, the next line does, or it
 * ends with the parameter list's closing parenthesis. A prototype ends with
 * a semicolon and a call sits inside a statement, so neither qualifies. The
 * last such line wins, since a prototype precedes its definition.
 */
export function functionSpan(
  text: string,
  symbol: string,
): FunctionSpan | undefined {
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  const definition = new RegExp(`\\b${symbol}\\s*\\(`);

  let found: { readonly index: number; readonly signature: string } | undefined;
  for (const [index, line] of lines.entries()) {
    if (!definition.test(line) || isComment(line)) {
      continue;
    }
    const next = lines.slice(index + 1, index + 2).join("");
    if (
      line.includes("{") ||
      next.trim().startsWith("{") ||
      line.trimEnd().endsWith(")")
    ) {
      found = { index, signature: line };
    }
  }
  if (found === undefined) {
    return undefined;
  }

  const { index: start, signature } = found;
  let depth = 0;
  let opened = false;
  let end = start;
  for (const [offset, line] of lines.slice(start).entries()) {
    depth += line.split("{").length - 1;
    opened ||= line.includes("{");
    depth -= line.split("}").length - 1;
    if (opened && depth <= 0) {
      end = start + offset;
      break;
    }
  }

  return { start: start + 1, end: end + 1, signature };
}
