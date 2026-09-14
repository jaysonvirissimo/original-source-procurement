import { realMission } from "@osp/mission-schema/testing";
import { describe, expect, it } from "vitest";
import type { BuildOutcome } from "../compiler/types";
import { missionMatchTarget, missionResultFrom } from "./missionResult";
import {
  inlineWords,
  matchedResult,
  objectWith,
  request,
  shippedMission,
  successWith,
} from "./workspace.test-helpers";

const mission = shippedMission("003");

function target() {
  const matchTarget = missionMatchTarget(mission);
  if (matchTarget === undefined) {
    throw new Error("Mission 003 has an inline target.");
  }
  return matchTarget;
}

describe("missionMatchTarget", () => {
  it("compares an inline target's words and relocations as unlinked", () => {
    expect(target()).toEqual({
      kind: "unlinked",
      words: inlineWords(mission),
      relocations: [],
    });
  });

  it("has no target for a remote pointer", () => {
    expect(missionMatchTarget(realMission())).toBeUndefined();
  });
});

describe("missionResultFrom", () => {
  const failures: BuildOutcome[] = [
    { kind: "compiler-failure", diagnostics: [] },
    { kind: "assembler-failure", compilerText: "", diagnostics: [] },
    { kind: "cancelled" },
    { kind: "timeout", timeoutMs: 1000 },
    { kind: "infrastructure-failure", message: "worker crashed" },
  ];

  it.each(failures.map((outcome) => [outcome.kind, outcome] as const))(
    "reports a %s build as build-failed",
    (_kind, outcome) => {
      expect(
        missionResultFrom(
          request(mission, 1),
          outcome,
          mission.symbol,
          target(),
        ),
      ).toEqual({
        kind: "build-failed",
        request: request(mission, 1),
        outcome,
      });
    },
  );

  it("matches the mission's function exactly", () => {
    const result = matchedResult(mission, request(mission, 2));

    expect(result.kind).toBe("matched");
    expect(result.kind === "matched" && result.result.exact).toBe(true);
    expect(result.request).toEqual(request(mission, 2));
  });

  it("classifies a differing function without completing it", () => {
    const result = matchedResult(mission, request(mission, 3), false);

    expect(result.kind === "matched" && result.result.exact).toBe(false);
    expect(
      result.kind === "matched" && result.result.mismatches.length,
    ).toBeGreaterThan(0);
  });

  it("reports empty source as function-missing", () => {
    expect(
      missionResultFrom(
        request(mission, 4),
        successWith(objectWith(mission.symbol, [])),
        mission.symbol,
        target(),
      ),
    ).toEqual({
      kind: "function-missing",
      request: request(mission, 4),
      symbol: "add_immediate",
      definedFunctions: [],
    });
  });

  it("names the function found when the mission's function was renamed", () => {
    expect(
      missionResultFrom(
        request(mission, 5),
        successWith(objectWith("add_five", inlineWords(mission))),
        mission.symbol,
        target(),
      ),
    ).toEqual({
      kind: "function-missing",
      request: request(mission, 5),
      symbol: "add_immediate",
      definedFunctions: ["add_five"],
    });
  });
});
