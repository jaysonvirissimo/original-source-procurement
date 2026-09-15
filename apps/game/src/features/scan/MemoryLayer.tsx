import type { WordFacts } from "@osp/matching-core";
import type { MissionExample } from "@osp/mission-schema";
import type { ReactElement } from "react";
import table from "../diff/DiffPanel.module.css";
import { memoryDiagram } from "./diagrams";
import { accessText, hex } from "./format";
import styles from "./Scan.module.css";

interface MemoryLayerProps {
  readonly example: MissionExample;
  readonly facts: readonly WordFacts[];
}

/** The example's memory as tables, with the words that read and write it. */
export function MemoryLayer({
  example,
  facts,
}: MemoryLayerProps): ReactElement {
  const diagram = memoryDiagram(facts, example);
  return (
    <div className={styles.layer}>
      <p>{example.caption}</p>
      {diagram.regions.map((region) => (
        <div className={table.tableWrap} key={region.label}>
          <table className={table.table} aria-label={`Memory: ${region.label}`}>
            <caption className={styles.caption}>
              {region.label} at <code>{hex(region.address)}</code>
            </caption>
            <thead>
              <tr>
                <th scope="col">Address</th>
                <th scope="col">Field</th>
                <th scope="col">Bytes</th>
                <th scope="col">Example value</th>
                <th scope="col">Target words</th>
              </tr>
            </thead>
            <tbody>
              {region.rows.map(({ cell, address, accesses }) => (
                <tr key={address}>
                  <td>
                    <code>{hex(address)}</code> (+{cell.offset})
                  </td>
                  <td>
                    <code>{cell.label}</code>
                  </td>
                  <td>{cell.size}</td>
                  <td>
                    {cell.pointsTo === undefined ? (
                      <code>{cell.value}</code>
                    ) : (
                      <>
                        <code>{hex(cell.value)}</code>, the address of{" "}
                        {cell.pointsTo}
                      </>
                    )}
                  </td>
                  <td>
                    {accesses.length === 0
                      ? "—"
                      : accesses
                          .map(({ index, access }) => accessText(index, access))
                          .join("; ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {diagram.unresolved.map(({ index, access }) => (
        <p className={styles.caption} key={index}>
          Word {index} reads memory through {access.base}, which this example
          does not follow.
        </p>
      ))}
    </div>
  );
}
