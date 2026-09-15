import type { ReactElement } from "react";
import type { ShownAnnotation } from "./annotations";
import { wordsLabel } from "./diffLabels";
import styles from "./DiffPanel.module.css";

interface AnnotationListProps {
  readonly annotations: readonly ShownAnnotation[];
}

/** The full text of the labelled notes the current help level explains. */
export function AnnotationList({
  annotations,
}: AnnotationListProps): ReactElement | null {
  const explained = annotations.filter((annotation) => annotation.explained);
  if (explained.length === 0) {
    return null;
  }
  return (
    <ul className={styles.mismatches} aria-label="Annotations">
      {explained.map((annotation, index) => (
        <li className={styles.mismatch} key={index}>
          <p className={styles.kind}>
            {wordsLabel(annotation.range)} · {annotation.label}
          </p>
          <p className={styles.evidence}>{annotation.text}</p>
        </li>
      ))}
    </ul>
  );
}
