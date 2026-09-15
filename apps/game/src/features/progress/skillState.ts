import type { PlayerState, SkillEvidence } from "../persistence/schema";

/** How far a skill has come, from least to most. It never decreases. */
export const SKILL_STATES = [
  "NEW",
  "INTRODUCED",
  "PRACTICED",
  "DEMONSTRATED",
  "MASTERED",
] as const;
export type SkillState = (typeof SKILL_STATES)[number];

const APPLIED_KINDS: ReadonlySet<SkillEvidence["kind"]> = new Set([
  "synthesis",
  "real",
]);

/** The next state, and whether an event earns it. */
interface Step {
  readonly to: SkillState;
  readonly earns: (event: SkillEvidence) => boolean;
}

const STEPS: Readonly<Record<SkillState, Step | undefined>> = {
  NEW: { to: "INTRODUCED", earns: () => true },
  INTRODUCED: {
    to: "PRACTICED",
    earns: (event) => event.kind !== "introduced" && event.hintMaxStage <= 6,
  },
  PRACTICED: {
    to: "DEMONSTRATED",
    earns: (event) => APPLIED_KINDS.has(event.kind) && event.hintMaxStage <= 4,
  },
  // Mastery must come from a different mission than demonstration did; the
  // one-advance-per-mission rule below already guarantees that.
  DEMONSTRATED: {
    to: "MASTERED",
    earns: (event) => APPLIED_KINDS.has(event.kind) && event.hintMaxStage <= 3,
  },
  MASTERED: undefined,
};

/**
 * A skill's state, recomputed from its evidence in completion order. Each
 * event advances at most one step; a revealed solution never advances; and a
 * mission advances a skill at most once, so replays cannot farm progress.
 * Prediction results are not skill evidence and play no part.
 */
export function skillState(evidence: readonly SkillEvidence[]): SkillState {
  const ordered = [...evidence].sort(
    (a, b) =>
      Date.parse(a.completedAt) - Date.parse(b.completedAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  let state: SkillState = "NEW";
  const advancedBy = new Set<string>();
  for (const event of ordered) {
    const step: Step | undefined = STEPS[state];
    if (step === undefined) {
      break;
    }
    if (
      event.solutionRevealed ||
      advancedBy.has(event.missionId) ||
      !step.earns(event)
    ) {
      continue;
    }
    state = step.to;
    advancedBy.add(event.missionId);
  }
  return state;
}

/** Words players read for each state. */
export const SKILL_STATE_LABELS: Readonly<Record<SkillState, string>> = {
  NEW: "New",
  INTRODUCED: "Introduced",
  PRACTICED: "Practiced",
  DEMONSTRATED: "Demonstrated",
  MASTERED: "Mastered",
};

export function skillStateOf(
  skills: PlayerState["skills"],
  skill: string,
): SkillState {
  return skillState(skills[skill]?.evidence ?? []);
}

export interface SkillChange {
  readonly skill: string;
  readonly before: SkillState;
  readonly after: SkillState;
  /** The completion's event revealed the solution, so it could not advance. */
  readonly solutionRevealed: boolean;
}

/** Each skill a completion recorded evidence for, with and without it. */
export function completionSkillChanges(
  skills: PlayerState["skills"],
  completionId: string,
): SkillChange[] {
  return Object.entries(skills).flatMap(([skill, { evidence }]) => {
    const own = evidence.find((event) => event.completionId === completionId);
    if (own === undefined) {
      return [];
    }
    return [
      {
        skill,
        before: skillState(
          evidence.filter((event) => event.completionId !== completionId),
        ),
        after: skillState(evidence),
        solutionRevealed: own.solutionRevealed,
      },
    ];
  });
}
