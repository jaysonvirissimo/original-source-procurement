import type { PredictionPrompt } from "@osp/mission-schema";
import { useId, useState, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import type { Prediction } from "./completion";
import styles from "./PredictionPanel.module.css";

interface PredictionPanelProps {
  readonly prompt: PredictionPrompt;
  readonly recorded: Prediction | undefined;
  /** A build after the prediction has shown the answer. */
  readonly revealed: boolean;
  readonly onRecord: (choice: number) => void;
}

/** One short question, answered before compiling. It never blocks Compile. */
export function PredictionPanel({
  prompt,
  recorded,
  revealed,
  onRecord,
}: PredictionPanelProps): ReactElement {
  const [choice, setChoice] = useState<number | undefined>(undefined);
  const name = useId();

  if (recorded !== undefined) {
    return (
      <section className={styles.prediction} aria-label="Prediction">
        <p className={controls.label}>PREDICT</p>
        <p>{prompt.question}</p>
        <p>
          Your prediction: <code>{prompt.choices[recorded.choice]}</code>
        </p>
        {revealed ? (
          <>
            <p>
              {recorded.choice === prompt.answer
                ? "Your prediction was correct."
                : "Your prediction was not correct."}
            </p>
            <p>
              Answer: <code>{prompt.choices[prompt.answer]}</code>.{" "}
              {prompt.revealedBy}
            </p>
          </>
        ) : (
          <p className={styles.dim}>
            Compile to check it against the assembled output.
          </p>
        )}
      </section>
    );
  }

  return (
    <fieldset className={styles.prediction}>
      <legend className={controls.label}>PREDICT</legend>
      <p>{prompt.question}</p>
      <div className={styles.choices}>
        {prompt.choices.map((text, index) => (
          <label className={styles.choice} key={text}>
            <input
              type="radio"
              name={name}
              checked={choice === index}
              onChange={() => {
                setChoice(index);
              }}
            />
            <code>{text}</code>
          </label>
        ))}
      </div>
      <button
        className={controls.button}
        type="button"
        disabled={choice === undefined}
        onClick={() => {
          /* v8 ignore next -- the button is disabled until a choice exists. */
          if (choice !== undefined) {
            onRecord(choice);
          }
        }}
      >
        Record prediction
      </button>
    </fieldset>
  );
}
