import type { MatchResult } from "@osp/matching-core";
import type { InstructionRange } from "@osp/mission-schema";
import type { ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import {
  inRange,
  mismatchKindOf,
  mismatchLabel,
  provenanceLabel,
  rowMarker,
} from "./diffLabels";
import styles from "./DiffPanel.module.css";

interface DiffPanelProps {
  readonly result: MatchResult;
  /** The source changed after this build. */
  readonly stale: boolean;
  /** Target words a revealed hint points at. */
  readonly highlight: InstructionRange | undefined;
}

/** Target and generated instructions side by side, with their mismatches. */
export function DiffPanel({
  result,
  stale,
  highlight,
}: DiffPanelProps): ReactElement {
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
              return (
                <tr
                  key={index}
                  className={classNames(
                    styles[row.status],
                    highlighted && styles.highlighted,
                  )}
                  data-status={row.status}
                  data-highlighted={highlighted}
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
                  <td className={styles.note} title={generated?.origin?.note}>
                    {[provenanceLabel(generated?.origin), highlighted && "HINT"]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {result.mismatches.length === 0 ? null : (
        <ul className={styles.mismatches} aria-label="Mismatches">
          {result.mismatches.map((mismatch) => (
            <li className={styles.mismatch} key={mismatch.id}>
              <p className={styles.kind}>
                {mismatchLabel(mismatch.kind)}
                {mismatch.consequenceOf === undefined
                  ? null
                  : ` · caused by ${mismatchLabel(mismatchKindOf(mismatch.consequenceOf))}`}
              </p>
              {mismatch.evidence.map((line, index) => (
                <p className={styles.evidence} key={index}>
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
