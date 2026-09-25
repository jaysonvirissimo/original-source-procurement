import { hintStagePurpose, type Hint } from "@osp/mission-schema";

const SOLUTION_STAGE = 9;

function numberedHints(hints: readonly Hint[]): readonly Hint[] {
  return hints.filter((each) => each.stage !== SOLUTION_STAGE);
}

/**
 * A hint's position alone, such as "Hint 2 of 4", or "Solution reveal".
 * Ladders skip stages, so the raw stage number is never shown.
 */
export function hintPosition(hints: readonly Hint[], hint: Hint): string {
  if (hint.stage === SOLUTION_STAGE) {
    return hintStagePurpose(SOLUTION_STAGE);
  }
  const numbered = numberedHints(hints);
  return `Hint ${String(numbered.indexOf(hint) + 1)} of ${String(numbered.length)}`;
}

/**
 * A hint's position and purpose, such as "Hint 2 of 4 · Where to look".
 * The solution is always "Solution reveal" rather than a numbered hint.
 */
export function hintLabel(hints: readonly Hint[], hint: Hint): string {
  const position = hintPosition(hints, hint);
  return hint.stage === SOLUTION_STAGE
    ? position
    : `${position} · ${hintStagePurpose(hint.stage)}`;
}

/**
 * The last hint at or before a saved stage. A ladder edited since the stage
 * was saved may no longer have it, so the hint before it stands in.
 */
export function hintReached(
  hints: readonly Hint[],
  stage: number,
): Hint | undefined {
  return hints.filter((hint) => hint.stage <= stage).at(-1);
}

/**
 * How far an attempt's hints went, for its saved `hintStage`, such as
 * "Hints opened through Hint 2 of 4 · Where to look".
 */
export function openedHintsLabel(
  hints: readonly Hint[],
  stage: number,
): string {
  const reached = hintReached(hints, stage);
  return reached === undefined
    ? "Hints opened"
    : `Hints opened through ${hintLabel(hints, reached)}`;
}

/**
 * What the whole ladder holds and costs, shown before any hint is opened
 * and kept in view afterwards.
 */
export function ladderSummary(hints: readonly Hint[]): string {
  const count = numberedHints(hints).length;
  const final = hints.find((hint) => hint.stage === SOLUTION_STAGE);
  const counted = `${String(count)} ${count === 1 ? "hint" : "hints"}`;
  const contents =
    final === undefined
      ? `${counted}.`
      : `${counted}, then a final step that shows ${
          final.reveal === undefined
            ? "the known matching solution"
            : "the known upstream source"
        }.`;
  const cost =
    final === undefined
      ? "Hints never block completion."
      : "Hints never block completion, but a completion after the final step does not advance skills.";
  return `${contents} Each hint gives away more than the one before it. ${cost}`;
}

/** Whether the next hint to reveal is the solution. */
export function revealsSolution(hint: Hint | undefined): boolean {
  return hint?.stage === SOLUTION_STAGE;
}
