import { decode } from "psyq-asm";
import { at } from "./at.ts";
import { INSTRUCTION_CLASSES } from "./classes.ts";
import type { GeneratedWord } from "./types.ts";

/** Alignment costs. Tests lock the alignments these produce. */
export const ALIGNMENT_COSTS = {
  sameMnemonic: 1,
  sameClass: 2,
  unrelated: 4,
  gap: 3,
} as const;

export type AlignedRow =
  | {
      readonly status: "equal" | "field-only" | "different";
      readonly target: number;
      readonly generated: number;
    }
  | { readonly status: "deleted"; readonly target: number }
  | { readonly status: "inserted"; readonly generated: number };

type Move = "diagonal" | "deleted" | "inserted";

/** Equal outside the relocated bits in `mask`. */
export function maskedEqual(
  target: number,
  generated: number,
  mask: number,
): boolean {
  return ((target ^ generated) & ~mask) === 0;
}

function pairCost(target: number, generated: GeneratedWord): number {
  if (maskedEqual(target, generated.word, generated.mask)) {
    return 0;
  }
  const expected = decode(target);
  const actual = decode(generated.word);
  if (expected.mnemonic === ".word" || actual.mnemonic === ".word") {
    return ALIGNMENT_COSTS.unrelated;
  }
  if (expected.mnemonic === actual.mnemonic) {
    return ALIGNMENT_COSTS.sameMnemonic;
  }
  return INSTRUCTION_CLASSES[expected.mnemonic] ===
    INSTRUCTION_CLASSES[actual.mnemonic]
    ? ALIGNMENT_COSTS.sameClass
    : ALIGNMENT_COSTS.unrelated;
}

function pairStatus(target: number, generated: GeneratedWord) {
  if (target === generated.word) {
    return "equal";
  }
  return maskedEqual(target, generated.word, generated.mask)
    ? "field-only"
    : "different";
}

/**
 * Aligns target words with generated words by weighted global sequence
 * alignment. Relocated fields are ignored when pairing words. Ties prefer
 * pairing, then a deleted target word, then an inserted generated word, so
 * the result is deterministic.
 */
export function align(
  target: readonly number[],
  generated: readonly GeneratedWord[],
): AlignedRow[] {
  const width = generated.length + 1;
  const costs: number[] = [];
  const moves: Move[] = [];
  for (let row = 0; row <= target.length; row++) {
    for (let column = 0; column <= generated.length; column++) {
      if (row === 0 && column === 0) {
        costs.push(0);
        moves.push("diagonal");
        continue;
      }
      const candidates: [number, Move][] = [];
      if (row > 0 && column > 0) {
        candidates.push([
          at(costs, (row - 1) * width + column - 1) +
            pairCost(at(target, row - 1), at(generated, column - 1)),
          "diagonal",
        ]);
      }
      if (row > 0) {
        candidates.push([
          at(costs, (row - 1) * width + column) + ALIGNMENT_COSTS.gap,
          "deleted",
        ]);
      }
      if (column > 0) {
        candidates.push([
          at(costs, row * width + column - 1) + ALIGNMENT_COSTS.gap,
          "inserted",
        ]);
      }
      const [cost, move] = candidates.reduce((best, candidate) =>
        candidate[0] < best[0] ? candidate : best,
      );
      costs.push(cost);
      moves.push(move);
    }
  }

  const rows: AlignedRow[] = [];
  let row = target.length;
  let column = generated.length;
  while (row > 0 || column > 0) {
    const move = at(moves, row * width + column);
    if (move === "diagonal") {
      row -= 1;
      column -= 1;
      rows.push({
        status: pairStatus(at(target, row), at(generated, column)),
        target: row,
        generated: column,
      });
    } else if (move === "deleted") {
      row -= 1;
      rows.push({ status: "deleted", target: row });
    } else {
      column -= 1;
      rows.push({ status: "inserted", generated: column });
    }
  }
  return rows.reverse();
}
