import type { ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import prose from "../../styles/prose.module.css";
import styles from "../workspace/ReferencePane.module.css";
import { layoutRows } from "./layoutRows";
import type { FieldLayout, TypeLayout } from "./offsetProbe";
import tableStyles from "./OffsetTable.module.css";
import type { OffsetTableState } from "./useOffsetProbe";

const KIND_LABELS: Record<FieldLayout["kind"], string> = {
  scalar: "",
  pointer: "pointer",
  array: "array",
  aggregate: "embedded",
};

function hex(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}

function TypeTable({ type }: { readonly type: TypeLayout }): ReactElement {
  if (type.kind === "unavailable") {
    return (
      <p className={prose.prose}>
        Offsets unavailable for <code>{type.name}</code>: {type.reason}.
      </p>
    );
  }
  return (
    <table className={tableStyles.table}>
      <caption className={controls.label}>
        {type.name} · {type.size} bytes
      </caption>
      <thead>
        <tr>
          <th scope="col">Offset</th>
          <th scope="col">Size</th>
          <th scope="col">Field</th>
          <th scope="col">Type</th>
          <th scope="col">Kind</th>
        </tr>
      </thead>
      <tbody>
        {layoutRows(type).map((row) =>
          row.kind === "padding" ? (
            <tr
              className={tableStyles.padding}
              key={`padding-${String(row.offset)}`}
            >
              <td>{hex(row.offset)}</td>
              <td>{row.size}</td>
              <td colSpan={3}>padding</td>
            </tr>
          ) : (
            <tr key={row.field.name}>
              <td>{hex(row.field.offset)}</td>
              <td>{row.field.size}</td>
              <th scope="row">
                <code>{row.field.name}</code>
              </th>
              <td>
                <code>{row.field.typeText}</code>
              </td>
              <td>{KIND_LABELS[row.field.kind]}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

/**
 * Each context type's fields: offset and size in bytes, the declared type,
 * and whether a field is a pointer, an array, or an embedded aggregate. The
 * compiler computed every number; nothing here is authored or saved.
 */
export function OffsetTable({
  state,
}: {
  readonly state: OffsetTableState;
}): ReactElement {
  return (
    <section className={tableStyles.section} aria-label="Field offsets">
      <h3 className={classNames(controls.label, styles.itemTitle)}>
        Field offsets
      </h3>
      <p className={classNames(prose.prose, styles.dim)}>
        Computed by compiling this mission&apos;s declarations with the same
        compiler, not written by hand. Offsets count bytes from the start of the
        type. Padding rows are bytes the compiler skips so the next field lines
        up.
      </p>
      {state.kind === "measuring" ? (
        <p className={styles.dim} role="status">
          Measuring field offsets.
        </p>
      ) : state.kind === "failed" ? (
        <div>
          <p className={prose.prose}>
            Offsets unavailable. {state.message} Compile still works.
          </p>
          {state.diagnostics.length === 0 ? null : (
            <details>
              <summary>Diagnostics</summary>
              <pre className={styles.code}>
                {state.diagnostics
                  .map((diagnostic) => diagnostic.message)
                  .join("\n")}
              </pre>
            </details>
          )}
        </div>
      ) : (
        state.types.map((type) => <TypeTable key={type.name} type={type} />)
      )}
    </section>
  );
}
