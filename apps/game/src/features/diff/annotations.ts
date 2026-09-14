import { observations, type ObservationKind } from "@osp/matching-core";
import type { InstructionRange, Mission } from "@osp/mission-schema";

/** A teaching note on a range of target words. */
export interface WordAnnotation {
  readonly range: InstructionRange;
  /** Short enough for the Note column. */
  readonly label: string;
  readonly text: string;
  readonly manualEntry?: string;
}

const OBSERVED: Readonly<
  Record<ObservationKind, Omit<WordAnnotation, "range">>
> = {
  "delay-slot": {
    label: "delay slot",
    text: "This instruction runs in the delay slot of the jump before it, before the jump takes effect.",
    manualEntry: "mips.delay-slots",
  },
  "branch-delay-nop": {
    label: "branch delay nop",
    text: "The assembler inserted this nop to fill the delay slot of the jump before it.",
    manualEntry: "mips.assembler-nops",
  },
  "load-delay-nop": {
    label: "load delay nop",
    text: "The assembler inserted this nop because the next instruction reads the register just loaded.",
    manualEntry: "mips.assembler-nops",
  },
};

/** Scaffolds that still explain target words without being asked. */
const ANNOTATED_SCAFFOLDS: ReadonlySet<Mission["scaffold"]> = new Set([
  "guided",
  "assisted",
]);

/**
 * The notes shown on a mission's target: machine behavior observed in the
 * target words, then the mission's own annotations, in word order. Missions
 * whose scaffold no longer teaches automatically show none.
 */
export function missionAnnotations(
  mission: Pick<Mission, "scaffold" | "target" | "annotations">,
): WordAnnotation[] {
  if (
    !ANNOTATED_SCAFFOLDS.has(mission.scaffold) ||
    mission.target.kind !== "inline"
  ) {
    return [];
  }
  const observed = observations(
    mission.target.words,
    mission.target.provenance,
  ).map(({ index, kind }): WordAnnotation => ({
    range: { start: index, end: index + 1 },
    ...OBSERVED[kind],
  }));
  const authored = (mission.annotations ?? []).map(
    ({ range, text, manualEntry }): WordAnnotation => ({
      range,
      label: "note",
      text,
      ...(manualEntry === undefined ? {} : { manualEntry }),
    }),
  );
  return [...observed, ...authored].sort(
    (first, second) => first.range.start - second.range.start,
  );
}

/** Labels of the annotations covering one target word. */
export function annotationLabels(
  annotations: readonly WordAnnotation[],
  index: number | undefined,
): string[] {
  if (index === undefined) {
    return [];
  }
  return annotations
    .filter(({ range }) => index >= range.start && index < range.end)
    .map(({ label }) => label);
}
