import type { Mission } from "@osp/mission-schema";
import type { MatchTarget } from "@osp/matching-core";
import type { CompilationInput } from "../compiler/types";
import { inRange } from "../diff/diffLabels";
import type { EditorReplacement } from "../editor/CEditor";
import type { MissionProgress } from "../persistence/schema";
import {
  canCorrectPrediction,
  currentMatch,
  isComplete,
  isCurrent,
  type CompletionState,
  type RecordedActions,
} from "./completion";
import type { MissionContextOutcome } from "./missionContext";
import type { BuildRequest, MissionResult } from "./missionResult";

export type WorkspaceMission = Pick<
  Mission,
  | "id"
  | "completion"
  | "starterSource"
  | "target"
  | "hints"
  | "prediction"
  | "evidence"
>;

/**
 * What a workspace resumes from: the saved source, the hints already opened,
 * and the attempts already in History.
 */
export type SavedWorkspace = Pick<
  MissionProgress,
  "source" | "hintMaxStage" | "attempts"
>;

export type ContextState =
  | { readonly kind: "resolving" }
  | {
      readonly kind: "ready";
      readonly input: CompilationInput;
      readonly target: MatchTarget;
    }
  | {
      readonly kind: "unavailable" | "content-mismatch";
      readonly path: string;
    };

export type Overlay =
  "none" | "scan" | "manual" | "hint" | "history" | "context";

export interface WorkspaceState {
  readonly mission: WorkspaceMission;
  /** False while the briefing is shown. */
  readonly entered: boolean;
  readonly context: ContextState;
  readonly source: string;
  /** SHA-256 of `source`, or undefined while it is being hashed. */
  readonly sourceSha256: string | undefined;
  readonly latestBuildId: number;
  readonly compiling: BuildRequest | undefined;
  readonly result: MissionResult | undefined;
  /** The score of the last comparison before `result`, if there was one. */
  readonly previousScore: number | undefined;
  /** Compiles started during this visit. */
  readonly attempts: number;
  /** Attempts already in History when the workspace opened. */
  readonly earlierAttempts: number;
  /**
   * The workspace opened on saved work, and the player has not yet edited,
   * compiled, restored, or started practice.
   */
  readonly restored: boolean;
  readonly actions: RecordedActions;
  /** The last selection acknowledged outside the evidence, for feedback. */
  readonly evidenceMiss:
    { readonly buildId: number; readonly word: number } | undefined;
  /** The last wrong correction choice, for feedback. */
  readonly correctionMiss: number | undefined;
  /** The highest hint stage revealed, or 0. */
  readonly hintStage: number;
  readonly overlay: Overlay;
  /** The editor's share of the workspace width. */
  readonly split: number;
  readonly completed: boolean;
  /** The Compile request whose result completed the mission, or 0. */
  readonly completedBuildId: number;
  /** The player returned to the workspace after completing the mission. */
  readonly reviewing: boolean;
  /** Source restored from history, for the editor to apply. */
  readonly replacement: EditorReplacement | undefined;
}

export type WorkspaceAction =
  | { readonly type: "entered" }
  | { readonly type: "context-requested" }
  | {
      readonly type: "context-resolved";
      readonly outcome: MissionContextOutcome;
    }
  | { readonly type: "edited"; readonly source: string }
  | {
      readonly type: "source-hashed";
      readonly source: string;
      readonly sha256: string;
    }
  | { readonly type: "compile-started"; readonly request: BuildRequest }
  | { readonly type: "build-resolved"; readonly result: MissionResult }
  | { readonly type: "prediction-recorded"; readonly choice: number }
  | { readonly type: "evidence-acknowledged"; readonly word: number }
  | { readonly type: "prediction-corrected"; readonly choice: number }
  | { readonly type: "practice-started" }
  | { readonly type: "hint-revealed" }
  | { readonly type: "overlay-changed"; readonly overlay: Overlay }
  | { readonly type: "split-resized"; readonly split: number }
  | { readonly type: "review-requested" }
  | { readonly type: "attempt-restored"; readonly source: string };

export const SPLIT_LIMITS = { min: 0.25, max: 0.75 } as const;

export function initialWorkspaceState(
  mission: WorkspaceMission,
  saved?: SavedWorkspace,
): WorkspaceState {
  return {
    mission,
    entered: false,
    context: { kind: "resolving" },
    source: saved?.source ?? mission.starterSource,
    sourceSha256: undefined,
    latestBuildId: 0,
    compiling: undefined,
    result: undefined,
    previousScore: undefined,
    attempts: 0,
    earlierAttempts: saved?.attempts.length ?? 0,
    restored:
      saved !== undefined &&
      (saved.source !== mission.starterSource || saved.attempts.length > 0),
    actions: {},
    evidenceMiss: undefined,
    correctionMiss: undefined,
    hintStage: saved?.hintMaxStage ?? 0,
    overlay: "none",
    split: 0.5,
    completed: false,
    completedBuildId: 0,
    reviewing: false,
    replacement: undefined,
  };
}

export function completionState(state: WorkspaceState): CompletionState {
  return {
    missionId: state.mission.id,
    completion: state.mission.completion,
    evidence: state.mission.evidence?.range,
    predictionAnswer: state.mission.prediction?.answer,
    sourceSha256: state.sourceSha256,
    latestBuildId: state.latestBuildId,
    result: state.result,
    actions: state.actions,
  };
}

/** A result is shown as stale once it no longer describes the editor source. */
export function isStale(state: WorkspaceState): boolean {
  return (
    state.result !== undefined &&
    !isCurrent(completionState(state), state.result)
  );
}

export function hintsUsed(state: WorkspaceState): number {
  return state.mission.hints.filter((hint) => hint.stage <= state.hintStage)
    .length;
}

/** How much of the hint ladder the player has opened. */
export interface HintUsage {
  readonly opened: number;
  readonly available: number;
  /** The highest stage opened, or 0. */
  readonly stage: number;
}

export function hintUsage(state: WorkspaceState): HintUsage {
  return {
    opened: hintsUsed(state),
    available: state.mission.hints.length,
    stage: state.hintStage,
  };
}

/**
 * Applies one workspace action. Completion is re-evaluated after every
 * change and, once reached, stays reached.
 */
export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  const next = apply(state, action);
  if (next === state || next.completed || !isComplete(completionState(next))) {
    return next;
  }
  return { ...next, completed: true, completedBuildId: next.latestBuildId };
}

function apply(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "entered":
      return { ...state, entered: true };
    case "context-requested":
      return { ...state, context: { kind: "resolving" } };
    case "context-resolved":
      return resolveContext(state, action.outcome);
    case "edited":
      return action.source === state.source
        ? state
        : {
            ...state,
            source: action.source,
            sourceSha256: undefined,
            restored: false,
          };
    case "source-hashed":
      // Only the hash of the latest source applies.
      return action.source === state.source
        ? { ...state, sourceSha256: action.sha256 }
        : state;
    case "compile-started":
      return startCompile(state, action.request);
    case "build-resolved":
      return resolveBuild(state, action.result);
    case "prediction-recorded":
      return recordPrediction(state, action.choice);
    case "evidence-acknowledged":
      return acknowledgeEvidence(state, action.word);
    case "prediction-corrected":
      return correctPrediction(state, action.choice);
    case "practice-started":
      return startPractice(state);
    case "hint-revealed":
      return revealHint(state);
    case "overlay-changed":
      return { ...state, overlay: action.overlay };
    case "split-resized":
      return {
        ...state,
        split: Math.min(
          SPLIT_LIMITS.max,
          Math.max(SPLIT_LIMITS.min, action.split),
        ),
      };
    case "review-requested":
      return state.completed ? { ...state, reviewing: true } : state;
    case "attempt-restored":
      return action.source === state.source
        ? state
        : {
            ...state,
            source: action.source,
            sourceSha256: undefined,
            restored: false,
            replacement: {
              revision: (state.replacement?.revision ?? 0) + 1,
              source: action.source,
            },
          };
  }
}

function resolveContext(
  state: WorkspaceState,
  outcome: MissionContextOutcome,
): WorkspaceState {
  switch (outcome.kind) {
    case "ready":
      return {
        ...state,
        context: {
          kind: "ready",
          input: outcome.input,
          target: outcome.target,
        },
      };
    case "unavailable":
    case "content-mismatch":
      return {
        ...state,
        context: { kind: outcome.kind, path: outcome.path },
      };
    case "cancelled":
      return state;
  }
}

function startCompile(
  state: WorkspaceState,
  request: BuildRequest,
): WorkspaceState {
  if (
    request.missionId !== state.mission.id ||
    request.buildId <= state.latestBuildId
  ) {
    return state;
  }
  return {
    ...state,
    latestBuildId: request.buildId,
    compiling: request,
    attempts: state.attempts + 1,
    restored: false,
  };
}

function resolveBuild(
  state: WorkspaceState,
  result: MissionResult,
): WorkspaceState {
  // A result for another mission or an older request is dropped.
  if (
    result.request.missionId !== state.mission.id ||
    result.request.buildId !== state.latestBuildId
  ) {
    return state;
  }
  return {
    ...state,
    compiling: undefined,
    result,
    previousScore:
      state.result?.kind === "matched"
        ? state.result.result.score
        : state.previousScore,
  };
}

function recordPrediction(
  state: WorkspaceState,
  choice: number,
): WorkspaceState {
  const { prediction } = state.mission;
  if (
    prediction === undefined ||
    state.actions.prediction !== undefined ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= prediction.choices.length
  ) {
    return state;
  }
  return {
    ...state,
    actions: {
      ...state.actions,
      prediction: {
        missionId: state.mission.id,
        choice,
        nextBuildId: state.latestBuildId + 1,
      },
    },
  };
}

function acknowledgeEvidence(
  state: WorkspaceState,
  word: number,
): WorkspaceState {
  const matched = currentMatch(completionState(state));
  const { evidence } = state.mission;
  if (
    state.mission.completion !== "acknowledge-evidence" ||
    evidence === undefined ||
    matched === undefined
  ) {
    return state;
  }
  const { buildId } = matched.request;
  // A selection outside the evidence is feedback, never an acknowledgement.
  if (!inRange(word, evidence.range)) {
    return { ...state, evidenceMiss: { buildId, word } };
  }
  return {
    ...state,
    evidenceMiss: undefined,
    actions: {
      ...state.actions,
      acknowledgement: { missionId: state.mission.id, buildId, word },
    },
  };
}

function correctPrediction(
  state: WorkspaceState,
  choice: number,
): WorkspaceState {
  const completion = completionState(state);
  const matched = currentMatch(completion);
  if (matched === undefined || !canCorrectPrediction(completion)) {
    return state;
  }
  if (choice !== state.mission.prediction?.answer) {
    return { ...state, correctionMiss: choice };
  }
  return {
    ...state,
    correctionMiss: undefined,
    actions: {
      ...state.actions,
      correction: {
        missionId: state.mission.id,
        choice,
        buildId: matched.request.buildId,
      },
    },
  };
}

/**
 * Starts the mission over from its starting source with no hints opened.
 * Build numbers keep counting, so an older result still never applies.
 */
function startPractice(state: WorkspaceState): WorkspaceState {
  const { starterSource } = state.mission;
  return {
    ...initialWorkspaceState(state.mission, {
      source: starterSource,
      hintMaxStage: 0,
      attempts: [],
    }),
    entered: state.entered,
    earlierAttempts: state.earlierAttempts,
    context: state.context,
    split: state.split,
    latestBuildId: state.latestBuildId,
    compiling: state.compiling,
    replacement: {
      revision: (state.replacement?.revision ?? 0) + 1,
      source: starterSource,
    },
  };
}

function revealHint(state: WorkspaceState): WorkspaceState {
  const next = state.mission.hints.find((hint) => hint.stage > state.hintStage);
  return next === undefined ? state : { ...state, hintStage: next.stage };
}
