import type { Mission } from "@osp/mission-schema";
import {
  matchFunction,
  type MatchResult,
  type MatchTarget,
} from "@osp/matching-core";
import type { BuildOutcome } from "../compiler/types";

/** One Compile request, bound to its mission and the exact source it built. */
export interface BuildRequest {
  readonly missionId: string;
  /** Increases with every Compile request. */
  readonly buildId: number;
  /** SHA-256 of the source sent to the build. */
  readonly sourceSha256: string;
}

export type FailedBuildOutcome = Exclude<BuildOutcome, { kind: "success" }>;

/**
 * A build outcome as mission feedback. `function-missing` is recoverable:
 * the build succeeded but defined no function named by the mission's
 * symbol, so there is nothing to compare.
 */
export type MissionResult =
  | {
      readonly kind: "matched";
      readonly request: BuildRequest;
      readonly result: MatchResult;
    }
  | {
      readonly kind: "function-missing";
      readonly request: BuildRequest;
      readonly symbol: string;
      readonly definedFunctions: readonly string[];
    }
  | {
      readonly kind: "build-failed";
      readonly request: BuildRequest;
      readonly outcome: FailedBuildOutcome;
    };

/**
 * The words an inline target compares against, including its relocations.
 * A remote target's words load from upstream at runtime, so it has none
 * here.
 */
export function missionMatchTarget(
  mission: Pick<Mission, "target">,
): MatchTarget | undefined {
  const { target } = mission;
  return target.kind === "inline"
    ? {
        kind: "unlinked",
        words: target.words,
        relocations: target.relocations,
      }
    : undefined;
}

export function missionResultFrom(
  request: BuildRequest,
  outcome: BuildOutcome,
  symbol: string,
  target: MatchTarget,
): MissionResult {
  if (outcome.kind !== "success") {
    return { kind: "build-failed", request, outcome };
  }
  const matched = matchFunction(outcome.object, symbol, target);
  return matched.kind === "matched"
    ? { kind: "matched", request, result: matched.result }
    : {
        kind: "function-missing",
        request,
        symbol: matched.symbol,
        definedFunctions: matched.definedFunctions,
      };
}
