import type { InstructionRange } from "@osp/mission-schema";
import type { ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import { inRange } from "./diffLabels";
import styles from "./DiffPanel.module.css";

interface TargetListingProps {
  readonly lines: readonly string[];
  readonly highlight: InstructionRange | undefined;
}

/** The target instructions, shown before there is a build to compare. */
export function TargetListing({
  lines,
  highlight,
}: TargetListingProps): ReactElement {
  return (
    <div className={styles.diff}>
      <p className={styles.help}>
        Compile to compare your output with the target.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Target instructions">
          <thead>
            <tr>
              <th scope="col">Word</th>
              <th scope="col">Target</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const highlighted = inRange(index, highlight);
              return (
                <tr
                  key={index}
                  className={classNames(highlighted && styles.highlighted)}
                  data-highlighted={highlighted}
                >
                  <td className={styles.index}>{index}</td>
                  <td>
                    <code>{line}</code>
                  </td>
                  <td className={styles.note}>{highlighted ? "HINT" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
