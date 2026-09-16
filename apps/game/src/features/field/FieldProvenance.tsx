import type { ReactElement } from "react";
import type { MissionProvenance } from "./provenance";
import styles from "./FieldProvenance.module.css";

interface FieldProvenanceProps {
  readonly provenance: MissionProvenance;
}

/** A readout of where a field mission's function was recovered from. */
export function FieldProvenance({
  provenance,
}: FieldProvenanceProps): ReactElement {
  const { target } = provenance;
  return (
    <dl className={styles.provenance} aria-label="Provenance">
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
  );
}
