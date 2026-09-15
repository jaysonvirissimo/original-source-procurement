import type { Mission } from "@osp/mission-schema";
import { useId, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import { supportLabel, type ScaffoldPlan } from "../progress/scaffold";
import { SKILL_STATE_LABELS, type SkillState } from "../progress/skillState";
import styles from "./Briefing.module.css";

interface BriefingProps {
  readonly mission: Pick<
    Mission,
    "id" | "phase" | "title" | "briefing" | "requires" | "practices"
  >;
  readonly skillNames: ReadonlyMap<string, string>;
  /** The player's state for each skill; a skill not listed is new. */
  readonly skillStates: ReadonlyMap<string, SkillState>;
  readonly plan: ScaffoldPlan;
  readonly onEnter: () => void;
}

export function Briefing({
  mission,
  skillNames,
  skillStates,
  plan,
  onEnter,
}: BriefingProps): ReactElement {
  const titleId = useId();
  // A synthesis mission lists what it combines as practiced, not required.
  const prerequisites = [
    ...new Set([...mission.requires, ...mission.practices]),
  ];
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
          {prerequisites.length === 0 ? (
            "None"
          ) : (
            <ul className={styles.skills} aria-label="Prerequisite skills">
              {prerequisites.map((skill) => (
                <li key={skill}>
                  {skillNames.get(skill) ?? skill} ·{" "}
                  {SKILL_STATE_LABELS[skillStates.get(skill) ?? "NEW"]}
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Teaching support</dt>
        <dd>{supportLabel(plan)}</dd>
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
