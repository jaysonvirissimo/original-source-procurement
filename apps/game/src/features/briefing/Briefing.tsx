import type { Mission } from "@osp/mission-schema";
import { useId, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import styles from "./Briefing.module.css";

interface BriefingProps {
  readonly mission: Pick<
    Mission,
    "id" | "phase" | "title" | "briefing" | "requires"
  >;
  readonly skillNames: ReadonlyMap<string, string>;
  readonly onEnter: () => void;
}

export function Briefing({
  mission,
  skillNames,
  onEnter,
}: BriefingProps): ReactElement {
  const titleId = useId();
  return (
    <section className={styles.briefing} aria-labelledby={titleId}>
      <p className={controls.label}>
        OSP {mission.id} · {mission.phase}
      </p>
      <h1 className={styles.title} id={titleId}>
        {mission.title}
      </h1>
      <dl className={styles.facts}>
        <dt>Objective</dt>
        <dd>{mission.briefing.objective}</dd>
        {mission.briefing.newTechnique === undefined ? null : (
          <>
            <dt>New technique</dt>
            <dd>{mission.briefing.newTechnique}</dd>
          </>
        )}
        <dt>Prerequisites</dt>
        <dd>
          {mission.requires.length === 0
            ? "None"
            : mission.requires
                .map((skill) => skillNames.get(skill) ?? skill)
                .join(", ")}
        </dd>
      </dl>
      <button
        className={classNames(controls.button, controls.primary)}
        type="button"
        onClick={onEnter}
      >
        Enter
      </button>
    </section>
  );
}
