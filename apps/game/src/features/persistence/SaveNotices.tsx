import type { ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import styles from "./PersistenceProvider.module.css";
import { usePlayerProgress } from "./progressContext";

/** Tells the player when progress is not being saved, or was not fully loaded. */
export function SaveNotices(): ReactElement | null {
  const { persistent, skippedRecords, saveStatus, retrySave, dismissSkipped } =
    usePlayerProgress();

  if (persistent && skippedRecords === 0 && saveStatus.kind !== "failed") {
    return null;
  }
  return (
    <div className={styles.notices}>
      {persistent ? null : (
        <p className={styles.notice}>
          Progress in this tab is not being saved.
        </p>
      )}
      {skippedRecords === 0 ? null : (
        <div className={styles.notice}>
          <p>
            OSP skipped {String(skippedRecords)} saved{" "}
            {skippedRecords === 1 ? "record" : "records"} it couldn't read. They
            are still stored. Export your save before you reset progress.
          </p>
          <button
            className={controls.button}
            type="button"
            onClick={dismissSkipped}
          >
            Dismiss
          </button>
        </div>
      )}
      {saveStatus.kind === "failed" ? (
        <div className={styles.alert} role="alert">
          <p>{saveStatus.error.message}</p>
          <button className={controls.button} type="button" onClick={retrySave}>
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
