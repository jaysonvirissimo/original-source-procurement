import type { ReactElement } from "react";
import prose from "../../styles/prose.module.css";
import type { MissionProvenance } from "./provenance";
import { PROVENANCE_LEGEND } from "./provenanceLegend";
import styles from "./FieldProvenance.module.css";

interface FieldProvenanceProps {
  readonly provenance: MissionProvenance;
}

/**
 * A readout of where a field mission's function was recovered from, with a
 * folded legend that says what each label means and which can be ignored.
 */
export function FieldProvenance({
  provenance,
}: FieldProvenanceProps): ReactElement {
  const { target } = provenance;
  return (
    <div className={styles.provenance}>
      <dl className={styles.readout} aria-label="Provenance">
        <dt>Recovered from</dt>
        <dd>{provenance.repository}</dd>
        <dt>Overlay</dt>
        <dd>{provenance.overlay}</dd>
        <dt>Symbol</dt>
        <dd>
          <code>{provenance.symbol}</code>
        </dd>
        {provenance.address === undefined ? null : (
          <>
            <dt>Address</dt>
            <dd>
              <code>{provenance.address}</code>
            </dd>
          </>
        )}
        <dt>Target</dt>
        <dd>
          {target.url === undefined ? (
            <code>{target.path}</code>
          ) : (
            <a href={target.url} target="_blank" rel="noopener noreferrer">
              <code>{target.path}</code>
            </a>
          )}{" "}
          at <code>{target.commit.slice(0, 8)}</code>
        </dd>
      </dl>
      <details className={styles.legend}>
        <summary>What these labels mean</summary>
        <dl className={prose.prose} aria-label="What the labels mean">
          {PROVENANCE_LEGEND.map(({ term, meaning }) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
