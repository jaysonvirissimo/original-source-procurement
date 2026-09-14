import { decode } from "psyq-asm";
import { transfersControl } from "./classes.ts";

/** Something a teaching scaffold can point out about one target word. */
export type ObservationKind =
  "delay-slot" | "branch-delay-nop" | "load-delay-nop";

export interface Observation {
  /** Index of the word in the function. */
  readonly index: number;
  readonly kind: ObservationKind;
  /** The assembler's note for an inserted word, when it has one. */
  readonly note?: string;
}

/** Recorded provenance of one word, as a target or `psyq-asm` carries it. */
export interface WordProvenance {
  readonly kind: string;
  readonly note?: string | undefined;
}

const INSERTED_NOPS: ReadonlySet<string> = new Set<ObservationKind>([
  "branch-delay-nop",
  "load-delay-nop",
]);

/**
 * Words that follow from the machine rather than from one C construct: an
 * instruction running in a jump's or branch's delay slot, and nops the
 * assembler inserted. An inserted nop is reported as what it is, even when
 * it also sits in a delay slot.
 */
export function observations(
  words: readonly number[],
  provenance: readonly (WordProvenance | undefined)[],
): Observation[] {
  const found: Observation[] = [];
  words.forEach((_, index) => {
    const origin = provenance[index];
    if (origin !== undefined && INSERTED_NOPS.has(origin.kind)) {
      found.push({
        index,
        kind: origin.kind as ObservationKind,
        ...(origin.note === undefined ? {} : { note: origin.note }),
      });
      return;
    }
    const previous = words[index - 1];
    if (previous !== undefined && transfersControl(decode(previous))) {
      found.push({ index, kind: "delay-slot" });
    }
  });
  return found;
}
