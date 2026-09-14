import { describe, expect, it } from "vitest";
import {
  canAcknowledge,
  currentMatch,
  isComplete,
  isCurrent,
  type CompletionState,
} from "./completion";
import type { MissionResult } from "./missionResult";
import {
  matchedResult,
  request,
  shippedMission,
} from "./workspace.test-helpers";

const exactMission = shippedMission("003");
const demoMission = shippedMission("001");
const predictionMission = shippedMission("002");
const SOURCE = "a".repeat(64);
const EDITED = "b".repeat(64);

function state(overrides: Partial<CompletionState>): CompletionState {
  return {
    missionId: exactMission.id,
    completion: exactMission.completion,
    sourceSha256: SOURCE,
    latestBuildId: 1,
    result: undefined,
    actions: {},
    ...overrides,
  };
}

const failed: MissionResult = {
  kind: "build-failed",
  request: request(exactMission, 1),
  outcome: { kind: "compiler-failure", diagnostics: [] },
};

describe("isCurrent", () => {
  const result = matchedResult(exactMission, request(exactMission, 1));

  it.each([
    ["the latest request for the open mission and source", {}, true],
    ["no result", { result: undefined }, false],
    ["another mission", { missionId: "002" }, false],
    ["an older request", { latestBuildId: 2 }, false],
    ["edited source", { sourceSha256: EDITED }, false],
    ["source still being hashed", { sourceSha256: undefined }, false],
  ] as const)("%s → %s", (_name, overrides, expected) => {
    const current = state({ result, ...overrides });
    expect(isCurrent(current, current.result)).toBe(expected);
  });
});

describe("isComplete", () => {
  it("completes an exact mission from a current exact match", () => {
    const current = state({
      result: matchedResult(exactMission, request(exactMission, 1)),
    });

    expect(currentMatch(current)?.result.exact).toBe(true);
    expect(isComplete(current)).toBe(true);
  });

  it.each([
    [
      "a mismatch",
      matchedResult(exactMission, request(exactMission, 1), false),
    ],
    ["a failed build", failed],
    [
      "a cancelled build",
      {
        ...failed,
        outcome: { kind: "cancelled" },
      } satisfies MissionResult,
    ],
    [
      "a timed-out build",
      {
        ...failed,
        outcome: { kind: "timeout", timeoutMs: 1000 },
      } satisfies MissionResult,
    ],
    [
      "a missing function",
      {
        kind: "function-missing",
        request: request(exactMission, 1),
        symbol: "add_immediate",
        definedFunctions: [],
      } satisfies MissionResult,
    ],
  ] as const)("does not complete from %s", (_name, result) => {
    expect(isComplete(state({ result }))).toBe(false);
  });

  it("does not complete from a stale exact match", () => {
    expect(
      isComplete(
        state({
          sourceSha256: EDITED,
          result: matchedResult(exactMission, request(exactMission, 1)),
        }),
      ),
    ).toBe(false);
  });

  describe("acknowledge-evidence", () => {
    const base = state({
      missionId: demoMission.id,
      completion: demoMission.completion,
      result: matchedResult(demoMission, request(demoMission, 1), false),
    });

    it("needs a current matched result to acknowledge", () => {
      expect(canAcknowledge(base)).toBe(true);
      expect(canAcknowledge(state({ result: failed }))).toBe(false);
      expect(canAcknowledge({ ...base, sourceSha256: EDITED })).toBe(false);
    });

    it("completes once the current build is acknowledged, without an exact match", () => {
      expect(isComplete(base)).toBe(false);
      expect(
        isComplete({
          ...base,
          actions: { acknowledgement: { missionId: "001", buildId: 1 } },
        }),
      ).toBe(true);
    });

    it("ignores an acknowledgement of another build or mission", () => {
      expect(
        isComplete({
          ...base,
          actions: { acknowledgement: { missionId: "001", buildId: 0 } },
        }),
      ).toBe(false);
      expect(
        isComplete({
          ...base,
          actions: { acknowledgement: { missionId: "003", buildId: 1 } },
        }),
      ).toBe(false);
    });
  });

  describe("prediction-recorded", () => {
    const base = state({
      missionId: predictionMission.id,
      completion: predictionMission.completion,
      latestBuildId: 2,
      result: matchedResult(predictionMission, request(predictionMission, 2)),
    });

    it("completes from a prediction recorded before the build, even a wrong one", () => {
      expect(
        isComplete({
          ...base,
          actions: {
            prediction: { missionId: "002", choice: 0, nextBuildId: 2 },
          },
        }),
      ).toBe(true);
    });

    it("keeps a prediction recorded before an earlier failed build", () => {
      expect(
        isComplete({
          ...base,
          actions: {
            prediction: { missionId: "002", choice: 1, nextBuildId: 1 },
          },
        }),
      ).toBe(true);
    });

    it("does not complete from a prediction made after the build or for another mission", () => {
      expect(isComplete(base)).toBe(false);
      expect(
        isComplete({
          ...base,
          actions: {
            prediction: { missionId: "002", choice: 1, nextBuildId: 3 },
          },
        }),
      ).toBe(false);
      expect(
        isComplete({
          ...base,
          actions: {
            prediction: { missionId: "003", choice: 1, nextBuildId: 1 },
          },
        }),
      ).toBe(false);
    });
  });
});
