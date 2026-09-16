import { describe, expect, it } from "vitest";
import {
  attempt,
  attempts,
  missionProgress,
  samplePlayer,
  skillEvidence,
  timestamp,
} from "../persistence/persistence.test-helpers";
import { emptyPlayerState, type PlayerState } from "../persistence/schema";
import {
  missionStatus,
  progressReducer,
  type ProgressEvent,
} from "./progressReducer";

const ref = { id: "003", starterSource: "starter\n" };

function withMission(
  overrides: Parameters<typeof missionProgress>[0] = {},
): PlayerState {
  return {
    ...samplePlayer(),
    missions: { ...samplePlayer().missions, "003": missionProgress(overrides) },
  };
}

function completed(
  completionId: string,
  at: string,
  extra: Partial<Extract<ProgressEvent, { type: "mission-completed" }>> = {},
): ProgressEvent {
  return {
    type: "mission-completed",
    mission: ref,
    completionId,
    at,
    skills: [],
    ...extra,
  };
}

describe("progressReducer", () => {
  it("starts a mission with its starter source, once", () => {
    const started = progressReducer(emptyPlayerState(), {
      type: "mission-started",
      mission: ref,
      at: timestamp(1),
    });

    expect(started.missions["003"]).toEqual({
      missionId: "003",
      source: "starter\n",
      sourceSavedAt: timestamp(1),
      hintMaxStage: 0,
      predictions: [],
      attempts: [],
    });
    expect(
      progressReducer(started, {
        type: "mission-started",
        mission: ref,
        at: timestamp(2),
      }),
    ).toBe(started);
  });

  it("saves source, leaving other missions untouched", () => {
    const state = samplePlayer();
    const saved = progressReducer(state, {
      type: "source-saved",
      mission: ref,
      source: "edited\n",
      at: timestamp(5),
    });

    expect(saved.missions["003"]).toMatchObject({
      source: "edited\n",
      sourceSavedAt: timestamp(5),
    });
    expect(saved.missions["001"]).toBe(state.missions["001"]);
    expect(saved.skills).toBe(state.skills);
    expect(
      progressReducer(saved, {
        type: "source-saved",
        mission: ref,
        source: "edited\n",
        at: timestamp(6),
      }),
    ).toBe(saved);
  });

  it("creates a mission from saved source when it was never started", () => {
    const saved = progressReducer(emptyPlayerState(), {
      type: "source-saved",
      mission: ref,
      source: "typed\n",
      at: timestamp(1),
    });
    expect(saved.missions["003"]?.source).toBe("typed\n");
  });

  it("raises the highest hint stage and never lowers it", () => {
    const state = progressReducer(emptyPlayerState(), {
      type: "hint-stage-saved",
      mission: ref,
      stage: 3,
      at: timestamp(1),
    });
    expect(state.missions["003"]?.hintMaxStage).toBe(3);
    for (const stage of [2, 3]) {
      expect(
        progressReducer(state, {
          type: "hint-stage-saved",
          mission: ref,
          stage,
          at: timestamp(2),
        }),
      ).toBe(state);
    }
  });

  it("starts practice from the starter with no hints, keeping completion", () => {
    const played = progressReducer(
      progressReducer(
        progressReducer(emptyPlayerState(), {
          type: "hint-stage-saved",
          mission: ref,
          stage: 9,
          at: timestamp(1),
        }),
        {
          type: "source-saved",
          mission: ref,
          source: "solved\n",
          at: timestamp(2),
        },
      ),
      {
        type: "mission-completed",
        mission: ref,
        completionId: "c1",
        at: timestamp(3),
        skills: [],
      },
    );
    const practice = progressReducer(played, {
      type: "practice-started",
      mission: ref,
      at: timestamp(4),
    });

    expect(practice.missions["003"]).toMatchObject({
      source: "starter\n",
      sourceSavedAt: timestamp(4),
      hintMaxStage: 0,
      completion: played.missions["003"]?.completion,
    });
    expect(
      progressReducer(practice, {
        type: "practice-started",
        mission: ref,
        at: timestamp(5),
      }),
    ).toBe(practice);
  });

  it("records an attempt once and tracks the best match", () => {
    const first = attempt({ id: "x", createdAt: timestamp(4) });
    const state = progressReducer(emptyPlayerState(), {
      type: "attempt-recorded",
      mission: ref,
      attempt: first,
    });

    expect(state.missions["003"]).toMatchObject({
      source: "starter\n",
      sourceSavedAt: timestamp(4),
      attempts: [first],
      bestMatch: { attemptId: "x" },
    });
    expect(
      progressReducer(state, {
        type: "attempt-recorded",
        mission: ref,
        attempt: first,
      }),
    ).toBe(state);

    const exact = attempt({ id: "y", exact: true, score: 1 });
    const better = progressReducer(state, {
      type: "attempt-recorded",
      mission: ref,
      attempt: exact,
    });
    expect(better.missions["003"]?.attempts).toEqual([first, exact]);
    expect(better.missions["003"]?.bestMatch?.attemptId).toBe("y");
  });

  it("prunes attempts past the limit", () => {
    const full = withMission({ attempts: attempts(51) });
    const pruned = progressReducer(full, {
      type: "attempts-pruned",
      missionId: "003",
    });
    expect(pruned.missions["003"]?.attempts).toHaveLength(50);

    expect(
      progressReducer(pruned, { type: "attempts-pruned", missionId: "003" }),
    ).toBe(pruned);
    expect(
      progressReducer(pruned, { type: "attempts-pruned", missionId: "999" }),
    ).toBe(pruned);
  });

  it("pins and unpins an attempt", () => {
    const state = withMission({ attempts: attempts(2) });
    const pin = (
      from: PlayerState,
      attemptId: string,
      pinned: boolean,
      missionId = "003",
    ) =>
      progressReducer(from, {
        type: "attempt-pinned",
        missionId,
        attemptId,
        pinned,
      });

    const pinned = pin(state, "attempt-1", true);
    expect(pinned.missions["003"]?.attempts.map((a) => a.pinned)).toEqual([
      false,
      true,
    ]);
    expect(pin(pinned, "attempt-1", true)).toBe(pinned);
    expect(pin(pinned, "missing", true)).toBe(pinned);
    expect(pin(pinned, "attempt-1", true, "999")).toBe(pinned);
    expect(
      pin(pinned, "attempt-1", false).missions["003"]?.attempts[1]?.pinned,
    ).toBe(false);
  });

  it("clears history but keeps pinned attempts", () => {
    const state = withMission({
      attempts: [attempt({ id: "keep", pinned: true }), ...attempts(3)],
    });
    const clear = (from: PlayerState, missionId = "003") =>
      progressReducer(from, { type: "history-cleared", missionId });

    const cleared = clear(state);
    expect(cleared.missions["003"]?.attempts.map((a) => a.id)).toEqual([
      "keep",
    ]);
    expect(clear(cleared)).toBe(cleared);
    expect(clear(cleared, "999")).toBe(cleared);
  });

  it("records a completion with its evidence once", () => {
    const evidence = skillEvidence({
      id: "c1:MIPS.ADD.IMMEDIATE",
      completionId: "c1",
      skill: "MIPS.ADD.IMMEDIATE",
      missionId: "003",
    });
    const prediction = {
      id: "c1:prediction",
      completionId: "c1",
      missionId: "003",
      choice: 1,
      correct: true,
      recordedAt: timestamp(7),
    };
    const state = progressReducer(
      emptyPlayerState(),
      completed("c1", timestamp(7), { skills: [evidence], prediction }),
    );

    expect(state.missions["003"]).toMatchObject({
      completion: {
        count: 1,
        firstCompletedAt: timestamp(7),
        lastCompletedAt: timestamp(7),
        lastCompletionId: "c1",
      },
      predictions: [prediction],
    });
    expect(state.skills["MIPS.ADD.IMMEDIATE"]?.evidence).toEqual([evidence]);
    expect(
      progressReducer(
        state,
        completed("c1", timestamp(8), { skills: [evidence], prediction }),
      ),
    ).toBe(state);
  });

  it("counts a replay and keeps the first completion time", () => {
    const first = progressReducer(
      emptyPlayerState(),
      completed("c1", timestamp(7)),
    );
    const again = progressReducer(first, completed("c2", timestamp(20)));

    expect(again.missions["003"]?.completion).toEqual({
      count: 2,
      firstCompletedAt: timestamp(7),
      lastCompletedAt: timestamp(20),
      lastCompletionId: "c2",
    });
    expect(again.missions["003"]?.predictions).toEqual([]);
    expect(again.skills).toBe(first.skills);
  });

  it("does not duplicate evidence it already holds", () => {
    const state = samplePlayer();
    const existing = state.skills["ABI.RETURN"]?.evidence[0];
    if (existing === undefined) {
      throw new Error("The sample player has ABI.RETURN evidence.");
    }
    const next = progressReducer(
      state,
      completed("c9", timestamp(30), {
        mission: { id: "001", starterSource: "" },
        skills: [existing],
      }),
    );
    expect(next.skills).toBe(state.skills);
  });

  it("changes settings, keeping the state object when nothing changed", () => {
    const state = samplePlayer();
    const minimal = progressReducer(state, {
      type: "settings-changed",
      settings: { scaffold: "minimal" },
    });

    expect(minimal.settings).toEqual({ scaffold: "minimal" });
    expect(minimal.missions).toBe(state.missions);
    expect(
      progressReducer(minimal, {
        type: "settings-changed",
        settings: { scaffold: "minimal" },
      }),
    ).toBe(minimal);
  });

  it("changes presentation settings, and keeps state when none differ", () => {
    const audio = {
      music: { volume: 0.5, muted: false },
      sfx: { volume: 0.5, muted: false },
    };
    const state = progressReducer(emptyPlayerState(), {
      type: "settings-changed",
      settings: { graphics: "simple", motion: "reduced", audio },
    });
    expect(state.settings).toEqual({
      graphics: "simple",
      motion: "reduced",
      audio,
    });

    const same = {
      graphics: "simple",
      motion: "reduced",
      audio: { music: { ...audio.music }, sfx: { ...audio.sfx } },
    } as const;
    expect(
      progressReducer(state, { type: "settings-changed", settings: same }),
    ).toBe(state);

    for (const settings of [
      { ...same, graphics: "full" },
      { ...same, motion: "system" },
      { ...same, mapView: "list" },
      {
        ...same,
        audio: { ...same.audio, music: { volume: 0.4, muted: false } },
      },
      {
        ...same,
        audio: { ...same.audio, music: { volume: 0.5, muted: true } },
      },
      { ...same, audio: { ...same.audio, sfx: { volume: 0.4, muted: false } } },
      { ...same, audio: { ...same.audio, sfx: { volume: 0.5, muted: true } } },
      { graphics: "simple", motion: "reduced" },
    ] as const) {
      expect(
        progressReducer(state, { type: "settings-changed", settings }).settings,
      ).toBe(settings);
    }
  });

  it("replaces the whole state", () => {
    const replacement = samplePlayer();
    expect(
      progressReducer(emptyPlayerState(), {
        type: "state-replaced",
        state: replacement,
      }),
    ).toBe(replacement);
  });
});

describe("missionStatus", () => {
  it("distinguishes new, started, and completed missions", () => {
    const player = samplePlayer();
    expect(missionStatus(undefined)).toBe("new");
    expect(missionStatus(player.missions["003"])).toBe("in-progress");
    expect(missionStatus(player.missions["001"])).toBe("complete");
  });
});
