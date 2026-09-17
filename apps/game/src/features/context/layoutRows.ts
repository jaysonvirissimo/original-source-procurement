import type { FieldLayout, TypeLayout } from "./offsetProbe";

export type Row =
  | { readonly kind: "field"; readonly field: FieldLayout }
  | {
      readonly kind: "padding";
      readonly offset: number;
      readonly size: number;
    };

/** The fields in order, with a padding row wherever bytes are skipped. */
export function layoutRows(
  type: Extract<TypeLayout, { kind: "measured" }>,
): Row[] {
  const rows: Row[] = [];
  let end = 0;
  for (const field of type.fields) {
    if (field.offset > end) {
      rows.push({ kind: "padding", offset: end, size: field.offset - end });
    }
    rows.push({ kind: "field", field });
    end = Math.max(end, field.offset + field.size);
  }
  if (type.size > end) {
    rows.push({ kind: "padding", offset: end, size: type.size - end });
  }
  return rows;
}
