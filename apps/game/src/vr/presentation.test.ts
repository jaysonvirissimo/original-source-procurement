import { MISSION_KINDS, type MissionKind } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import type { MissionResult } from "../features/workspace/missionResult";
import {
  IDLE_PRESENTATION,
  missionTier,
  phaseFrom,
  presentationState,
} from "./presentation";

const request = { missionId: "001", buildId: 1, sourceSha256: "a" };

function matched(exact: boolean, score: number): MissionResult {
  return {
    kind: "matched",
    request,
    result: { exact, score },
  } as MissionResult;
}

const missing = {
  kind: "function-missing",
  request,
  symbol: "f",
  definedFunctions: [],
} as unknown as MissionResult;

const failed = {
  kind: "build-failed",
  request,
  outcome: { kind: "compiler-failure" },
} as unknown as MissionResult;

describe("missionTier", () => {
  const expected: Record<MissionKind, string> = {
    demo: "training",
    prediction: "training",
    training: "training",
    diagnosis: "training",
    synthesis: "training",
    "real-solved": "field",
    "real-partial": "live",
    live: "live",
  };

  it.each(MISSION_KINDS)("places a %s mission", (kind) => {
    expect(missionTier(kind)).toBe(expected[kind]);
  });
});

describe("phaseFrom", () => {
  it.each([
    [
      "compiling wins over any result",
      true,
      matched(true, 1),
      undefined,
      "compiling",
    ],
    ["nothing built yet", false, undefined, undefined, "idle"],
    ["a failed build", false, failed, 0.5, "error"],
    ["a missing function", false, missing, undefined, "error"],
    ["an exact match", false, matched(true, 1), 0.2, "exact"],
    ["a better score", false, matched(false, 0.6), 0.5, "improved"],
    ["the same score", false, matched(false, 0.5), 0.5, "idle"],
    ["a worse score", false, matched(false, 0.4), 0.5, "idle"],
    ["a first comparison", false, matched(false, 0.4), undefined, "idle"],
  ] as const)("%s", (_name, compiling, result, previousScore, phase) => {
    expect(phaseFrom({ compiling, result, previousScore })).toBe(phase);
  });
});

describe("presentationState", () => {
  const workspace = { phase: "exact", missionTier: "field" } as const;

  it("defaults to full graphics following the device's motion preference", () => {
    expect(presentationState(workspace, {}, false)).toEqual({
      phase: "exact",
      missionTier: "field",
      reducedMotion: false,
      quality: "full",
    });
    expect(presentationState(IDLE_PRESENTATION, {}, true)).toEqual({
      phase: "idle",
      missionTier: "training",
      reducedMotion: true,
      quality: "full",
    });
  });

  it("reduces motion when the setting says so, whatever the device prefers", () => {
    const settings = { motion: "reduced", graphics: "simple" } as const;
    expect(presentationState(workspace, settings, false)).toMatchObject({
      reducedMotion: true,
      quality: "simple",
    });
    expect(
      presentationState(workspace, { motion: "system" }, false).reducedMotion,
    ).toBe(false);
  });
});
