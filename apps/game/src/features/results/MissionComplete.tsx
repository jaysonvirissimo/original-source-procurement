import type { Mission } from "@osp/mission-schema";
import { useEffect, useId, useRef, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import styles from "./MissionComplete.module.css";

interface MissionCompleteProps {
  readonly mission: Pick<Mission, "id" | "title" | "teaches">;
  readonly exact: boolean;
  readonly attempts: number;
  readonly hints: number;
  readonly skillNames: ReadonlyMap<string, string>;
  readonly onReview: () => void;
}

export function MissionComplete({
  mission,
  exact,
  attempts,
  hints,
  skillNames,
  onReview,
}: MissionCompleteProps): ReactElement {
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <p className={controls.label}>
        OSP {mission.id} · {mission.title}
      </p>
      <h1 className={styles.title} id={titleId} ref={heading} tabIndex={-1}>
        Mission complete
      </h1>
      <dl className={styles.facts}>
        <dt>EXACT MATCH</dt>
        <dd>{exact ? "YES" : "NO"}</dd>
        <dt>ATTEMPTS</dt>
        <dd>{attempts}</dd>
        <dt>HINTS</dt>
        <dd>{hints}</dd>
      </dl>
      {mission.teaches.length === 0 ? (
        <p className={styles.note}>
          No new skill: this mission practices skills taught earlier.
        </p>
      ) : (
        <div className={styles.skills}>
          <h2 className={controls.label}>Skill verified</h2>
          <ul className={styles.skillList}>
            {mission.teaches.map((skill) => (
              <li key={skill}>
                <code>{skill}</code> {skillNames.get(skill)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.actions}>
        <button className={controls.button} type="button" onClick={onReview}>
          Return to workspace
        </button>
        <a href="#/">Mission map</a>
      </div>
    </section>
  );
}
