import type { ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import { entryMarks, missingSkillsText, type MissionEntry } from "./mapModel";
import styles from "./MissionMap.module.css";

/**
 * One mission on the map or in the list. Every mission opens, including one
 * whose expected skills are missing; the node only says so.
 */
export function MissionNode({
  entry,
}: {
  readonly entry: MissionEntry;
}): ReactElement {
  const { mission } = entry;
  const complete = entry.status === "complete";
  const marks = entryMarks(entry);
  const warning = complete ? undefined : missingSkillsText(entry.missing);
  return (
    <li
      className={classNames(
        styles.node,
        complete && styles.complete,
        entry.recommended && styles.recommended,
        warning !== undefined && styles.unready,
      )}
    >
      <a
        className={styles.nodeLink}
        href={`#/mission/${encodeURIComponent(mission.id)}`}
      >
        <span className={styles.nodeId}>{mission.id}</span> {mission.title}
      </a>
      {marks.length === 0 ? null : (
        <span className={styles.marks}>{marks.join(" · ")}</span>
      )}
      {warning === undefined ? null : (
        <span className={styles.warning}>{warning}</span>
      )}
    </li>
  );
}
