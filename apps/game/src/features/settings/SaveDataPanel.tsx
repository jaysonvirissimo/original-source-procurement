import { useId, useState, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import { storageError } from "../persistence/errors";
import { usePlayerProgress, useSaveData } from "../persistence/progressContext";
import styles from "./SaveDataPanel.module.css";

type Pending =
  | { readonly kind: "import"; readonly file: File }
  | { readonly kind: "reset" }
  | undefined;

type Outcome =
  { readonly tone: "done" | "error"; readonly text: string } | undefined;

/**
 * Export, import, and reset. Save files are read and written in this
 * browser; nothing is uploaded.
 */
export function SaveDataPanel(): ReactElement {
  const { exportSave, importSave, resetProgress, clearDownloadedData } =
    useSaveData();
  const { now } = usePlayerProgress();
  const titleId = useId();
  const fileId = useId();
  const [pending, setPending] = useState<Pending>(undefined);
  const [outcome, setOutcome] = useState<Outcome>(undefined);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, done: string) => {
    setPending(undefined);
    setOutcome(undefined);
    setBusy(true);
    try {
      await action();
      setOutcome({ tone: "done", text: done });
    } catch (error) {
      setOutcome({ tone: "error", text: storageError(error, "write").message });
    } finally {
      setBusy(false);
    }
  };

  const exportFile = () => {
    const url = URL.createObjectURL(exportSave());
    const link = document.createElement("a");
    link.href = url;
    link.download = `osp-save-${now().slice(0, 10)}.json`;
    link.click();
    // Revoking during the click can cancel the download in some browsers.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    setOutcome({ tone: "done", text: "Save exported." });
  };

  const cancel = () => {
    setPending(undefined);
  };

  const renderControls = (): ReactElement => {
    if (pending?.kind === "import") {
      const { file } = pending;
      return (
        <div className={styles.confirm}>
          <p>Importing {file.name} replaces all progress in this browser.</p>
          <div className={styles.actions}>
            <button
              className={classNames(controls.button, controls.primary)}
              type="button"
              onClick={() => {
                void run(() => importSave(file), "Save imported.");
              }}
            >
              Replace progress
            </button>
            <button className={controls.button} type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      );
    }
    if (pending?.kind === "reset") {
      return (
        <div className={styles.confirm}>
          <p>
            Resetting deletes all progress, attempts, and downloaded game data
            in this browser. Export your save first to keep a copy.
          </p>
          <div className={styles.actions}>
            <button
              className={classNames(controls.button, controls.primary)}
              type="button"
              onClick={() => {
                void run(resetProgress, "Progress reset.");
              }}
            >
              Reset progress
            </button>
            <button className={controls.button} type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.actions}>
        <button
          className={controls.button}
          type="button"
          disabled={busy}
          onClick={exportFile}
        >
          Export save
        </button>
        <input
          className={classNames(controls.visuallyHidden, styles.fileInput)}
          id={fileId}
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clear the choice so the same file can be chosen again.
            event.target.value = "";
            if (file !== undefined) {
              setOutcome(undefined);
              setPending({ kind: "import", file });
            }
          }}
        />
        <label
          className={classNames(controls.button, styles.fileButton)}
          htmlFor={fileId}
        >
          Import save
        </label>
        <button
          className={controls.button}
          type="button"
          disabled={busy}
          onClick={() => {
            setOutcome(undefined);
            setPending({ kind: "reset" });
          }}
        >
          Reset progress
        </button>
        <button
          className={controls.button}
          type="button"
          disabled={busy}
          onClick={() => {
            void run(clearDownloadedData, "Downloaded game data cleared.");
          }}
        >
          Clear downloaded game data
        </button>
      </div>
    );
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 className={styles.title} id={titleId}>
        Save data
      </h2>
      {renderControls()}
      <div aria-live="polite">
        {outcome?.tone === "done" ? (
          <p className={styles.done}>{outcome.text}</p>
        ) : null}
      </div>
      {outcome?.tone === "error" ? (
        <p className={styles.error} role="alert">
          {outcome.text}
        </p>
      ) : null}
    </section>
  );
}
