import { decode, type AssembledObject } from "psyq-asm";
import { align, maskedEqual } from "./align.ts";
import { at } from "./at.ts";
import { compareLinkedCalls } from "./calls.ts";
import { classify, text } from "./classify.ts";
import { definedFunctions, extractFunction } from "./extract.ts";
import { linkConsequences } from "./nops.ts";
import { gpRelative, instructionOrder } from "./regroup.ts";
import { compareRelocations } from "./relocations.ts";
import type {
  FieldDifference,
  GeneratedFunction,
  MatchOutcome,
  MatchResult,
  MatchTarget,
  MismatchKind,
} from "./types.ts";

/**
 * Compares one generated function with its target. Exactness is decided on
 * words outside the generated relocation masks, plus relocations for an
 * unlinked target or recorded callees for a linked one. Alignment and
 * classification only explain differences.
 */
export function compareFunction(
  generated: GeneratedFunction,
  target: MatchTarget,
): MatchResult {
  const targetWords = Array.from(target.words, (word) => word >>> 0);
  const generatedWords = generated.words;
  const rows = align(targetWords, generatedWords);
  const relocationFindings =
    target.kind === "unlinked"
      ? compareRelocations(generated.relocations, target.relocations)
      : compareLinkedCalls(rows, target.calls, generated);
  const classified = classify(
    rows,
    targetWords,
    generatedWords,
    relocationFindings,
  );
  const regrouped = instructionOrder(
    gpRelative(classified, rows, targetWords, generatedWords),
    rows,
    targetWords,
    generatedWords,
  );
  const drafts = linkConsequences(regrouped, rows, targetWords, generatedWords);

  const wordsExact =
    targetWords.length === generatedWords.length &&
    generatedWords.every((word, index) =>
      maskedEqual(at(targetWords, index), word.word, word.mask),
    );
  const exact = wordsExact && relocationFindings.length === 0;

  const fieldDifferences: FieldDifference[] = rows.flatMap((row) => {
    if (row.status !== "field-only") {
      return [];
    }
    const targetWord = at(targetWords, row.target);
    const generatedWord = at(generatedWords, row.generated).word;
    return generated.relocations
      .filter(
        (relocation) =>
          relocation.offset === row.generated * 4 &&
          ((targetWord ^ generatedWord) & relocation.fieldMask) !== 0,
      )
      .map((relocation) => ({
        index: row.generated,
        relocation: relocation.kind,
        fieldMask: relocation.fieldMask,
        target: (targetWord & relocation.fieldMask) >>> 0,
        generated: (generatedWord & relocation.fieldMask) >>> 0,
      }));
  });

  const byKind: Partial<Record<MismatchKind, number>> = {};
  for (const mismatch of drafts) {
    byKind[mismatch.kind] = (byKind[mismatch.kind] ?? 0) + 1;
  }
  const alignment = rows.map((row, index) => ({
    ...row,
    mismatchIds: drafts
      .filter((mismatch) => mismatch.rows.includes(index))
      .map((mismatch) => mismatch.id),
  }));
  // A word counts as equal only when no mismatch, such as a differing
  // relocation, is reported on its row.
  const equalWords = alignment.filter(
    (row) =>
      (row.status === "equal" || row.status === "field-only") &&
      row.mismatchIds.length === 0,
  ).length;

  return {
    exact,
    score: exact
      ? 1
      : equalWords / Math.max(targetWords.length, generatedWords.length),
    target: targetWords.map((word, index) => ({
      index,
      word,
      text: text(decode(word)),
      fieldMask: 0,
    })),
    generated: generatedWords.map((word, index) => ({
      index,
      word: word.word,
      text: text(decode(word.word)),
      ...(word.origin === undefined ? {} : { origin: word.origin }),
      fieldMask: word.mask,
    })),
    alignment,
    mismatches: drafts.map((mismatch) => ({
      id: mismatch.id,
      kind: mismatch.kind,
      targetRange: mismatch.targetRange,
      generatedRange: mismatch.generatedRange,
      confidence: mismatch.confidence,
      evidence: mismatch.evidence,
      ...(mismatch.consequenceOf === undefined
        ? {}
        : { consequenceOf: mismatch.consequenceOf }),
    })),
    fieldDifferences,
    summary: {
      exact,
      equalWords,
      targetWords: targetWords.length,
      generatedWords: generatedWords.length,
      byKind,
    },
  };
}

/**
 * Matches the function named `symbol` in an assembled object against its
 * target. An object without that function yields `function-missing`, and no
 * comparison runs.
 */
export function matchFunction(
  object: AssembledObject,
  symbol: string,
  target: MatchTarget,
): MatchOutcome {
  const generated = extractFunction(object, symbol);
  if (generated === undefined) {
    return {
      kind: "function-missing",
      symbol,
      definedFunctions: definedFunctions(object),
    };
  }
  return { kind: "matched", result: compareFunction(generated, target) };
}
