import type {
  Attempt,
  MissionProgress,
  PlayerState,
  PredictionEvidence,
  Settings,
  SkillEvidence,
} from "../persistence/schema";
import { betterMatch, pruneAttempts } from "./attempts";

/** Enough of a mission to start its progress record. */
export interface MissionRef {
  readonly id: string;
  readonly starterSource: string;
}

export type ProgressEvent =
  | {
      readonly type: "mission-started";
      readonly mission: MissionRef;
      readonly at: string;
    }
  | {
      readonly type: "source-saved";
      readonly mission: MissionRef;
      readonly source: string;
      readonly at: string;
    }
  | {
      readonly type: "hint-stage-saved";
      readonly mission: MissionRef;
      readonly stage: number;
      readonly at: string;
    }
  | {
      readonly type: "attempt-recorded";
      readonly mission: MissionRef;
      readonly attempt: Attempt;
    }
  | { readonly type: "attempts-pruned"; readonly missionId: string }
  | {
      readonly type: "attempt-pinned";
      readonly missionId: string;
      readonly attemptId: string;
      readonly pinned: boolean;
    }
  | { readonly type: "history-cleared"; readonly missionId: string }
  | {
      readonly type: "mission-completed";
      readonly mission: MissionRef;
      readonly completionId: string;
      readonly at: string;
      readonly skills: readonly SkillEvidence[];
      readonly prediction?: PredictionEvidence;
    }
  | { readonly type: "settings-changed"; readonly settings: Settings }
  | { readonly type: "state-replaced"; readonly state: PlayerState };

export type MissionStatus = "new" | "in-progress" | "complete";

export function missionStatus(
  progress: MissionProgress | undefined,
): MissionStatus {
  if (progress === undefined) {
    return "new";
  }
  return progress.completion === undefined ? "in-progress" : "complete";
}

/**
 * Applies one progress event. Updates are immutable, and a mission or skill
 * an event leaves alone keeps its object identity, so storage can write only
 * what changed.
 */
export function progressReducer(
  state: PlayerState,
  event: ProgressEvent,
): PlayerState {
  switch (event.type) {
    case "mission-started":
      return updateMission(state, event.mission, event.at, (m) => m);
    case "source-saved":
      return updateMission(state, event.mission, event.at, (m) =>
        m.source === event.source
          ? m
          : { ...m, source: event.source, sourceSavedAt: event.at },
      );
    case "hint-stage-saved":
      return updateMission(state, event.mission, event.at, (m) =>
        event.stage <= m.hintMaxStage ? m : { ...m, hintMaxStage: event.stage },
      );
    case "attempt-recorded":
      return recordAttempt(state, event.mission, event.attempt);
    case "attempts-pruned":
      return updateExisting(state, event.missionId, (m) => {
        const attempts = pruneAttempts(m.attempts);
        return attempts === m.attempts ? m : { ...m, attempts };
      });
    case "attempt-pinned":
      return updateExisting(state, event.missionId, (m) =>
        m.attempts.some(
          (attempt) =>
            attempt.id === event.attemptId && attempt.pinned !== event.pinned,
        )
          ? {
              ...m,
              attempts: m.attempts.map((attempt) =>
                attempt.id === event.attemptId
                  ? { ...attempt, pinned: event.pinned }
                  : attempt,
              ),
            }
          : m,
      );
    case "history-cleared":
      return updateExisting(state, event.missionId, (m) => {
        const attempts = m.attempts.filter((attempt) => attempt.pinned);
        return attempts.length === m.attempts.length ? m : { ...m, attempts };
      });
    case "mission-completed":
      return completeMission(state, event);
    case "settings-changed":
      // Storage writes settings only when their object changes.
      return sameSettings(event.settings, state.settings)
        ? state
        : { ...state, settings: event.settings };
    case "state-replaced":
      return event.state;
  }
}

function sameSettings(a: Settings, b: Settings): boolean {
  return (
    a.scaffold === b.scaffold &&
    a.graphics === b.graphics &&
    a.motion === b.motion &&
    a.audio?.music.volume === b.audio?.music.volume &&
    a.audio?.music.muted === b.audio?.music.muted &&
    a.audio?.sfx.volume === b.audio?.sfx.volume &&
    a.audio?.sfx.muted === b.audio?.sfx.muted
  );
}

function newMission(ref: MissionRef, at: string): MissionProgress {
  return {
    missionId: ref.id,
    source: ref.starterSource,
    sourceSavedAt: at,
    hintMaxStage: 0,
    predictions: [],
    attempts: [],
  };
}

function updateMission(
  state: PlayerState,
  ref: MissionRef,
  at: string,
  update: (mission: MissionProgress) => MissionProgress,
): PlayerState {
  const existing = state.missions[ref.id];
  const current = existing ?? newMission(ref, at);
  const next = update(current);
  if (next === existing) {
    return state;
  }
  return { ...state, missions: { ...state.missions, [ref.id]: next } };
}

function updateExisting(
  state: PlayerState,
  missionId: string,
  update: (mission: MissionProgress) => MissionProgress,
): PlayerState {
  const existing = state.missions[missionId];
  if (existing === undefined) {
    return state;
  }
  const next = update(existing);
  return next === existing
    ? state
    : { ...state, missions: { ...state.missions, [missionId]: next } };
}

function recordAttempt(
  state: PlayerState,
  ref: MissionRef,
  attempt: Attempt,
): PlayerState {
  return updateMission(state, ref, attempt.createdAt, (m) =>
    m.attempts.some((recorded) => recorded.id === attempt.id)
      ? m
      : {
          ...m,
          attempts: [...m.attempts, attempt],
          bestMatch: betterMatch(m.bestMatch, attempt),
        },
  );
}

function completeMission(
  state: PlayerState,
  event: Extract<ProgressEvent, { type: "mission-completed" }>,
): PlayerState {
  // The same completion can be reported twice, as React's development
  // checks do with effects.
  if (
    state.missions[event.mission.id]?.completion?.lastCompletionId ===
    event.completionId
  ) {
    return state;
  }
  const { prediction } = event;
  const withMission = updateMission(state, event.mission, event.at, (m) => ({
    ...m,
    completion: {
      count: (m.completion?.count ?? 0) + 1,
      firstCompletedAt: m.completion?.firstCompletedAt ?? event.at,
      lastCompletedAt: event.at,
      lastCompletionId: event.completionId,
    },
    predictions:
      prediction === undefined ? m.predictions : [...m.predictions, prediction],
  }));
  return addEvidence(withMission, event.skills);
}

function addEvidence(
  state: PlayerState,
  events: readonly SkillEvidence[],
): PlayerState {
  let skills = state.skills;
  for (const event of events) {
    const evidence = skills[event.skill]?.evidence ?? [];
    if (!evidence.some((recorded) => recorded.id === event.id)) {
      skills = { ...skills, [event.skill]: { evidence: [...evidence, event] } };
    }
  }
  return skills === state.skills ? state : { ...state, skills };
}
