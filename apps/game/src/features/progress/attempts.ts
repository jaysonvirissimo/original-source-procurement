import type { MatchResult } from "@osp/matching-core";
import type { ToolchainInfo } from "../compiler/types";
import type { Attempt, BestMatch } from "../persistence/schema";

/** Unpinned attempts kept per mission. Pinned attempts do not count. */
export const ATTEMPT_LIMIT = 50;

export interface AttemptFacts {
  readonly id: string;
  readonly missionId: string;
  readonly createdAt: string;
  /** The source that was built, which may differ from the editor by now. */
  readonly source: string;
  readonly match: MatchResult;
  readonly info: ToolchainInfo;
  readonly aspsxVersion: Attempt["aspsxVersion"];
}

export function attemptFrom(facts: AttemptFacts): Attempt {
  const { summary } = facts.match;
  const byKind: Record<string, number> = {};
  for (const [kind, count] of Object.entries(summary.byKind)) {
    byKind[kind] = count;
  }
  return {
    id: facts.id,
    missionId: facts.missionId,
    createdAt: facts.createdAt,
    source: facts.source,
    exact: facts.match.exact,
    score: facts.match.score,
    mismatchSummary: {
      exact: summary.exact,
      equalWords: summary.equalWords,
      targetWords: summary.targetWords,
      byKind,
    },
    compilerBuildId: facts.info.psyqWasm.buildId,
    preprocessorBuildId: facts.info.psyqWasm.preprocessorBuildId,
    psyqAsmVersion: facts.info.psyqAsmVersion,
    aspsxVersion: facts.aspsxVersion,
    pinned: false,
  };
}

/**
 * Keeps every pinned attempt and the newest `limit` unpinned ones, in their
 * original order. Returns `attempts` itself when nothing is dropped.
 */
export function pruneAttempts(
  attempts: Attempt[],
  limit: number = ATTEMPT_LIMIT,
): Attempt[] {
  const unpinned = attempts.filter((attempt) => !attempt.pinned);
  if (unpinned.length <= limit) {
    return attempts;
  }
  const dropped = new Set(
    unpinned
      .toSorted((a, b) => compareText(a.createdAt, b.createdAt))
      .slice(0, unpinned.length - limit)
      .map((attempt) => attempt.id),
  );
  return attempts.filter((attempt) => !dropped.has(attempt.id));
}

/** An exact match beats any other; otherwise the higher score wins. Ties keep the earlier one. */
export function betterMatch(
  best: BestMatch | undefined,
  attempt: Attempt,
): BestMatch {
  if (
    best !== undefined &&
    (best.exact || (!attempt.exact && best.score >= attempt.score))
  ) {
    return best;
  }
  return {
    attemptId: attempt.id,
    exact: attempt.exact,
    score: attempt.score,
    equalWords: attempt.mismatchSummary.equalWords,
    targetWords: attempt.mismatchSummary.targetWords,
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
