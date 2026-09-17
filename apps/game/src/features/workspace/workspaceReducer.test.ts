import { describe, expect, it } from "vitest";
import type { CompilationInput } from "../compiler/types";
import { attempt } from "../persistence/persistence.test-helpers";
import type { MissionResult } from "./missionResult";
import {
  matchedResult,
  request,
  shippedMission,
} from "./workspace.test-helpers";
import {
  hintsUsed,
  initialWorkspaceState,
  isStale,
  SPLIT_LIMITS,
  workspaceReducer,
  type WorkspaceAction,
  type WorkspaceState,
} from "./workspaceReducer";

const exactMission = shippedMission("003");
const demoMission = shippedMission("001");
const predictionMission = shippedMission("002");
const SOURCE = "a".repeat(64);

function run(
  state: WorkspaceState,
  ...actions: WorkspaceAction[]
): WorkspaceState {
  return actions.reduce(workspaceReducer, state);
}

/** A workspace with its starter source hashed as SOURCE. */
function hashed(mission = exactMission): WorkspaceState {
  const initial = initialWorkspaceState(mission);
  return run(initial, {
    type: "source-hashed",
    source: initial.source,
    sha256: SOURCE,
  });
}

/** Starts the build that `result` answers, then resolves it. */
function compileAndResolve(
  state: WorkspaceState,
  result: MissionResult,
): WorkspaceState {
  return run(
    state,
    { type: "compile-started", request: result.request },
    { type: "build-resolved", result },
  );
}

describe("initial state", () => {
  it("opens on the briefing with the starter source", () => {
    const state = initialWorkspaceState(exactMission);

    expect(state).toMatchObject({
      entered: false,
      context: { kind: "resolving" },
      source: exactMission.starterSource,
      sourceSha256: undefined,
      latestBuildId: 0,
      attempts: 0,
      completed: false,
    });
    expect(run(state, { type: "entered" }).entered).toBe(true);
  });
});

describe("context", () => {
  const input = { source: "" } as CompilationInput;
  const target = { kind: "linked", words: [0] } as const;

  it("becomes ready, unavailable, or mismatched, and retries", () => {
    const initial = initialWorkspaceState(exactMission);

    expect(
      run(initial, {
        type: "context-resolved",
        outcome: { kind: "ready", input, target },
      }).context,
    ).toEqual({ kind: "ready", input, target });
    const unavailable = run(initial, {
      type: "context-resolved",
      outcome: { kind: "unavailable", path: "source/a.h" },
    });
    expect(unavailable.context).toEqual({
      kind: "unavailable",
      path: "source/a.h",
    });
    expect(
      run(initial, {
        type: "context-resolved",
        outcome: { kind: "content-mismatch", path: "source/b.h" },
      }).context,
    ).toEqual({ kind: "content-mismatch", path: "source/b.h" });
    expect(run(unavailable, { type: "context-requested" }).context).toEqual({
      kind: "resolving",
    });
  });

  it("ignores a cancelled resolution", () => {
    const initial = initialWorkspaceState(exactMission);

    expect(
      run(initial, {
        type: "context-resolved",
        outcome: { kind: "cancelled" },
      }),
    ).toBe(initial);
  });
});

describe("source edits", () => {
  it("applies only the hash of the latest source", () => {
    const edited = run(hashed(), { type: "edited", source: "int x;\n" });

    expect(edited.sourceSha256).toBeUndefined();
    expect(
      run(edited, { type: "source-hashed", source: "old", sha256: SOURCE })
        .sourceSha256,
    ).toBeUndefined();
    expect(
      run(edited, { type: "source-hashed", source: "int x;\n", sha256: SOURCE })
        .sourceSha256,
    ).toBe(SOURCE);
  });

  it("keeps state when the source is unchanged", () => {
    const state = hashed();

    expect(run(state, { type: "edited", source: state.source })).toBe(state);
  });
});

describe("builds", () => {
  it("counts attempts and completes an exact mission", () => {
    const state = compileAndResolve(
      hashed(),
      matchedResult(exactMission, request(exactMission, 1, SOURCE)),
    );

    expect(state.attempts).toBe(1);
    expect(state.compiling).toBeUndefined();
    expect(state.completed).toBe(true);
    expect(isStale(state)).toBe(false);
  });

  it("remembers the score of the comparison before the latest one", () => {
    const first = compileAndResolve(
      hashed(),
      matchedResult(exactMission, request(exactMission, 1, SOURCE), false),
    );
    expect(first.previousScore).toBeUndefined();
    const firstScore =
      first.result?.kind === "matched" ? first.result.result.score : -1;
    expect(firstScore).toBeLessThan(1);

    const second = compileAndResolve(
      first,
      matchedResult(exactMission, request(exactMission, 2, SOURCE)),
    );
    expect(second.previousScore).toBe(firstScore);

    const third = compileAndResolve(
      second,
      matchedResult(exactMission, request(exactMission, 3, SOURCE), false),
    );
    expect(third.previousScore).toBe(1);
  });

  it("drops a result for an older request or another mission", () => {
    const started = run(
      hashed(),
      { type: "compile-started", request: request(exactMission, 1, SOURCE) },
      { type: "compile-started", request: request(exactMission, 2, SOURCE) },
    );

    expect(
      run(started, {
        type: "build-resolved",
        result: matchedResult(exactMission, request(exactMission, 1, SOURCE)),
      }),
    ).toBe(started);
    expect(
      run(started, {
        type: "build-resolved",
        result: matchedResult(demoMission, request(demoMission, 2, SOURCE)),
      }),
    ).toBe(started);
  });

  it("ignores a request that is not newer or belongs to another mission", () => {
    const started = run(hashed(), {
      type: "compile-started",
      request: request(exactMission, 2, SOURCE),
    });

    expect(
      run(started, {
        type: "compile-started",
        request: request(exactMission, 2, SOURCE),
      }),
    ).toBe(started);
    expect(
      run(started, {
        type: "compile-started",
        request: request(demoMission, 3, SOURCE),
      }),
    ).toBe(started);
  });

  it("does not complete from a mismatch or a failure", () => {
    const mismatched = compileAndResolve(
      hashed(),
      matchedResult(exactMission, request(exactMission, 1, SOURCE), false),
    );
    const failed = compileAndResolve(hashed(), {
      kind: "build-failed",
      request: request(exactMission, 1, SOURCE),
      outcome: { kind: "compiler-failure", diagnostics: [] },
    });

    expect(mismatched.completed).toBe(false);
    expect(failed.completed).toBe(false);
  });

  it("marks a result stale after an edit, and current again after undoing it", () => {
    const mismatched = compileAndResolve(
      hashed(),
      matchedResult(exactMission, request(exactMission, 1, SOURCE), false),
    );
    const edited = run(
      mismatched,
      { type: "edited", source: "int add_immediate(int a) { return a; }\n" },
      {
        type: "source-hashed",
        source: "int add_immediate(int a) { return a; }\n",
        sha256: "c".repeat(64),
      },
    );

    expect(isStale(mismatched)).toBe(false);
    expect(isStale(edited)).toBe(true);
    expect(
      isStale(
        run(
          edited,
          { type: "edited", source: exactMission.starterSource },
          {
            type: "source-hashed",
            source: exactMission.starterSource,
            sha256: SOURCE,
          },
        ),
      ),
    ).toBe(false);
  });

  it("keeps a completed mission completed after edits and allows review", () => {
    const completed = compileAndResolve(
      hashed(),
      matchedResult(exactMission, request(exactMission, 1, SOURCE)),
    );
    const edited = run(completed, { type: "edited", source: "" });

    expect(edited.completed).toBe(true);
    expect(run(edited, { type: "review-requested" }).reviewing).toBe(true);
    expect(run(hashed(), { type: "review-requested" }).reviewing).toBe(false);
  });

  it("does not complete an exact match on stale source", () => {
    const started = run(
      hashed(),
      { type: "compile-started", request: request(exactMission, 1, SOURCE) },
      { type: "edited", source: "int x;\n" },
      {
        type: "build-resolved",
        result: matchedResult(exactMission, request(exactMission, 1, SOURCE)),
      },
    );

    expect(started.completed).toBe(false);
    expect(isStale(started)).toBe(true);
  });
});

describe("acknowledgement", () => {
  it("completes a demonstration after a current matched build is acknowledged", () => {
    const built = compileAndResolve(
      hashed(demoMission),
      matchedResult(demoMission, request(demoMission, 1, SOURCE), false),
    );

    expect(built.completed).toBe(false);
    const missed = run(built, { type: "evidence-acknowledged", word: 0 });
    expect(missed.evidenceMiss).toEqual({ buildId: 1, word: 0 });
    expect(missed.actions.acknowledgement).toBeUndefined();
    expect(missed.completed).toBe(false);

    const acknowledged = run(missed, {
      type: "evidence-acknowledged",
      word: 1,
    });
    expect(acknowledged.evidenceMiss).toBeUndefined();
    expect(acknowledged.actions.acknowledgement).toEqual({
      missionId: "001",
      buildId: 1,
      word: 1,
    });
    expect(acknowledged.completed).toBe(true);
  });

  it("ignores acknowledgement without a current match, evidence, or the rule", () => {
    const demo = hashed(demoMission);
    const exact = compileAndResolve(
      hashed(),
      matchedResult(exactMission, request(exactMission, 1, SOURCE), false),
    );
    const unprompted = { ...demoMission, evidence: undefined };
    const noEvidence = compileAndResolve(
      hashed(unprompted),
      matchedResult(demoMission, request(demoMission, 1, SOURCE), false),
    );

    for (const state of [demo, exact, noEvidence]) {
      expect(run(state, { type: "evidence-acknowledged", word: 1 })).toBe(
        state,
      );
    }
  });
});

describe("prediction", () => {
  it("records one prediction before the next build and completes after a right one", () => {
    const predicted = run(hashed(predictionMission), {
      type: "prediction-recorded",
      choice: 0,
    });

    expect(predicted.actions.prediction).toEqual({
      missionId: "002",
      choice: 0,
      nextBuildId: 1,
    });
    expect(run(predicted, { type: "prediction-recorded", choice: 1 })).toBe(
      predicted,
    );
    const missing = compileAndResolve(predicted, {
      kind: "function-missing",
      request: request(predictionMission, 1, SOURCE),
      symbol: "argument_zero",
      definedFunctions: [],
    });
    expect(missing.completed).toBe(false);
    const revealed = compileAndResolve(
      missing,
      matchedResult(predictionMission, request(predictionMission, 2, SOURCE)),
    );
    // Choice 0 is wrong, so the reveal asks for a correction first.
    expect(revealed.completed).toBe(false);

    const rightFirst = run(hashed(predictionMission), {
      type: "prediction-recorded",
      choice: 1,
    });
    expect(
      compileAndResolve(
        rightFirst,
        matchedResult(predictionMission, request(predictionMission, 1, SOURCE)),
      ).completed,
    ).toBe(true);
  });

  it("completes a wrong prediction once the revealed answer is chosen", () => {
    const predicted = run(hashed(predictionMission), {
      type: "prediction-recorded",
      choice: 0,
    });
    // Before the reveal there is nothing to correct.
    expect(run(predicted, { type: "prediction-corrected", choice: 1 })).toBe(
      predicted,
    );
    const revealed = compileAndResolve(
      predicted,
      matchedResult(predictionMission, request(predictionMission, 1, SOURCE)),
    );

    const missed = run(revealed, { type: "prediction-corrected", choice: 2 });
    expect(missed.correctionMiss).toBe(2);
    expect(missed.completed).toBe(false);

    const corrected = run(missed, { type: "prediction-corrected", choice: 1 });
    expect(corrected.correctionMiss).toBeUndefined();
    expect(corrected.actions.correction).toEqual({
      missionId: "002",
      choice: 1,
      buildId: 1,
    });
    expect(corrected.completed).toBe(true);
    expect(run(corrected, { type: "prediction-corrected", choice: 1 })).toBe(
      corrected,
    );
  });

  it("rejects a prediction without a prompt or outside its choices", () => {
    const exact = hashed();
    const prediction = hashed(predictionMission);

    expect(run(exact, { type: "prediction-recorded", choice: 0 })).toBe(exact);
    for (const choice of [-1, 4, 0.5]) {
      expect(run(prediction, { type: "prediction-recorded", choice })).toBe(
        prediction,
      );
    }
  });
});

describe("hints, overlays, and layout", () => {
  it("reveals hints in stage order and counts them", () => {
    const once = run(hashed(), { type: "hint-revealed" });
    const all = run(
      once,
      ...exactMission.hints
        .slice(1)
        .map(() => ({ type: "hint-revealed" }) as const),
    );

    expect(hintsUsed(hashed())).toBe(0);
    expect(once.hintStage).toBe(1);
    expect(hintsUsed(once)).toBe(1);
    expect(all.hintStage).toBe(9);
    expect(hintsUsed(all)).toBe(exactMission.hints.length);
    expect(run(all, { type: "hint-revealed" })).toBe(all);
  });

  it("opens overlays and clamps the split", () => {
    const state = hashed();

    expect(
      run(state, { type: "overlay-changed", overlay: "manual" }).overlay,
    ).toBe("manual");
    expect(run(state, { type: "split-resized", split: 0.6 }).split).toBe(0.6);
    expect(run(state, { type: "split-resized", split: 0 }).split).toBe(
      SPLIT_LIMITS.min,
    );
    expect(run(state, { type: "split-resized", split: 1 }).split).toBe(
      SPLIT_LIMITS.max,
    );
  });
});

describe("saved progress and history", () => {
  it("resumes from saved source and the hints already opened", () => {
    const state = initialWorkspaceState(exactMission, {
      source: "int saved;\n",
      hintMaxStage: 2,
      attempts: [],
    });

    expect(state).toMatchObject({
      source: "int saved;\n",
      hintStage: 2,
      completed: false,
      replacement: undefined,
    });
    expect(hintsUsed(state)).toBe(2);
  });

  it("marks saved work as restored until the player acts on it", () => {
    const saved = initialWorkspaceState(exactMission, {
      source: "int saved;\n",
      hintMaxStage: 0,
      attempts: [attempt(), attempt({ id: "second" })],
    });

    expect(saved).toMatchObject({ restored: true, earlierAttempts: 2 });
    expect(initialWorkspaceState(exactMission)).toMatchObject({
      restored: false,
      earlierAttempts: 0,
    });
    expect(
      initialWorkspaceState(exactMission, {
        source: exactMission.starterSource,
        hintMaxStage: 0,
        attempts: [],
      }).restored,
    ).toBe(false);
    expect(
      initialWorkspaceState(exactMission, {
        source: exactMission.starterSource,
        hintMaxStage: 0,
        attempts: [attempt()],
      }),
    ).toMatchObject({ restored: true, earlierAttempts: 1 });

    expect(run(saved, { type: "edited", source: saved.source })).toBe(saved);
    expect(
      run(
        saved,
        { type: "compile-started", request: request(exactMission, 1, SOURCE) },
        { type: "compile-started", request: request(exactMission, 1, SOURCE) },
      ).restored,
    ).toBe(false);
    expect(
      run(saved, {
        type: "compile-started",
        request: request(shippedMission("004"), 1, SOURCE),
      }).restored,
    ).toBe(true);
    for (const action of [
      { type: "edited", source: "int changed;\n" },
      { type: "compile-started", request: request(exactMission, 1, SOURCE) },
      { type: "attempt-restored", source: "int other;\n" },
      { type: "practice-started" },
    ] satisfies WorkspaceAction[]) {
      expect(run(saved, action)).toMatchObject({
        restored: false,
        earlierAttempts: 2,
      });
    }
  });

  it("restores an attempt's source as a new editor revision and stales the result", () => {
    const built = compileAndResolve(
      hashed(),
      matchedResult(exactMission, request(exactMission, 1, SOURCE), false),
    );
    const restored = run(
      built,
      { type: "overlay-changed", overlay: "history" },
      { type: "attempt-restored", source: "int a;\n" },
    );

    expect(restored).toMatchObject({
      overlay: "history",
      source: "int a;\n",
      sourceSha256: undefined,
      replacement: { revision: 1, source: "int a;\n" },
    });
    expect(isStale(restored)).toBe(true);
    expect(
      run(restored, { type: "attempt-restored", source: "int a;\n" }),
    ).toBe(restored);
    expect(
      run(restored, { type: "attempt-restored", source: "int b;\n" })
        .replacement,
    ).toEqual({ revision: 2, source: "int b;\n" });
  });

  it("starts practice from the starter source with no hints, keeping build numbers", () => {
    const completed = run(
      compileAndResolve(
        run(hashed(), { type: "entered" }, { type: "hint-revealed" }),
        matchedResult(exactMission, request(exactMission, 1, SOURCE)),
      ),
      { type: "edited", source: "int changed;\n" },
      { type: "split-resized", split: 0.3 },
    );
    const practice = run(completed, { type: "practice-started" });

    expect(practice).toMatchObject({
      entered: true,
      source: exactMission.starterSource,
      sourceSha256: undefined,
      result: undefined,
      hintStage: 0,
      attempts: 0,
      completed: false,
      completedBuildId: 0,
      reviewing: false,
      split: 0.3,
      latestBuildId: 1,
      replacement: { revision: 1, source: exactMission.starterSource },
    });
    expect(
      compileAndResolve(
        run(practice, {
          type: "source-hashed",
          source: practice.source,
          sha256: SOURCE,
        }),
        matchedResult(exactMission, request(exactMission, 2, SOURCE)),
      ).completedBuildId,
    ).toBe(2);
  });

  it("remembers the build that completed the mission", () => {
    const completed = compileAndResolve(
      hashed(),
      matchedResult(exactMission, request(exactMission, 1, SOURCE)),
    );
    const rebuilt = compileAndResolve(
      completed,
      matchedResult(exactMission, request(exactMission, 2, SOURCE)),
    );

    expect(hashed().completedBuildId).toBe(0);
    expect(completed.completedBuildId).toBe(1);
    expect(rebuilt.completedBuildId).toBe(1);
  });
});
