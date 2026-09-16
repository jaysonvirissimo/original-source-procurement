import type { WordFacts } from "@osp/matching-core";
import type { MissionExample } from "@osp/mission-schema";
import type { ReactElement } from "react";
import table from "../diff/DiffPanel.module.css";
import { registerDiagram } from "./diagrams";
import { hex, wordList } from "./format";
import styles from "./Scan.module.css";

interface RegisterLayerProps {
  readonly example: MissionExample | undefined;
  readonly facts: readonly WordFacts[];
}

/** Each register the target uses, with example values at function entry. */
export function RegisterLayer({
  example,
  facts,
}: RegisterLayerProps): ReactElement {
  return (
    <div className={styles.layer}>
      <p className={styles.caption}>
        Example values are illustrative, chosen for one possible call. Nothing
        runs, so they are not observed.
      </p>
      <div className={table.tableWrap}>
        <table className={table.table} aria-label="Registers">
          <thead>
            <tr>
              <th scope="col">Register</th>
              <th scope="col">Example value at entry</th>
              <th scope="col">Read by</th>
              <th scope="col">Written by</th>
            </tr>
          </thead>
          <tbody>
            {registerDiagram(facts, example).map((row) => (
              <tr key={row.register}>
                <td>
                  <code>{row.register}</code>
                </td>
                <td>
                  {row.value === undefined ? (
                    "—"
                  ) : (
                    <>
                      <code>{hex(row.value)}</code>
                      {row.note === undefined ? null : ` (${row.note})`}
                    </>
                  )}
                </td>
                <td>{wordList(row.readBy)}</td>
                <td>{wordList(row.writtenBy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
