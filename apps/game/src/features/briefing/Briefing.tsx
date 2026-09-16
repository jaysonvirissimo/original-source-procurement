import type { ManualEntry, Mission } from "@osp/mission-schema";
import { useId, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import { missionTier } from "../../vr/presentation";
import { FieldProvenance } from "../field/FieldProvenance";
import { missionProvenance } from "../field/provenance";
import { missingSkillsText, type NamedSkill } from "../mission-map/mapModel";
import { supportLabel, type ScaffoldPlan } from "../progress/scaffold";
import { SKILL_STATE_LABELS, type SkillState } from "../progress/skillState";
import styles from "./Briefing.module.css";

interface BriefingProps {
  readonly mission: Pick<
    Mission,
    | "id"
    | "kind"
    | "phase"
    | "title"
    | "briefing"
    | "requires"
    | "practices"
    | "source"
    | "target"
  >;
  readonly skillNames: ReadonlyMap<string, string>;
  /** The player's state for each skill; a skill not listed is new. */
  readonly skillStates: ReadonlyMap<string, SkillState>;
  /** Expected skills the player has not been introduced to. Entering stays allowed. */
  readonly missing?: readonly NamedSkill[];
  readonly plan: ScaffoldPlan;
  /** Glossary entries for the terms the mission text uses. */
  readonly terms?: readonly ManualEntry[];
  /** Offers the orientation, before the first mission on the path. */
  readonly orientation?: boolean;
  readonly onEnter: () => void;
}

export function Briefing({
  mission,
  skillNames,
  skillStates,
  missing = [],
  plan,
  terms = [],
  orientation = false,
  onEnter,
}: BriefingProps): ReactElement {
  const titleId = useId();
  // A synthesis mission lists what it combines as practiced, not required.
  const prerequisites = [
    ...new Set([...mission.requires, ...mission.practices]),
  ];
  const warning = missingSkillsText(missing);
  const provenance = missionProvenance(mission);
  return (
    <section
      className={styles.briefing}
      aria-labelledby={titleId}
      data-tier={missionTier(mission.kind)}
    >
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
        {terms.length === 0 ? null : (
          <>
            <dt>Terms</dt>
            <dd>
              <ul className={styles.terms} aria-label="Terms">
                {terms.map((entry) => (
                  <li key={entry.id}>
                    <details>
                      <summary>{entry.title}</summary>
                      {entry.body.map((paragraph, index) => (
                        <p className={styles.definition} key={index}>
                          {paragraph}
                        </p>
                      ))}
                    </details>
                  </li>
                ))}
              </ul>
            </dd>
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
          {warning === undefined ? null : (
            <p className={styles.warning}>{warning}</p>
          )}
        </dd>
        <dt>Teaching support</dt>
        <dd>{supportLabel(plan)}</dd>
      </dl>
      {orientation ? (
        <p className={styles.orientation}>
          New to C or assembly? <a href="#/orientation">Read the orientation</a>{" "}
          first. It is optional, and the manual keeps it.
        </p>
      ) : null}
      {provenance === undefined ? null : (
        <FieldProvenance provenance={provenance} />
      )}
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
