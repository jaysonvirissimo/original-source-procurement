import type { Mission } from "@osp/mission-schema";
import { useId, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import type { MissionCatalog } from "../curriculum/missionCatalog";
import styles from "./OverlayPanel.module.css";

interface ManualPanelProps {
  readonly mission: Pick<Mission, "teaches" | "requires" | "practices">;
  readonly catalog: Pick<MissionCatalog, "skills" | "manualEntries">;
  readonly onClose: () => void;
}

/** Manual entries for the mission's skills, over the workspace. */
export function ManualPanel({
  mission,
  catalog,
  onClose,
}: ManualPanelProps): ReactElement {
  const titleId = useId();
  const skillIds = [
    ...new Set([...mission.teaches, ...mission.requires, ...mission.practices]),
  ];
  const entries = skillIds.flatMap((id) => {
    const skill = catalog.skills.find((candidate) => candidate.id === id);
    if (skill === undefined) {
      return [];
    }
    const entry = catalog.manualEntries.find(
      (candidate) => candidate.id === skill.manualEntry,
    );
    return [{ skill, entry }];
  });

  return (
    <section className={styles.overlay} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 className={controls.label} id={titleId}>
          Manual
        </h2>
        <button className={controls.button} type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <ul className={styles.list}>
        {entries.map(({ skill, entry }) => (
          <li className={styles.item} key={skill.id}>
            <p className={controls.label}>
              {entry === undefined
                ? skill.id
                : `${entry.section} · ${entry.title}`}
            </p>
            <h3 className={styles.itemTitle}>{skill.name}</h3>
            <p>{skill.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
