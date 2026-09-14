import { decode, type WordOriginKind } from "psyq-asm";
import type { AlignedRow } from "./align.ts";
import { at } from "./at.ts";
import type { DraftMismatch } from "./classify.ts";
import type { GeneratedWord } from "./types.ts";

/** Nops the assembler inserts because of a neighbouring instruction. */
const HAZARD_NOPS: ReadonlySet<WordOriginKind> = new Set([
  "load-delay-nop",
  "hilo-gap-nop",
  "cop-delay-nop",
  "gte-gap-nop",
  "branch-delay-nop",
]);

/** How far, in alignment rows, a cause may be from the nop it explains. */
const NEARBY_ROWS = 2;

function registerUse(word: number): string {
  const instruction = decode(word);
  return instruction.mnemonic === ".word"
    ? ".word"
    : JSON.stringify([instruction.reads, instruction.writes]);
}

/** Whether a changed pair reads or writes different registers. */
function changesRegisterUse(
  row: AlignedRow,
  target: readonly number[],
  generated: readonly GeneratedWord[],
): boolean {
  return (
    row.status === "different" &&
    registerUse(at(target, row.target)) !==
      registerUse(at(generated, row.generated).word)
  );
}

/**
 * Links each extra hazard nop to the nearby mismatch that changed which
 * register a neighbouring instruction uses. An unlinked nop is reported as
 * it is, with its assembler note already in its evidence.
 */
export function linkConsequences(
  mismatches: readonly DraftMismatch[],
  rows: readonly AlignedRow[],
  target: readonly number[],
  generated: readonly GeneratedWord[],
): DraftMismatch[] {
  return mismatches.map((mismatch) => {
    if (mismatch.kind !== "EXTRA_INSTRUCTION" || mismatch.rows.length !== 1) {
      return mismatch;
    }
    const nop = at(generated, mismatch.generatedRange.start);
    if (
      nop.word !== 0 ||
      nop.origin === undefined ||
      !HAZARD_NOPS.has(nop.origin.kind)
    ) {
      return mismatch;
    }
    const nopRow = at(mismatch.rows, 0);
    const cause = mismatches
      .map((candidate) => ({
        candidate,
        row: at(candidate.rows, 0),
      }))
      .filter(
        ({ candidate, row }) =>
          candidate !== mismatch &&
          Math.abs(row - nopRow) <= NEARBY_ROWS &&
          changesRegisterUse(at(rows, row), target, generated),
      )
      .sort(
        (first, second) =>
          Math.abs(first.row - nopRow) - Math.abs(second.row - nopRow) ||
          first.row - second.row,
      )[0];
    if (cause === undefined) {
      return mismatch;
    }
    return {
      ...mismatch,
      consequenceOf: cause.candidate.id,
      evidence: [
        ...mismatch.evidence,
        `This nop follows from ${cause.candidate.id}.`,
      ],
    };
  });
}
