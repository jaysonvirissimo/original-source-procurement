import { decode } from "psyq-asm";
import { maskedEqual, type AlignedRow } from "./align.ts";
import { at } from "./at.ts";
import type { Decoded } from "./classes.ts";
import { draft, text, type DraftMismatch } from "./classify.ts";
import type { GeneratedWord, InstructionRange, MismatchKind } from "./types.ts";

/** The global pointer register, `$gp`. */
const GP = 28;

interface PairRow {
  readonly status: "different";
  readonly target: number;
  readonly generated: number;
}

function isPair(row: AlignedRow): row is PairRow {
  return row.status === "different";
}

function differs(row: AlignedRow): boolean {
  return row.status !== "equal" && row.status !== "field-only";
}

/** Target and generated instructions on a row; absent on the side with a gap. */
function sides(
  row: AlignedRow,
  target: readonly number[],
  generated: readonly GeneratedWord[],
): readonly (Decoded | undefined)[] {
  return [
    row.status === "inserted" ? undefined : decode(at(target, row.target)),
    row.status === "deleted"
      ? undefined
      : decode(at(generated, row.generated).word),
  ];
}

function readsGp(instruction: Decoded | undefined): boolean {
  return (
    instruction !== undefined &&
    instruction.mnemonic !== ".word" &&
    instruction.reads.includes(GP)
  );
}

function span(ranges: readonly InstructionRange[]): InstructionRange {
  return {
    start: Math.min(...ranges.map((range) => range.start)),
    end: Math.max(...ranges.map((range) => range.end)),
  };
}

/**
 * Replaces `members` with one mismatch of `kind`, placed where the first
 * member was. Its evidence starts with `lead`; member evidence follows when
 * it still describes the difference.
 */
function merge(
  mismatches: readonly DraftMismatch[],
  members: ReadonlySet<DraftMismatch>,
  kind: MismatchKind,
  lead: readonly string[],
  keepEvidence: boolean,
): DraftMismatch[] {
  const group = mismatches.filter((mismatch) => members.has(mismatch));
  const merged = draft(
    kind,
    span(group.map((mismatch) => mismatch.targetRange)),
    span(group.map((mismatch) => mismatch.generatedRange)),
    [...new Set(group.flatMap((mismatch) => mismatch.rows))].sort(
      (first, second) => first - second,
    ),
    [
      ...new Set([
        ...lead,
        ...(keepEvidence ? group.flatMap((mismatch) => mismatch.evidence) : []),
      ]),
    ],
  );
  const first = mismatches.findIndex((mismatch) => members.has(mismatch));
  return mismatches.flatMap((mismatch, index) => {
    if (index === first) {
      return [merged];
    }
    return members.has(mismatch) ? [] : [mismatch];
  });
}

function membersOn(
  mismatches: readonly DraftMismatch[],
  rows: readonly number[],
): Set<DraftMismatch> {
  return new Set(
    mismatches.filter((mismatch) =>
      mismatch.rows.some((row) => rows.includes(row)),
    ),
  );
}

/** Ascending row indexes split into runs of adjacent rows. */
function adjacentRuns(indexes: readonly number[]): number[][] {
  const runs: number[][] = [];
  for (const index of indexes) {
    const run = runs.at(-1);
    if (run !== undefined && index - at(run, run.length - 1) === 1) {
      run.push(index);
    } else {
      runs.push([index]);
    }
  }
  return runs;
}

/**
 * Reports data reached through `$gp` on one side only as one `GP_RELATIVE`
 * mismatch. It covers the changed rows that read `$gp` on one side, the
 * neighbouring `lui` that builds the address on the other side, and whatever
 * else was reported on those rows.
 */
export function gpRelative(
  mismatches: readonly DraftMismatch[],
  rows: readonly AlignedRow[],
  target: readonly number[],
  generated: readonly GeneratedWord[],
): DraftMismatch[] {
  const seeds = rows.flatMap((row, index) => {
    const [expected, actual] = sides(row, target, generated);
    return differs(row) && readsGp(expected) !== readsGp(actual) ? [index] : [];
  });
  const cluster = rows.flatMap((row, index) =>
    seeds.includes(index) ||
    (differs(row) &&
      seeds.some((seed) => Math.abs(seed - index) === 1) &&
      sides(row, target, generated).some(
        (instruction) => instruction?.mnemonic === "lui",
      ))
      ? [index]
      : [],
  );
  return adjacentRuns(cluster).reduce<DraftMismatch[]>(
    (current, run) =>
      merge(
        current,
        membersOn(current, run),
        "GP_RELATIVE",
        [
          run.some((index) =>
            readsGp(sides(at(rows, index), target, generated)[0]),
          )
            ? "The target reaches this data through $gp; your output does not."
            : "Your output reaches this data through $gp; the target does not.",
        ],
        true,
      ),
    [...mismatches],
  );
}

/** Whether the generated words are the target words in some order. */
function sameWords(
  targetWords: readonly number[],
  generatedWords: readonly GeneratedWord[],
): boolean {
  if (targetWords.length !== generatedWords.length) {
    return false;
  }
  const unused = [...targetWords];
  return generatedWords.every((word) => {
    const index = unused.findIndex((candidate) =>
      maskedEqual(candidate, word.word, word.mask),
    );
    if (index === -1) {
      return false;
    }
    unused.splice(index, 1);
    return true;
  });
}

function listing(words: readonly number[]): string {
  return words.map((word) => text(decode(word))).join("; ");
}

/**
 * The first window of two or more consecutive changed pairs whose words are
 * reordered. Equal rows between them do not break a window.
 */
function reorderedWindow(
  pairs: readonly PairRow[],
  target: readonly number[],
  generated: readonly GeneratedWord[],
): readonly PairRow[] | undefined {
  for (let first = 0; first < pairs.length - 1; first += 1) {
    for (let stop = first + 2; stop <= pairs.length; stop += 1) {
      const window = pairs.slice(first, stop);
      if (
        sameWords(
          window.map((row) => at(target, row.target)),
          window.map((row) => at(generated, row.generated)),
        )
      ) {
        return window;
      }
    }
  }
  return undefined;
}

/**
 * Reports the same instructions in a different order as `INSTRUCTION_ORDER`:
 * consecutive changed pairs whose words are a permutation of each other, or a
 * missing run and an extra run holding the same words.
 */
export function instructionOrder(
  mismatches: readonly DraftMismatch[],
  rows: readonly AlignedRow[],
  target: readonly number[],
  generated: readonly GeneratedWord[],
): DraftMismatch[] {
  let result = [...mismatches];
  let remaining = rows.flatMap((row, index) => (isPair(row) ? [index] : []));
  for (;;) {
    const pairs = remaining.map((index) => at(rows, index)).filter(isPair);
    const window = reorderedWindow(pairs, target, generated);
    if (window === undefined) {
      break;
    }
    const windowRows = window.map((row) => rows.indexOf(row));
    result = merge(
      result,
      membersOn(result, windowRows),
      "INSTRUCTION_ORDER",
      [
        `The same instructions appear in a different order. Target: ${listing(
          window.map((row) => at(target, row.target)),
        )}. Yours: ${listing(
          window.map((row) => at(generated, row.generated).word),
        )}.`,
      ],
      false,
    );
    const last = at(windowRows, windowRows.length - 1);
    remaining = remaining.filter((index) => index > last);
  }

  const used = new Set<DraftMismatch>();
  for (const missing of result.filter(
    (mismatch) => mismatch.kind === "MISSING_INSTRUCTION",
  )) {
    const missingWords = target.slice(
      missing.targetRange.start,
      missing.targetRange.end,
    );
    // A nop only moves because something around it changed.
    if (missingWords.every((word) => word === 0)) {
      continue;
    }
    const extra = result
      .filter(
        (candidate) =>
          candidate.kind === "EXTRA_INSTRUCTION" &&
          !used.has(candidate) &&
          sameWords(
            missingWords,
            generated.slice(
              candidate.generatedRange.start,
              candidate.generatedRange.end,
            ),
          ),
      )
      .map((candidate) => ({
        candidate,
        distance: Math.abs(at(candidate.rows, 0) - at(missing.rows, 0)),
      }))
      .sort((first, second) => first.distance - second.distance)[0];
    if (extra === undefined) {
      continue;
    }
    used.add(extra.candidate);
    result = merge(
      result,
      new Set([missing, extra.candidate]),
      "INSTRUCTION_ORDER",
      [
        `The same instructions appear in a different place: ${listing(missingWords)}.`,
      ],
      false,
    );
  }
  return result;
}
