import {
  abiRegisterNames,
  type MatchResult,
  type TeachingHypothesis,
} from "@osp/matching-core";
import type { InstructionRange } from "@osp/mission-schema";
import { useState, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import { AnnotationList } from "./AnnotationList";
import { annotationLabels, type ShownAnnotation } from "./annotations";
import { inRange, noteText, provenanceLabel, rowMarker } from "./diffLabels";
import styles from "./DiffPanel.module.css";
import { MismatchEvidence } from "./MismatchEvidence";

interface DiffPanelProps {
  readonly result: MatchResult;
  /** The source changed after this build. */
  readonly stale: boolean;
  /** Target words a revealed hint points at. */
  readonly highlight: InstructionRange | undefined;
  /** Teaching notes the current help level shows. */
  readonly annotations: readonly ShownAnnotation[];
  /** Possible causes, shown only when the player opens a mismatch. */
  readonly hypotheses?: readonly TeachingHypothesis[];
}

/** Target and generated instructions side by side, with their mismatches. */
export function DiffPanel({
  result,
  stale,
  highlight,
  annotations,
  hypotheses = [],
}: DiffPanelProps): ReactElement {
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  // A selection from an earlier result does not carry over to this one.
  const selected = result.mismatches.some((mismatch) => mismatch.id === chosen)
    ? chosen
    : undefined;
  return (
    <div className={styles.diff}>
      {stale ? (
        <p className={styles.stale}>
          STALE · The source changed after this build. Compile again to update
          the comparison.
        </p>
      ) : null}
      <div className={styles.tableWrap}>
        <table
          className={styles.table}
          aria-label="Target and generated instructions"
        >
          <thead>
            <tr>
              <th scope="col">
                <span className={controls.visuallyHidden}>Status</span>
              </th>
              <th scope="col">Target</th>
              <th scope="col">Generated</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {result.alignment.map((row, index) => {
              const target =
                row.target === undefined
                  ? undefined
                  : result.target[row.target];
              const generated =
                row.generated === undefined
                  ? undefined
                  : result.generated[row.generated];
              const marker = rowMarker(row.status);
              const highlighted = inRange(row.target, highlight);
              const rowSelected =
                selected !== undefined && row.mismatchIds.includes(selected);
              return (
                <tr
                  key={index}
                  className={classNames(
                    styles[row.status],
                    highlighted && styles.highlighted,
                    rowSelected && styles.selected,
                  )}
                  data-status={row.status}
                  data-highlighted={highlighted}
                  data-selected={rowSelected}
                >
                  <td className={styles.marker}>
                    <span aria-hidden="true">{marker.symbol}</span>
                    <span className={controls.visuallyHidden}>
                      {marker.label}
                    </span>
                  </td>
                  <td>
                    <code>{target?.text}</code>
                  </td>
                  <td>
                    <code>{generated?.text}</code>
                  </td>
                  <td
                    className={styles.note}
                    title={
                      generated?.origin?.note === undefined
                        ? undefined
                        : abiRegisterNames(generated.origin.note)
                    }
                  >
                    {noteText([
                      provenanceLabel(generated?.origin),
                      ...annotationLabels(annotations, row.target),
                      highlighted && "HINT",
                      rowSelected && "SELECTED",
                    ])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AnnotationList annotations={annotations} />
      <MismatchEvidence
        mismatches={result.mismatches}
        hypotheses={hypotheses}
        selected={selected}
        onSelect={setChosen}
      />
    </div>
  );
}
