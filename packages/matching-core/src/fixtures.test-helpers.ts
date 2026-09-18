import { assemble, type AssembledObject } from "psyq-asm";
import { extractFunction } from "./extract.ts";
import type { GeneratedFunction, MatchTarget } from "./types.ts";

// Every assembly fixture in these tests is OSP-authored.

/** One function's source. Lines ending in ":" are labels. */
export function functionSource(name: string, lines: readonly string[]) {
  return [
    `\t.globl ${name}`,
    `\t.ent ${name}`,
    `${name}:`,
    ...lines.map((line) => (line.endsWith(":") ? line : `\t${line}`)),
    `\t.end ${name}`,
    "",
  ].join("\n");
}

export function assembleAt(
  gpSize: number,
  functions: readonly string[],
): AssembledObject {
  const result = assemble(`\t.text\n${functions.join("")}`, {
    gpSize,
    aspsxVersion: "2.77",
  });
  if (!result.success) {
    throw new Error(JSON.stringify(result.diagnostics));
  }
  return result.object;
}

export function assembleObject(
  ...functions: readonly string[]
): AssembledObject {
  return assembleAt(0, functions);
}

export function generatedFrom(
  lines: readonly string[],
  gpSize = 0,
): GeneratedFunction {
  const generated = extractFunction(
    assembleAt(gpSize, [functionSource("f", lines)]),
    "f",
  );
  if (generated === undefined) {
    throw new Error("The fixture defines no function f.");
  }
  return generated;
}

export function wordsOf(lines: readonly string[], gpSize = 0): number[] {
  return generatedFrom(lines, gpSize).words.map((word) => word.word);
}

export function linkedTarget(
  lines: readonly string[],
  gpSize = 0,
): MatchTarget {
  return { kind: "linked", words: wordsOf(lines, gpSize), calls: [] };
}

export function unlinkedTarget(
  lines: readonly string[],
  gpSize = 0,
): MatchTarget {
  const generated = generatedFrom(lines, gpSize);
  return {
    kind: "unlinked",
    words: generated.words.map((word) => word.word),
    relocations: generated.relocations,
  };
}
