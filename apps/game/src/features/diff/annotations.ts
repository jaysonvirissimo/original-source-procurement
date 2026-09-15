import { observations, type ObservationKind } from "@osp/matching-core";
import type { InstructionRange, Mission } from "@osp/mission-schema";
import { presentationFor, type ScaffoldPlan } from "../progress/scaffold";

/** A teaching note on a range of target words. */
export interface WordAnnotation {
  readonly range: InstructionRange;
  /** Short enough for the Note column. */
  readonly label: string;
  readonly text: string;
  readonly manualEntry?: string;
  /** The skill whose help level decides when the note shows. */
  readonly skill?: string;
}

/** A note the current help level shows without being asked. */
export interface ShownAnnotation extends WordAnnotation {
  /** The full text shows under the listing, not only the label. */
  readonly explained: boolean;
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

/**
 * Every note on a mission's target, whatever help the player gets: machine
 * behavior observed in the target words, then the mission's own annotations,
 * in word order.
 */
export function missionAnnotations(
  mission: Pick<Mission, "target" | "annotations">,
): WordAnnotation[] {
  if (mission.target.kind !== "inline") {
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
    ({ range, text, manualEntry, skill }): WordAnnotation => ({
      range,
      label: "note",
      text,
      ...(manualEntry === undefined ? {} : { manualEntry }),
      ...(skill === undefined ? {} : { skill }),
    }),
  );
  return [...observed, ...authored].sort(
    (first, second) => first.range.start - second.range.start,
  );
}

/**
 * The notes shown without being asked. A note tied to a skill follows that
 * skill's help level; observed machine behavior follows the workspace's.
 */
export function shownAnnotations(
  annotations: readonly WordAnnotation[],
  plan: ScaffoldPlan,
): ShownAnnotation[] {
  return annotations.flatMap((annotation): ShownAnnotation[] => {
    const level =
      (annotation.skill === undefined
        ? undefined
        : plan.skills.get(annotation.skill)) ?? plan.layout;
    const { noteLabels, explanations } = presentationFor(
      level,
      plan.automaticTeaching,
    );
    return noteLabels ? [{ ...annotation, explained: explanations }] : [];
  });
}

/** Manual entries the notes link to, kept at every help level. */
export function manualLinks(annotations: readonly WordAnnotation[]): string[] {
  return [
    ...new Set(
      annotations.flatMap(({ manualEntry }) =>
        manualEntry === undefined ? [] : [manualEntry],
      ),
    ),
  ];
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
