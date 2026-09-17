import { hintStagePurpose, type Hint } from "@osp/mission-schema";

const SOLUTION_STAGE = 9;

/**
 * A hint's position and purpose, such as "Hint 2 of 4 · Where to look".
 * Ladders skip stages, so the raw stage number is never shown, and the
 * solution is always "Solution reveal" rather than a numbered hint.
 */
export function hintLabel(hints: readonly Hint[], hint: Hint): string {
  if (hint.stage === SOLUTION_STAGE) {
    return hintStagePurpose(SOLUTION_STAGE);
  }
  const numbered = hints.filter((each) => each.stage !== SOLUTION_STAGE);
  const position = numbered.indexOf(hint) + 1;
  return `Hint ${String(position)} of ${String(numbered.length)} · ${hintStagePurpose(hint.stage)}`;
}

/**
 * How far an attempt's hints went, for its saved `hintStage`, such as
 * "Hints opened through Hint 2 of 4 · Where to look". A ladder edited since
 * the attempt may no longer have that stage, so the label names the last hint
 * at or before it.
 */
export function openedHintsLabel(
  hints: readonly Hint[],
  stage: number,
): string {
  const reached = hints.filter((hint) => hint.stage <= stage).at(-1);
  return reached === undefined
    ? "Hints opened"
    : `Hints opened through ${hintLabel(hints, reached)}`;
}

/** Whether the next hint to reveal is the solution. */
export function revealsSolution(hint: Hint | undefined): boolean {
  return hint?.stage === SOLUTION_STAGE;
}
