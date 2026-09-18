import type { RemoteWords } from "@osp/mission-schema";
import { wordsSha256 } from "./hash.ts";

/**
 * The `dw 0x` values of an upstream assembly file.
 *
 * This is the one text OSP reads from any assembly file, and it is data
 * extraction rather than assembly parsing: the values are the function's
 * words, and everything else in the file is ignored.
 */
const DW_LINE = /^[ \t]*dw[ \t]+0x[0-9A-Fa-f]{1,8}\b/gm;

export function extractDwWords(text: string): number[] {
  return (text.match(DW_LINE) ?? []).map((line) =>
    Number.parseInt(line.slice(line.indexOf("0x") + 2), 16),
  );
}

/** A target that could not be built from a deleted assembly file. */
export type TargetRejection =
  | { readonly reason: "no-words" }
  | {
      readonly reason: "word-count";
      readonly found: number;
      readonly expected: number;
    };

export type TargetOutcome =
  | {
      readonly ok: true;
      readonly target: RemoteWords;
      readonly words: readonly number[];
    }
  | { readonly ok: false; readonly rejection: TargetRejection };

/**
 * Builds a pointer to a function's target words.
 *
 * `expectedWords` comes from upstream's own inventory, so a file whose word
 * count disagrees is a mis-resolved pointer — a moved or reused file name —
 * and is rejected rather than recorded.
 */
export function buildTarget(
  commit: string,
  path: string,
  text: string,
  expectedWords: number,
): TargetOutcome {
  const words = extractDwWords(text);
  if (words.length === 0) {
    return { ok: false, rejection: { reason: "no-words" } };
  }
  if (words.length !== expectedWords) {
    return {
      ok: false,
      rejection: {
        reason: "word-count",
        found: words.length,
        expected: expectedWords,
      },
    };
  }
  return {
    ok: true,
    words,
    target: {
      kind: "remote",
      commit,
      path,
      wordCount: words.length,
      wordsSha256: wordsSha256(words),
    },
  };
}
