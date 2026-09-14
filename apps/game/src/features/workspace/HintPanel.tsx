import type { Mission } from "@osp/mission-schema";
import { useId, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import styles from "./OverlayPanel.module.css";

interface HintPanelProps {
  readonly mission: Pick<Mission, "hints" | "solution">;
  /** The highest stage revealed, or 0. */
  readonly stage: number;
  readonly onReveal: () => void;
  readonly onClose: () => void;
}

/**
 * The hint ladder, one stage at a time. A revealed solution is read-only
 * text; nothing inserts it into the editor.
 */
export function HintPanel({
  mission,
  stage,
  onReveal,
  onClose,
}: HintPanelProps): ReactElement {
  const titleId = useId();
  const revealed = mission.hints.filter((hint) => hint.stage <= stage);
  const next = mission.hints.find((hint) => hint.stage > stage);

  return (
    <section className={styles.overlay} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 className={controls.label} id={titleId}>
          Hints
        </h2>
        <button className={controls.button} type="button" onClick={onClose}>
          Close
        </button>
      </header>
      {revealed.length === 0 ? (
        <p className={styles.dim}>
          Each hint gives away more than the one before it. Using hints never
          blocks completion.
        </p>
      ) : (
        <ol className={styles.list}>
          {revealed.map((hint) => (
            <li className={styles.item} key={hint.stage}>
              <p className={controls.label}>Stage {hint.stage}</p>
              <p>{hint.text}</p>
              {hint.highlight === undefined ? null : (
                <p className={styles.dim}>
                  Target rows marked HINT show where to look.
                </p>
              )}
              {hint.revealSolution === true ? (
                <pre className={styles.code} aria-label="Solution">
                  {mission.solution}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <button
        className={controls.button}
        type="button"
        disabled={next === undefined}
        onClick={onReveal}
      >
        {next === undefined
          ? "No more hints"
          : next.stage === 9
            ? "Reveal the solution"
            : "Reveal next hint"}
      </button>
    </section>
  );
}
