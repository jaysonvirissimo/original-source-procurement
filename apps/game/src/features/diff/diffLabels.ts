import type { AlignmentRow, MismatchKind } from "@osp/matching-core";
import type { InstructionRange } from "@osp/mission-schema";

/** What each mismatch kind means, in one sentence. */
export const MISMATCH_EXPLANATIONS: Readonly<Record<MismatchKind, string>> = {
  OPCODE: "The two instructions perform different operations.",
  REGISTER: "The same operation uses different registers.",
  IMMEDIATE: "The same operation uses a different constant.",
  MEMORY_OFFSET:
    "The same memory access uses a different offset from its base register.",
  LOAD_WIDTH: "The load reads a different number of bytes.",
  LOAD_SIGNEDNESS:
    "The load reads the same number of bytes but extends the value differently: lb and lh sign-extend, lbu and lhu zero-extend.",
  STORE_WIDTH: "The store writes a different number of bytes.",
  MISSING_INSTRUCTION: "The target has instructions your output lacks.",
  EXTRA_INSTRUCTION: "Your output has instructions the target lacks.",
  INSTRUCTION_ORDER:
    "Both sides have the same instructions, in a different order.",
  BRANCH_CONDITION: "The branches test different conditions.",
  BRANCH_TARGET: "The branch or jump goes to a different place.",
  DELAY_SLOT:
    "The delay slot differs: the instruction after a branch or jump runs before the jump takes effect.",
  CALL_TARGET: "The call goes to a different function.",
  GP_RELATIVE:
    "One side reaches data through $gp, the global pointer; the other builds the full address.",
  RELOCATION_TARGET:
    "The words agree, but the address filled in at link time points somewhere else.",
  UNKNOWN:
    "No rule explains this difference yet. Compare the two instructions directly.",
};

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
