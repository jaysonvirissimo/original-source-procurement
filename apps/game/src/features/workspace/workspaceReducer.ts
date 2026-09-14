import type { Mission } from "@osp/mission-schema";
import type { ResolveOutcome } from "../compiler/missionContextResolver";
import type { CompilationInput } from "../compiler/types";
import type { EditorReplacement } from "../editor/CEditor";
import type { MissionProgress } from "../persistence/schema";
import {
  currentMatch,
  isComplete,
  isCurrent,
  type CompletionState,
  type RecordedActions,
} from "./completion";
import {
  missionMatchTarget,
  type BuildRequest,
  type MissionResult,
} from "./missionResult";

export type WorkspaceMission = Pick<
  Mission,
  "id" | "completion" | "starterSource" | "target" | "hints" | "prediction"
>;

/** What a workspace resumes from: the saved source and the hints already opened. */
export type SavedWorkspace = Pick<MissionProgress, "source" | "hintMaxStage">;

export type ContextState =
  | { readonly kind: "resolving" }
  | { readonly kind: "ready"; readonly input: CompilationInput }
  | {
      readonly kind: "unavailable" | "content-mismatch";
      readonly path: string;
    }
  /** The mission's target is not an inline target. */
  | { readonly kind: "unsupported-target" };

export type Overlay = "none" | "manual" | "hint" | "history";

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
  readonly attempts: number;
  readonly actions: RecordedActions;
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
  | { readonly type: "context-resolved"; readonly outcome: ResolveOutcome }
  | { readonly type: "edited"; readonly source: string }
  | {
      readonly type: "source-hashed";
      readonly source: string;
      readonly sha256: string;
    }
  | { readonly type: "compile-started"; readonly request: BuildRequest }
  | { readonly type: "build-resolved"; readonly result: MissionResult }
  | { readonly type: "prediction-recorded"; readonly choice: number }
  | { readonly type: "evidence-acknowledged" }
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
    context:
      missionMatchTarget(mission) === undefined
        ? { kind: "unsupported-target" }
        : { kind: "resolving" },
    source: saved?.source ?? mission.starterSource,
    sourceSha256: undefined,
    latestBuildId: 0,
    compiling: undefined,
    result: undefined,
    attempts: 0,
    actions: {},
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
      return state.context.kind === "unsupported-target"
        ? state
        : { ...state, context: { kind: "resolving" } };
    case "context-resolved":
      return resolveContext(state, action.outcome);
    case "edited":
      return action.source === state.source
        ? state
        : { ...state, source: action.source, sourceSha256: undefined };
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
      return acknowledgeEvidence(state);
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
            replacement: {
              revision: (state.replacement?.revision ?? 0) + 1,
              source: action.source,
            },
          };
  }
}

function resolveContext(
  state: WorkspaceState,
  outcome: ResolveOutcome,
): WorkspaceState {
  switch (outcome.kind) {
    case "ready":
      return { ...state, context: { kind: "ready", input: outcome.input } };
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
  return { ...state, compiling: undefined, result };
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

function acknowledgeEvidence(state: WorkspaceState): WorkspaceState {
  const matched = currentMatch(completionState(state));
  if (
    state.mission.completion !== "acknowledge-evidence" ||
    matched === undefined
  ) {
    return state;
  }
  return {
    ...state,
    actions: {
      ...state.actions,
      acknowledgement: {
        missionId: state.mission.id,
        buildId: matched.request.buildId,
      },
    },
  };
}

function revealHint(state: WorkspaceState): WorkspaceState {
  const next = state.mission.hints.find((hint) => hint.stage > state.hintStage);
  return next === undefined ? state : { ...state, hintStage: next.stage };
}
