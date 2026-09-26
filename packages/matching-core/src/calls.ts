import type { AlignedRow } from "./align.ts";
import { at } from "./at.ts";
import type { RelocationFinding } from "./relocations.ts";
import type { GeneratedFunction, LinkedCall, MatchTarget } from "./types.ts";

const JAL = 3;

function isJal(word: number): boolean {
  return word >>> 26 === JAL;
}

/**
 * The function the relocation on a `jal` names, if it names one.
 *
 * psyq-asm relocates a call to a function defined in the same file against
 * the section rather than the symbol, and keeps the callee's name as the
 * label. The label is otherwise display-only and never compared; here it is
 * the only place the name survives, so a call reads it.
 */
function calleeAt(
  generated: GeneratedFunction,
  word: number,
): string | undefined {
  const relocation = generated.relocations.find(
    (candidate) => candidate.offset === word * 4 && candidate.kind === "MIPS26",
  );
  if (relocation === undefined) {
    return undefined;
  }
  const { target } = relocation;
  if (target.kind === "section") {
    return target.label;
  }
  return target.addend === 0 ? target.name : undefined;
}

/** The index of every `jal` word, in order. */
export function callWords(words: ArrayLike<number>): number[] {
  return Array.from(words).flatMap((word, index) =>
    isJal(word) ? [index] : [],
  );
}

/** A `jal` in an assembled function, and the function it calls. */
export interface CallSite {
  readonly word: number;
  /** Undefined when no relocation at the call names a function. */
  readonly callee: string | undefined;
}

/**
 * Every `jal` in an assembled function, in word order, with the callee its
 * relocation names. This is how the importer learns what a real target
 * calls: the linked word holds only an address, and the unlinked object
 * built from the known source names it.
 */
export function generatedCalls(generated: GeneratedFunction): CallSite[] {
  return generated.words.flatMap((entry, word) =>
    isJal(entry.word) ? [{ word, callee: calleeAt(generated, word) }] : [],
  );
}

/**
 * Compares the callee of every call a linked target records with the one the
 * generated call on the same aligned row names (ADR 0024).
 *
 * The address field of a generated `jal` is masked, so the words alone would
 * accept any callee. A missing or moved call is already reported by the word
 * comparison, as is a generated `jal` with no relocation, whose field is then
 * compared as a plain word. That leaves a relocated call to a different
 * function, which only this finds.
 */
export function compareLinkedCalls(
  rows: readonly AlignedRow[],
  calls: readonly LinkedCall[],
  generated: GeneratedFunction,
): RelocationFinding[] {
  const expected = new Map(calls.map((call) => [call.word, call.callee]));
  return rows.flatMap((row) => {
    if (row.status === "deleted" || row.status === "inserted") {
      return [];
    }
    const callee = expected.get(row.target);
    if (
      callee === undefined ||
      !isJal(at(generated.words, row.generated).word) ||
      !generated.relocations.some(
        (relocation) => relocation.offset === row.generated * 4,
      )
    ) {
      return [];
    }
    const actual = calleeAt(generated, row.generated);
    if (actual === callee) {
      return [];
    }
    return [
      {
        offset: row.generated * 4,
        targetWord: row.target,
        evidence: [
          actual === undefined
            ? `The target calls ${callee} here; your output's call names no function.`
            : `The target calls ${callee} here; your output calls ${actual}.`,
        ],
      },
    ];
  });
}

/**
 * The callee of each call in a target, by word. An unlinked target names it
 * in its relocation; a linked one in its recorded calls (ADR 0024).
 */
export function targetCallees(target: MatchTarget): Map<number, string> {
  if (target.kind === "linked") {
    return new Map(target.calls.map((call) => [call.word, call.callee]));
  }
  return new Map(
    target.relocations.flatMap((relocation) => {
      const word = relocation.offset / 4;
      const { target: identity } = relocation;
      if (
        relocation.kind !== "MIPS26" ||
        !isJal(target.words[word] ?? 0) ||
        identity.kind !== "symbol" ||
        identity.addend !== 0
      ) {
        return [];
      }
      return [[word, identity.name] as const];
    }),
  );
}

/** The callee each generated call names, by word. */
export function generatedCallees(
  generated: GeneratedFunction,
): Map<number, string> {
  return new Map(
    generatedCalls(generated).flatMap(({ word, callee }) =>
      callee === undefined ? [] : [[word, callee] as const],
    ),
  );
}

/**
 * A call as the player reads it. The field of a `jal` is filled in by the
 * linker, so the words show zero, or a linked address, where the source
 * names a function; the callee takes its place when it is known.
 */
export function callText(
  text: string,
  word: number,
  callee: string | undefined,
): string {
  return callee !== undefined && isJal(word) ? `jal ${callee}` : text;
}
