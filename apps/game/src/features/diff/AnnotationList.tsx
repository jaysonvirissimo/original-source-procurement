import type { ReactElement } from "react";
import type { WordAnnotation } from "./annotations";
import styles from "./DiffPanel.module.css";

interface AnnotationListProps {
  readonly annotations: readonly WordAnnotation[];
}

function wordsLabel({ start, end }: WordAnnotation["range"]): string {
  return end - start === 1
    ? `Word ${String(start)}`
    : `Words ${String(start)}–${String(end - 1)}`;
}

/** The full text of the notes labelled in the Note column. */
export function AnnotationList({
  annotations,
}: AnnotationListProps): ReactElement | null {
  if (annotations.length === 0) {
    return null;
  }
  return (
    <ul className={styles.mismatches} aria-label="Annotations">
      {annotations.map((annotation, index) => (
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
