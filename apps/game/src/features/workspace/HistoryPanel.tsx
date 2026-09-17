import type { Hint } from "@osp/mission-schema";
import { useId, useState, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import type { Attempt } from "../persistence/schema";
import { openedHintsLabel } from "./hintLabel";
import history from "./HistoryPanel.module.css";
import styles from "./ReferencePane.module.css";

interface HistoryPanelProps {
  readonly attempts: readonly Attempt[];
  /** The mission's hint ladder, for naming how far each attempt's hints went. */
  readonly hints: readonly Hint[];
  readonly onPin: (attemptId: string, pinned: boolean) => void;
  readonly onRestore: (attempt: Attempt) => void;
  /** Removes every unpinned attempt. */
  readonly onClear: () => void;
  readonly onClose: () => void;
}

/** The mission's saved attempts, newest first, beside the listing. */
export function HistoryPanel({
  attempts,
  hints,
  onPin,
  onRestore,
  onClear,
  onClose,
}: HistoryPanelProps): ReactElement {
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  const newestFirst = attempts.toSorted((a, b) =>
    b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0,
  );
  const clearable = attempts.some((attempt) => !attempt.pinned);

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2
          className={classNames(controls.label, styles.heading)}
          id={titleId}
          tabIndex={-1}
        >
          History
        </h2>
        <button className={controls.button} type="button" onClick={onClose}>
          Close
        </button>
      </header>
      {newestFirst.length === 0 ? (
        <p className={styles.dim}>
          Each compile that produces a comparison is kept here, with its source.
          The latest 50 are kept; pin an attempt to keep it longer.
        </p>
      ) : (
        <ol className={styles.list} aria-label="Attempts">
          {newestFirst.map((attempt) => (
            <li className={styles.item} key={attempt.id}>
              <p className={controls.label}>
                {new Date(attempt.createdAt).toLocaleString()}
              </p>
              <p className={attempt.exact ? history.exact : undefined}>
                {attempt.exact
                  ? "EXACT MATCH"
                  : `${String(attempt.mismatchSummary.equalWords)} of ${String(attempt.mismatchSummary.targetWords)} words match`}
              </p>
              {/* Attempts saved before hint stages were recorded say nothing. */}
              {attempt.hintStage === undefined ? null : (
                <p className={styles.dim}>
                  {attempt.hintStage === 0
                    ? "No hints"
                    : openedHintsLabel(hints, attempt.hintStage)}
                </p>
              )}
              <div className={history.actions}>
                <button
                  className={controls.button}
                  type="button"
                  aria-pressed={attempt.pinned}
                  onClick={() => {
                    onPin(attempt.id, !attempt.pinned);
                  }}
                >
                  Pin
                </button>
                <button
                  className={controls.button}
                  type="button"
                  onClick={() => {
                    onRestore(attempt);
                  }}
                >
                  Restore
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {!clearable ? null : confirming ? (
        <div className={history.actions}>
          <p className={styles.dim}>
            Clear unpinned attempts? Pinned attempts stay.
          </p>
          <button
            className={controls.button}
            type="button"
            onClick={() => {
              setConfirming(false);
              onClear();
            }}
          >
            Clear
          </button>
          <button
            className={controls.button}
            type="button"
            onClick={() => {
              setConfirming(false);
            }}
          >
            Keep history
          </button>
        </div>
      ) : (
        <button
          className={controls.button}
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
        >
          Clear history
        </button>
      )}
    </section>
  );
}
