import type { PredictionPrompt } from "@osp/mission-schema";
import { useId, useState, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import type { Prediction, PredictionCorrection } from "./completion";
import styles from "./PredictionPanel.module.css";

interface PredictionPanelProps {
  readonly prompt: PredictionPrompt;
  readonly recorded: Prediction | undefined;
  /** A build after the prediction has shown the answer. */
  readonly revealed: boolean;
  readonly onRecord: (choice: number) => void;
  /** The answer chosen after a wrong prediction was revealed. */
  readonly correction: PredictionCorrection | undefined;
  /** The last wrong answer chosen while correcting. */
  readonly correctionMiss: number | undefined;
  /** The current build still shows the answer, so a correction can count. */
  readonly canCorrect: boolean;
  readonly onCorrect: (choice: number) => void;
}

interface ChoicesProps {
  readonly choices: readonly string[];
  readonly choice: number | undefined;
  readonly onChoose: (choice: number) => void;
}

function Choices({ choices, choice, onChoose }: ChoicesProps): ReactElement {
  const name = useId();
  return (
    <div className={styles.choices}>
      {choices.map((text, index) => (
        <label className={styles.choice} key={text}>
          <input
            type="radio"
            name={name}
            checked={choice === index}
            onChange={() => {
              onChoose(index);
            }}
          />
          <code>{text}</code>
        </label>
      ))}
    </div>
  );
}

/**
 * One short question, answered before compiling. It never blocks Compile. A
 * wrong prediction is not a failure: once a build reveals the answer, the
 * player picks the answer the output shows, as often as it takes.
 */
export function PredictionPanel({
  prompt,
  recorded,
  revealed,
  onRecord,
  correction,
  correctionMiss,
  canCorrect,
  onCorrect,
}: PredictionPanelProps): ReactElement {
  const [choice, setChoice] = useState<number | undefined>(undefined);
  const [fix, setFix] = useState<number | undefined>(undefined);

  if (recorded !== undefined) {
    const right = recorded.choice === prompt.answer;
    const settled = right || correction?.choice === prompt.answer;
    return (
      <section className={styles.prediction} aria-label="Prediction">
        <p className={controls.label}>PREDICT</p>
        <p>{prompt.question}</p>
        <p>
          Your prediction: <code>{prompt.choices[recorded.choice]}</code>
        </p>
        {!revealed ? (
          <p className={styles.dim}>
            Compile to check it against the assembled output.
          </p>
        ) : settled ? (
          <>
            <p>
              {right
                ? "Your prediction was correct."
                : "Your prediction was not correct. You found the answer in the output."}
            </p>
            <p>
              Answer: <code>{prompt.choices[prompt.answer]}</code>.{" "}
              {prompt.revealedBy}
            </p>
          </>
        ) : (
          <>
            <p>Your prediction was not correct. {prompt.revealedBy}</p>
            <fieldset className={styles.correction}>
              <legend>Which one does the output show?</legend>
              <Choices
                choices={prompt.choices}
                choice={fix}
                onChoose={setFix}
              />
              <button
                className={controls.button}
                type="button"
                disabled={fix === undefined || !canCorrect}
                onClick={() => {
                  /* v8 ignore next -- the button is disabled until a choice exists. */
                  if (fix !== undefined) {
                    onCorrect(fix);
                  }
                }}
              >
                Check answer
              </button>
              {canCorrect ? null : (
                <p className={styles.dim}>
                  Compile the current source to check your answer.
                </p>
              )}
              {correctionMiss === undefined ? null : (
                <p role="status">
                  Not <code>{prompt.choices[correctionMiss]}</code>. Read the
                  output again.
                </p>
              )}
            </fieldset>
          </>
        )}
      </section>
    );
  }

  return (
    <fieldset className={styles.prediction}>
      <legend className={controls.label}>PREDICT</legend>
      <p>{prompt.question}</p>
      <Choices choices={prompt.choices} choice={choice} onChoose={setChoice} />
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
