import type { EvidencePrompt } from "@osp/mission-schema";
import { useId, useState, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import styles from "./PredictionPanel.module.css";

interface EvidencePanelProps {
  readonly prompt: EvidencePrompt;
  /** The target instructions, one per word. */
  readonly lines: readonly string[];
  /** A current matched build exists, so an acknowledgement can count. */
  readonly canAcknowledge: boolean;
  /** The selection outside the evidence last acknowledged, if any. */
  readonly miss: number | undefined;
  readonly onAcknowledge: (word: number) => void;
}

/**
 * A demonstration's question: the player finds the instruction that shows
 * the evidence, then acknowledges it. A wrong selection only points again.
 */
export function EvidencePanel({
  prompt,
  lines,
  canAcknowledge,
  miss,
  onAcknowledge,
}: EvidencePanelProps): ReactElement {
  const [word, setWord] = useState<number | undefined>(undefined);
  const name = useId();

  return (
    <fieldset className={styles.prediction}>
      <legend className={controls.label}>EVIDENCE</legend>
      <p>{prompt.question}</p>
      <div className={styles.lines}>
        {lines.map((line, index) => (
          <label className={styles.choice} key={index}>
            <input
              type="radio"
              name={name}
              checked={word === index}
              onChange={() => {
                setWord(index);
              }}
            />
            <span>Word {index} ·</span> <code>{line}</code>
          </label>
        ))}
      </div>
      <button
        className={controls.button}
        type="button"
        disabled={word === undefined || !canAcknowledge}
        onClick={() => {
          /* v8 ignore next -- the button is disabled until a word is selected. */
          if (word !== undefined) {
            onAcknowledge(word);
          }
        }}
      >
        Acknowledge evidence
      </button>
      {canAcknowledge ? null : (
        <p className={styles.dim}>
          Compile the current source, then select the instruction.
        </p>
      )}
      {miss === undefined ? null : <p role="status">{prompt.retry}</p>}
    </fieldset>
  );
}
