import type { PlayerState, SkillEvidence } from "../persistence/schema";

/**
 * How one completion was reached: with no hint opened, with hints short of
 * the solution, or with the solution revealed, which never advances skills.
 */
export const COMPLETION_MODES = [
  "independent",
  "hinted",
  "solution-revealed",
] as const;
export type CompletionMode = (typeof COMPLETION_MODES)[number];

/** Words players read for each mode. */
export function completionModeText(
  mode: CompletionMode,
  stage: number,
): string {
  switch (mode) {
    case "independent":
      return "Independent";
    case "hinted":
      return `Hints to stage ${String(stage)}`;
    case "solution-revealed":
      return "Solution revealed";
  }
}

/**
 * The mode of one completion, from the skill evidence it recorded. Every
 * event of a completion shares its hint facts, so any one of them decides.
 */
export function completionMode(
  events: readonly Pick<SkillEvidence, "hintMaxStage" | "solutionRevealed">[],
): CompletionMode | undefined {
  const [event] = events;
  if (event === undefined) {
    return undefined;
  }
  if (event.solutionRevealed) {
    return "solution-revealed";
  }
  return event.hintMaxStage > 0 ? "hinted" : "independent";
}

/**
 * Whether a completed mission has only ever been completed with its solution
 * revealed. A mission whose completions recorded no skill evidence is never
 * reported this way.
 */
export function onlyRevealed(
  state: Pick<PlayerState, "skills">,
  missionId: string,
): boolean {
  const byCompletion = new Map<string, SkillEvidence[]>();
  for (const { evidence } of Object.values(state.skills)) {
    for (const event of evidence) {
      if (event.missionId === missionId) {
        byCompletion.set(event.completionId, [
          ...(byCompletion.get(event.completionId) ?? []),
          event,
        ]);
      }
    }
  }
  const modes = [...byCompletion.values()].map(completionMode);
  return (
    modes.length > 0 && modes.every((mode) => mode === "solution-revealed")
  );
}
