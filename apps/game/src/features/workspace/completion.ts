import type { InstructionRange, Mission } from "@osp/mission-schema";
import { inRange } from "../diff/diffLabels";
import type { MissionResult } from "./missionResult";

/** The player acknowledged the target word they selected in one build. */
export interface Acknowledgement {
  readonly missionId: string;
  readonly buildId: number;
  /** The selected target word index. */
  readonly word: number;
}

/** A prediction, recorded before the Compile request numbered `nextBuildId`. */
export interface Prediction {
  readonly missionId: string;
  readonly choice: number;
  readonly nextBuildId: number;
}

/** The answer chosen after a build revealed a wrong prediction. */
export interface PredictionCorrection {
  readonly missionId: string;
  readonly choice: number;
  /** The Compile request whose result revealed the answer. */
  readonly buildId: number;
}

export interface RecordedActions {
  readonly acknowledgement?: Acknowledgement;
  readonly prediction?: Prediction;
  readonly correction?: PredictionCorrection;
}

/** Everything completion depends on, and nothing else. */
export interface CompletionState {
  readonly missionId: string;
  readonly completion: Mission["completion"];
  /** The target words an acknowledgement must select. */
  readonly evidence?: InstructionRange | undefined;
  /** The index of the right prediction choice. */
  readonly predictionAnswer?: number | undefined;
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

/** The prediction the current match has revealed, if there is one. */
export function revealedPrediction(
  state: CompletionState,
  matched: MatchedResult | undefined = currentMatch(state),
): Prediction | undefined {
  const { prediction } = state.actions;
  // Failed and function-missing builds do not use the prediction up.
  return matched !== undefined &&
    prediction?.missionId === state.missionId &&
    prediction.nextBuildId <= matched.request.buildId
    ? prediction
    : undefined;
}

/** A revealed prediction was wrong and has not yet been corrected. */
export function canCorrectPrediction(state: CompletionState): boolean {
  const matched = currentMatch(state);
  const prediction = revealedPrediction(state, matched);
  return (
    matched !== undefined &&
    prediction !== undefined &&
    prediction.choice !== state.predictionAnswer &&
    !isCorrected(state, prediction, matched)
  );
}

function isCorrected(
  state: CompletionState,
  prediction: Prediction,
  matched: MatchedResult,
): boolean {
  const { correction } = state.actions;
  return (
    correction?.missionId === state.missionId &&
    correction.choice === state.predictionAnswer &&
    prediction.nextBuildId <= correction.buildId &&
    correction.buildId <= matched.request.buildId
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
  const { acknowledgement } = state.actions;
  switch (state.completion) {
    case "exact":
      return matched.result.exact;
    case "acknowledge-evidence":
      return (
        acknowledgement?.missionId === state.missionId &&
        acknowledgement.buildId === matched.request.buildId &&
        inRange(acknowledgement.word, state.evidence)
      );
    case "prediction-recorded": {
      // A wrong prediction still completes, once the player has chosen the
      // answer the build revealed.
      const prediction = revealedPrediction(state, matched);
      return (
        prediction !== undefined &&
        (prediction.choice === state.predictionAnswer ||
          isCorrected(state, prediction, matched))
      );
    }
  }
}
