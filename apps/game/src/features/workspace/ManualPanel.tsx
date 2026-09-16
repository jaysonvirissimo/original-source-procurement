import type { ManualEntry, Mission } from "@osp/mission-schema";
import { useId, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import prose from "../../styles/prose.module.css";
import type { MissionCatalog } from "../curriculum/missionCatalog";
import { ManualBrowser } from "../manual/ManualBrowser";
import styles from "./ReferencePane.module.css";

interface ManualPanelProps {
  readonly mission: Pick<
    Mission,
    "teaches" | "requires" | "practices" | "terms"
  >;
  readonly catalog: Pick<MissionCatalog, "skills" | "manualEntries">;
  /** Entries that visible annotations link to. */
  readonly linkedEntries: readonly string[];
  readonly onClose: () => void;
}

interface Item {
  readonly key: string;
  readonly label: string;
  readonly title: string;
  readonly description?: string;
  /** Shown the first time its entry appears. */
  readonly body: readonly string[];
}

/**
 * Manual entries for the mission's skills, then any other entries its
 * annotations and terms link to, beside the listing, with search and every
 * entry a toggle away.
 */
export function ManualPanel({
  mission,
  catalog,
  linkedEntries,
  onClose,
}: ManualPanelProps): ReactElement {
  const titleId = useId();
  const shown = new Set<string>();
  const bodyOf = (entry: ManualEntry | undefined): readonly string[] => {
    if (entry === undefined || shown.has(entry.id)) {
      return [];
    }
    shown.add(entry.id);
    return entry.body;
  };
  const findEntry = (id: string) =>
    catalog.manualEntries.find((candidate) => candidate.id === id);

  const skillIds = [
    ...new Set([...mission.teaches, ...mission.requires, ...mission.practices]),
  ];
  const skillItems = skillIds.flatMap((id): Item[] => {
    const skill = catalog.skills.find((candidate) => candidate.id === id);
    if (skill === undefined) {
      return [];
    }
    const entry = findEntry(skill.manualEntry);
    return [
      {
        key: skill.id,
        label:
          entry === undefined ? skill.id : `${entry.section} · ${entry.title}`,
        title: skill.name,
        description: skill.description,
        body: bodyOf(entry),
      },
    ];
  });
  const linkedItems = [
    ...new Set([...linkedEntries, ...(mission.terms ?? [])]),
  ].flatMap((id): Item[] => {
    const entry = findEntry(id);
    if (entry === undefined || shown.has(entry.id)) {
      return [];
    }
    return [
      {
        key: entry.id,
        label: entry.section,
        title: entry.title,
        body: bodyOf(entry),
      },
    ];
  });

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2
          className={classNames(controls.label, styles.heading)}
          id={titleId}
          tabIndex={-1}
        >
          Manual
        </h2>
        <button className={controls.button} type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <ManualBrowser
        entries={catalog.manualEntries}
        level={3}
        missionView={
          <ul className={styles.list}>
            {[...skillItems, ...linkedItems].map((item) => (
              <li className={styles.item} key={item.key}>
                <p className={controls.label}>{item.label}</p>
                <h3 className={styles.itemTitle}>{item.title}</h3>
                {item.description === undefined ? null : (
                  <p className={prose.prose}>{item.description}</p>
                )}
                {item.body.map((paragraph, index) => (
                  <p className={classNames(prose.prose, prose.dim)} key={index}>
                    {paragraph}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        }
      />
    </section>
  );
}
