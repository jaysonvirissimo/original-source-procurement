import type { Mission } from "@osp/mission-schema";
import type { MissionResult } from "./missionResult";

/** The player acknowledged the evidence of one build. */
export interface Acknowledgement {
  readonly missionId: string;
  readonly buildId: number;
}

/** A prediction, recorded before the Compile request numbered `nextBuildId`. */
export interface Prediction {
  readonly missionId: string;
  readonly choice: number;
  readonly nextBuildId: number;
}

export interface RecordedActions {
  readonly acknowledgement?: Acknowledgement;
  readonly prediction?: Prediction;
}

/** Everything completion depends on, and nothing else. */
export interface CompletionState {
  readonly missionId: string;
  readonly completion: Mission["completion"];
  /** SHA-256 of the editor source, or undefined while it is being hashed. */
  readonly sourceSha256: string | undefined;
  /** The latest Compile request for this mission, or 0 before the first. */
  readonly latestBuildId: number;
  readonly result: MissionResult | undefined;
  readonly actions: RecordedActions;
}

export type MatchedResult = Extract<MissionResult, { kind: "matched" }>;

/**
 * A result is current when it belongs to the open mission, answers the latest
 * Compile request, and built the source now in the editor.
 */
export function isCurrent(
  state: Pick<CompletionState, "missionId" | "sourceSha256" | "latestBuildId">,
  result: MissionResult | undefined,
): result is MissionResult {
  return (
    result?.request.missionId === state.missionId &&
    result.request.buildId === state.latestBuildId &&
    state.sourceSha256 !== undefined &&
    result.request.sourceSha256 === state.sourceSha256
  );
}

export function currentMatch(
  state: CompletionState,
): MatchedResult | undefined {
  const { result } = state;
  return isCurrent(state, result) && result.kind === "matched"
    ? result
    : undefined;
}

export function canAcknowledge(state: CompletionState): boolean {
  return (
    state.completion === "acknowledge-evidence" &&
    currentMatch(state) !== undefined
  );
}

/**
 * Whether the mission is complete. Every rule needs a current `matched`
 * result, so failed, cancelled, timed-out, function-missing, and stale builds
 * never complete a mission.
 */
export function isComplete(state: CompletionState): boolean {
  const matched = currentMatch(state);
  if (matched === undefined) {
    return false;
  }
  const { acknowledgement, prediction } = state.actions;
  switch (state.completion) {
    case "exact":
      return matched.result.exact;
    case "acknowledge-evidence":
      return (
        acknowledgement?.missionId === state.missionId &&
        acknowledgement.buildId === matched.request.buildId
      );
    case "prediction-recorded":
      // Failed and function-missing builds do not use the prediction up.
      return (
        prediction?.missionId === state.missionId &&
        prediction.nextBuildId <= matched.request.buildId
      );
  }
}
