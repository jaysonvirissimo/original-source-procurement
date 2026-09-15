import type { MissionKind } from "@osp/mission-schema";
import {
  graphicsSetting,
  motionSetting,
  type GraphicsSetting,
  type Settings,
} from "../features/persistence/schema";
import type { MissionResult } from "../features/workspace/missionResult";

export const VR_PHASES = [
  "idle",
  "compiling",
  "error",
  "improved",
  "exact",
] as const;
export type VrPhase = (typeof VR_PHASES)[number];

export type MissionTier = "training" | "field" | "live";

/** Everything the decorative background may know. No source, words, or matches. */
export interface VrPresentationState {
  readonly phase: VrPhase;
  readonly missionTier: MissionTier;
  readonly reducedMotion: boolean;
  readonly quality: GraphicsSetting;
}

/** What the open workspace, if any, contributes to the background. */
export interface WorkspacePresentation {
  readonly phase: VrPhase;
  readonly missionTier: MissionTier;
}

export const IDLE_PRESENTATION: WorkspacePresentation = {
  phase: "idle",
  missionTier: "training",
};

/** Solved real functions are field work; unsolved ones are live. */
export function missionTier(kind: MissionKind): MissionTier {
  switch (kind) {
    case "real-solved":
      return "field";
    case "real-partial":
    case "live":
      return "live";
    case "demo":
    case "prediction":
    case "training":
    case "diagnosis":
    case "synthesis":
      return "training";
  }
}

/**
 * The background phase for a workspace's latest build. `previousScore` is
 * the score of the comparison shown before this result, if any.
 */
export function phaseFrom(input: {
  readonly compiling: boolean;
  readonly result: MissionResult | undefined;
  readonly previousScore: number | undefined;
}): VrPhase {
  const { compiling, result, previousScore } = input;
  if (compiling) {
    return "compiling";
  }
  if (result === undefined) {
    return "idle";
  }
  if (result.kind !== "matched") {
    return "error";
  }
  if (result.result.exact) {
    return "exact";
  }
  return previousScore !== undefined && result.result.score > previousScore
    ? "improved"
    : "idle";
}

export function presentationState(
  workspace: WorkspacePresentation,
  settings: Settings,
  prefersReducedMotion: boolean,
): VrPresentationState {
  return {
    phase: workspace.phase,
    missionTier: workspace.missionTier,
    reducedMotion:
      motionSetting(settings) === "reduced" || prefersReducedMotion,
    quality: graphicsSetting(settings),
  };
}
