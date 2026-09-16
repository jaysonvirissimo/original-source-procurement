import type { Mission } from "@osp/mission-schema";
import { useEffect, useId, useRef, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import { FieldProvenance } from "../field/FieldProvenance";
import type { MissionProvenance } from "../field/provenance";
import { SKILL_STATE_LABELS, type SkillChange } from "../progress/skillState";
import type { HintUsage } from "../workspace/workspaceReducer";
import { hintUsageText } from "./hintUsageText";
import styles from "./MissionComplete.module.css";

export interface PredictionOutcome {
  readonly chosen: string;
  readonly answer: string;
  readonly correct: boolean;
}

interface MissionCompleteProps {
  readonly exact: boolean;
  readonly attempts: number;
  readonly hints: HintUsage;
  /** The prediction recorded before the completing build, if any. */
  readonly prediction: PredictionOutcome | undefined;
  /** Each skill this completion recorded, before and after it. */
  readonly skillChanges: readonly SkillChange[];
  readonly skillNames: ReadonlyMap<string, string>;
  /** The next mission on the recommended path, if there is one. */
  readonly next: Pick<Mission, "id" | "title"> | undefined;
  /** Where a field mission's function was recovered from. */
  readonly provenance?: MissionProvenance | undefined;
  readonly onContinue: () => void;
}

function skillLine(change: SkillChange, name: string): string {
  const state = SKILL_STATE_LABELS[change.after];
  return change.before === change.after
    ? `${name}: still ${state}`
    : `${name}: now ${state}`;
}

/**
 * Shown above the workspace, so the comparison and any prediction
 * correction stay in view until the player continues.
 */
export function MissionComplete({
  exact,
  attempts,
  hints,
  prediction,
  skillChanges,
  skillNames,
  next,
  provenance,
  onContinue,
}: MissionCompleteProps): ReactElement {
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 className={styles.title} id={titleId} ref={heading} tabIndex={-1}>
        Mission complete
      </h2>
      <dl className={styles.facts}>
        <dt>EXACT MATCH</dt>
        <dd>{exact ? "YES" : "NO"}</dd>
        <dt>ATTEMPTS</dt>
        <dd>{attempts}</dd>
        <dt>HINTS</dt>
        <dd>{hintUsageText(hints)}</dd>
        {prediction === undefined ? null : (
          <>
            <dt>PREDICTION</dt>
            <dd>
              {prediction.correct ? (
                <>
                  Correct: <code>{prediction.answer}</code>
                </>
              ) : (
                <>
                  Not correct: you chose <code>{prediction.chosen}</code>; the
                  answer is <code>{prediction.answer}</code>.
                </>
              )}
            </dd>
          </>
        )}
      </dl>
      {skillChanges.length === 0 ? null : (
        <div className={styles.skills}>
          <h3 className={controls.label}>Skills</h3>
          <ul className={styles.skillList}>
            {skillChanges.map((change) => (
              <li key={change.skill}>
                {skillLine(
                  change,
                  skillNames.get(change.skill) ?? change.skill,
                )}
              </li>
            ))}
          </ul>
          {skillChanges.some((change) => change.solutionRevealed) ? (
            <p className={styles.note}>
              The solution was revealed, so this completion does not advance
              skills.
            </p>
          ) : null}
        </div>
      )}
      {provenance === undefined ? null : (
        <FieldProvenance provenance={provenance} />
      )}
      <div className={styles.actions}>
        <button className={controls.button} type="button" onClick={onContinue}>
          Continue
        </button>
        {next === undefined ? null : (
          <a href={`#/mission/${encodeURIComponent(next.id)}`}>
            Next mission · {next.id} {next.title}
          </a>
        )}
      </div>
    </section>
  );
}
