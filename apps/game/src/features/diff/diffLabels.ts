import type { AlignmentRow } from "@osp/matching-core";
import type { InstructionRange } from "@osp/mission-schema";

export interface RowMarker {
  /** Shown to sighted players; never the only signal. */
  readonly symbol: string;
  /** Read by assistive technology. */
  readonly label: string;
}

export function rowMarker(status: AlignmentRow["status"]): RowMarker {
  switch (status) {
    case "equal":
      return { symbol: "✓", label: "Equal" };
    case "field-only":
      return { symbol: "≈", label: "Equal outside relocated fields" };
    case "different":
      return { symbol: "✗", label: "Different" };
    case "inserted":
      return { symbol: "+", label: "Extra in your output" };
    case "deleted":
      return { symbol: "−", label: "Missing from your output" };
  }
}

const NOP_LABELS: Readonly<Record<string, string>> = {
  "branch-delay-nop": "branch delay nop",
  "load-delay-nop": "load delay nop",
  "hilo-gap-nop": "mult/div gap nop",
  "cop-delay-nop": "coprocessor delay nop",
  "gte-gap-nop": "GTE gap nop",
};

/** A short label for a word the assembler inserted; other words have none. */
export function provenanceLabel(
  origin: { readonly kind: string } | undefined,
): string {
  return (origin && NOP_LABELS[origin.kind]) ?? "";
}

/**
 * Joins a row's note labels, skipping empty ones and repeats: an inserted
 * nop can be labeled by both its provenance and a teaching annotation.
 */
export function noteText(
  labels: readonly (string | false | undefined)[],
): string {
  return [...new Set(labels.filter(Boolean))].join(" · ");
}

/** `LOAD_SIGNEDNESS` becomes `Load signedness`. */
export function mismatchLabel(kind: string): string {
  const words = kind.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The kind named by a mismatch ID such as `REGISTER@t0g0`. */
export function mismatchKindOf(id: string): string {
  const at = id.indexOf("@");
  return at === -1 ? id : id.slice(0, at);
}

/** `Word 3`, or `Words 0–2` for a longer range. */
export function wordsLabel({ start, end }: InstructionRange): string {
  return end - start === 1
    ? `Word ${String(start)}`
    : `Words ${String(start)}–${String(end - 1)}`;
}

export function inRange(
  index: number | undefined,
  range: InstructionRange | undefined,
): boolean {
  return (
    index !== undefined &&
    range !== undefined &&
    index >= range.start &&
    index < range.end
  );
}
