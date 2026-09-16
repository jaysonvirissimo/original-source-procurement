import type { MatchResult } from "@osp/matching-core";
import { Fragment, type ReactElement } from "react";
import { mismatchLabel } from "../diff/diffLabels";
import type { HintUsage } from "../workspace/workspaceReducer";
import { hintUsageText } from "./hintUsageText";
import styles from "./MatchSummary.module.css";

interface MatchSummaryProps {
  readonly result: MatchResult;
  /** Hints opened so far. Opening hints never blocks completion. */
  readonly hints: HintUsage;
}

/** Exactness is authoritative; the counts are for teaching. */
export function MatchSummary({
  result,
  hints,
}: MatchSummaryProps): ReactElement {
  const { summary } = result;
  return (
    <dl className={styles.summary} aria-label="Match summary">
      <dt>EXACT MATCH</dt>
      <dd className={summary.exact ? styles.yes : styles.no}>
        {summary.exact ? "YES" : "NO"}
      </dd>
      <dt>INSTRUCTIONS</dt>
      <dd>
        {summary.equalWords} / {summary.targetWords}
      </dd>
      <dt>GENERATED WORDS</dt>
      <dd>{summary.generatedWords}</dd>
      <dt>HINTS</dt>
      <dd>{hintUsageText(hints)}</dd>
      {Object.entries(summary.byKind).map(([kind, count]) => (
        <Fragment key={kind}>
          <dt>{mismatchLabel(kind).toUpperCase()}</dt>
          <dd>
            {count} {count === 1 ? "difference" : "differences"}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
