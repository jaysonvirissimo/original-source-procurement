import type { Mismatch, TeachingHypothesis } from "@osp/matching-core";
import type { ReactElement } from "react";
import {
  MISMATCH_EXPLANATIONS,
  mismatchKindOf,
  mismatchLabel,
} from "./diffLabels";
import styles from "./DiffPanel.module.css";

interface MismatchEvidenceProps {
  readonly mismatches: readonly Mismatch[];
  readonly hypotheses: readonly TeachingHypothesis[];
  /** The mismatch whose rows are marked and whose details are open. */
  readonly selected: string | undefined;
  readonly onSelect: (id: string | undefined) => void;
}

/**
 * Every mismatch with its evidence. Selecting one marks its rows and opens
 * what the kind means and any hypotheses about its cause. Nothing opens by
 * itself.
 */
export function MismatchEvidence({
  mismatches,
  hypotheses,
  selected,
  onSelect,
}: MismatchEvidenceProps): ReactElement | null {
  if (mismatches.length === 0) {
    return null;
  }
  return (
    <ul className={styles.mismatches} aria-label="Mismatches">
      {mismatches.map((mismatch) => {
        const open = mismatch.id === selected;
        const related = hypotheses.filter((hypothesis) =>
          hypothesis.evidenceMismatchIds.includes(mismatch.id),
        );
        const cause = mismatch.consequenceOf;
        return (
          <li
            className={styles.mismatch}
            key={mismatch.id}
            data-selected={open}
          >
            <p className={styles.kind}>
              <button
                className={styles.kindButton}
                type="button"
                aria-expanded={open}
                onClick={() => {
                  onSelect(open ? undefined : mismatch.id);
                }}
              >
                {mismatchLabel(mismatch.kind)}
              </button>
              {cause === undefined ? null : (
                <>
                  {" · caused by "}
                  <button
                    className={styles.kindButton}
                    type="button"
                    onClick={() => {
                      onSelect(cause);
                    }}
                  >
                    {mismatchLabel(mismatchKindOf(cause))}
                  </button>
                </>
              )}
            </p>
            {mismatch.evidence.map((line, index) => (
              <p className={styles.evidence} key={index}>
                {line}
              </p>
            ))}
            {open ? (
              <div className={styles.details}>
                <p>{MISMATCH_EXPLANATIONS[mismatch.kind]}</p>
                {related.length === 0 ? null : (
                  <ul className={styles.hypotheses} aria-label="Hypotheses">
                    {related.map((hypothesis) => (
                      <li key={hypothesis.kind}>
                        <span className={styles.hypothesisLabel}>
                          HYPOTHESIS
                        </span>{" "}
                        {hypothesis.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
