import type { ManualEntry } from "@osp/mission-schema";
import type { ReactElement, ReactNode } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import prose from "../../styles/prose.module.css";
import styles from "./Manual.module.css";
import { manualEntryElementId } from "./manualEntryElementId";

const HEADINGS = { 2: "h2", 3: "h3", 4: "h4" } as const;

// Splitting on one capturing group alternates text and address, so the odd
// parts are addresses. Sentence punctuation after an address stays text.
const ADDRESS = /(https:\/\/[^\s]*[^\s.,;:)])/;

/** A paragraph with each web address as a link that opens in a new tab. */
function linkify(paragraph: string): ReactNode[] {
  return paragraph.split(ADDRESS).map((part, index) =>
    index % 2 === 1 ? (
      <a href={part} key={index} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

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
        <p className={classNames(prose.prose, prose.dim)} key={index}>
          {linkify(paragraph)}
        </p>
      ))}
    </article>
  );
}
