import { describe, expect, it } from "vitest";
import {
  canAcknowledge,
  canCorrectPrediction,
  currentMatch,
  isComplete,
  isCurrent,
  revealedPrediction,
  type CompletionState,
  type RecordedActions,
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
      evidence: { start: 1, end: 2 },
      result: matchedResult(demoMission, request(demoMission, 1), false),
    });
    const acknowledged = (word: number, buildId = 1, missionId = "001") => ({
      ...base,
      actions: { acknowledgement: { missionId, buildId, word } },
    });

    it("needs a current matched result to acknowledge", () => {
      expect(canAcknowledge(base)).toBe(true);
      expect(canAcknowledge(state({ result: failed }))).toBe(false);
      expect(canAcknowledge({ ...base, sourceSha256: EDITED })).toBe(false);
    });

    it("completes once the evidence word is acknowledged, without an exact match", () => {
      expect(isComplete(base)).toBe(false);
      expect(isComplete(acknowledged(1))).toBe(true);
    });

    it.each([
      ["a word outside the evidence", acknowledged(0)],
      ["another build", acknowledged(1, 0)],
      ["another mission", acknowledged(1, 1, "003")],
      [
        "a build that is now stale",
        { ...acknowledged(1), sourceSha256: EDITED },
      ],
    ] as const)("ignores an acknowledgement of %s", (_name, current) => {
      expect(isComplete(current)).toBe(false);
    });
  });

  describe("prediction-recorded", () => {
    const answer = predictionMission.prediction?.answer ?? -1;
    const wrong = answer === 0 ? 1 : 0;
    const base = state({
      missionId: predictionMission.id,
      completion: predictionMission.completion,
      predictionAnswer: answer,
      latestBuildId: 2,
      result: matchedResult(predictionMission, request(predictionMission, 2)),
    });
    const predicted = (
      choice: number,
      nextBuildId = 2,
      correction?: RecordedActions["correction"],
    ): CompletionState => ({
      ...base,
      actions: {
        prediction: { missionId: "002", choice, nextBuildId },
        ...(correction === undefined ? {} : { correction }),
      },
    });
    const corrected = (choice: number, buildId = 2, missionId = "002") => ({
      missionId,
      choice,
      buildId,
    });

    it("completes from a right prediction recorded before the build", () => {
      const current = predicted(answer);
      expect(canCorrectPrediction(current)).toBe(false);
      expect(isComplete(current)).toBe(true);
    });

    it("keeps a prediction recorded before an earlier failed build", () => {
      expect(isComplete(predicted(answer, 1))).toBe(true);
    });

    it("does not complete a wrong prediction until it is corrected", () => {
      const current = predicted(wrong);
      expect(revealedPrediction(current)?.choice).toBe(wrong);
      expect(canCorrectPrediction(current)).toBe(true);
      expect(isComplete(current)).toBe(false);

      const fixed = predicted(wrong, 2, corrected(answer));
      expect(canCorrectPrediction(fixed)).toBe(false);
      expect(isComplete(fixed)).toBe(true);
    });

    it("keeps a correction through a rebuild of the same source", () => {
      const rebuilt: CompletionState = {
        ...predicted(wrong, 2, corrected(answer)),
        latestBuildId: 3,
        result: matchedResult(predictionMission, request(predictionMission, 3)),
      };
      expect(isComplete(rebuilt)).toBe(true);
    });

    it.each([
      ["a wrong choice", corrected(wrong)],
      ["another mission", corrected(answer, 2, "003")],
      [
        "a choice made before the build revealed the answer",
        corrected(answer, 1),
      ],
      ["a choice from a later build", corrected(answer, 3)],
    ] as const)("does not complete from a correction with %s", (_name, fix) => {
      expect(isComplete(predicted(wrong, 2, fix))).toBe(false);
    });

    it("waits for a matched build before asking for a correction", () => {
      const missing: CompletionState = {
        ...predicted(wrong),
        result: {
          kind: "function-missing",
          request: request(predictionMission, 2),
          symbol: "argument_zero",
          definedFunctions: [],
        },
      };
      expect(revealedPrediction(missing)).toBeUndefined();
      expect(canCorrectPrediction(missing)).toBe(false);
      expect(isComplete(missing)).toBe(false);
    });

    it("does not complete from a prediction made after the build or for another mission", () => {
      expect(isComplete(base)).toBe(false);
      expect(isComplete(predicted(answer, 3))).toBe(false);
      expect(
        isComplete({
          ...base,
          actions: {
            prediction: { missionId: "003", choice: answer, nextBuildId: 1 },
          },
        }),
      ).toBe(false);
    });
  });
});
