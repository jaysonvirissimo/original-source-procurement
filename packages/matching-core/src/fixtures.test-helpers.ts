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

export function assembleObject(
  ...functions: readonly string[]
): AssembledObject {
  const result = assemble(`\t.text\n${functions.join("")}`, {
    gpSize: 0,
    aspsxVersion: "2.77",
  });
  if (!result.success) {
    throw new Error(JSON.stringify(result.diagnostics));
  }
  return result.object;
}

export function generatedFrom(lines: readonly string[]): GeneratedFunction {
  const generated = extractFunction(
    assembleObject(functionSource("f", lines)),
    "f",
  );
  if (generated === undefined) {
    throw new Error("The fixture defines no function f.");
  }
  return generated;
}

export function wordsOf(lines: readonly string[]): number[] {
  return generatedFrom(lines).words.map((word) => word.word);
}

export function linkedTarget(lines: readonly string[]): MatchTarget {
  return { kind: "linked", words: wordsOf(lines) };
}

export function unlinkedTarget(lines: readonly string[]): MatchTarget {
  const generated = generatedFrom(lines);
  return {
    kind: "unlinked",
    words: generated.words.map((word) => word.word),
    relocations: generated.relocations,
  };
}
