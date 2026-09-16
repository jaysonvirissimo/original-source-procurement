import type { ManualEntry } from "@osp/mission-schema";
import type { ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import styles from "./Manual.module.css";
import { manualEntryElementId } from "./manualEntryElementId";

const HEADINGS = { 2: "h2", 3: "h3", 4: "h4" } as const;

interface ManualEntryViewProps {
  readonly entry: ManualEntry;
  /** Heading level of the entry title, below its surrounding heading. */
  readonly level: 2 | 3 | 4;
  /** Hides the section label, when a surrounding heading already names it. */
  readonly hideSection?: boolean;
}

/** One manual entry: its section, title, and paragraphs. */
export function ManualEntryView({
  entry,
  level,
  hideSection = false,
}: ManualEntryViewProps): ReactElement {
  const Heading = HEADINGS[level];
  return (
    <article
      className={styles.entry}
      id={manualEntryElementId(entry.id)}
      tabIndex={-1}
    >
      {hideSection ? null : <p className={controls.label}>{entry.section}</p>}
      <Heading className={styles.entryTitle}>{entry.title}</Heading>
      {entry.body.map((paragraph, index) => (
        <p className={styles.prose} key={index}>
          {paragraph}
        </p>
      ))}
    </article>
  );
}
