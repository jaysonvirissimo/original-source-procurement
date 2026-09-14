import { describe, expect, it } from "vitest";
import { FAKE_TOOLCHAIN_INFO } from "../../test/fakeToolchain";
import {
  attempt,
  attempts,
  timestamp,
} from "../persistence/persistence.test-helpers";
import {
  matchedResult,
  request,
  shippedMission,
} from "../workspace/workspace.test-helpers";
import {
  ATTEMPT_LIMIT,
  attemptFrom,
  betterMatch,
  pruneAttempts,
} from "./attempts";

const addImmediate = shippedMission("003");

function matchOf(exact: boolean) {
  const result = matchedResult(addImmediate, request(addImmediate, 1), exact);
  if (result.kind !== "matched") {
    throw new Error("Expected a matched result.");
  }
  return result.result;
}

describe("attemptFrom", () => {
  it("records the comparison, the built source, and the toolchain", () => {
    const match = matchOf(false);
    const recorded = attemptFrom({
      id: "attempt-1",
      missionId: "003",
      createdAt: timestamp(3),
      source: "int add_immediate(int a) { return a; }\n",
      match,
      info: FAKE_TOOLCHAIN_INFO,
      aspsxVersion: "2.77",
    });

    expect(recorded).toEqual({
      id: "attempt-1",
      missionId: "003",
      createdAt: timestamp(3),
      source: "int add_immediate(int a) { return a; }\n",
      exact: false,
      score: match.score,
      mismatchSummary: {
        exact: false,
        equalWords: match.summary.equalWords,
        targetWords: match.summary.targetWords,
        byKind: match.summary.byKind,
      },
      compilerBuildId: "compiler-build",
      preprocessorBuildId: "preprocessor-build",
      psyqAsmVersion: "0.2.0",
      aspsxVersion: "2.77",
      pinned: false,
    });
    expect(Object.keys(recorded.mismatchSummary.byKind)).not.toHaveLength(0);
  });

  it("records an exact match with no mismatch kinds", () => {
    const recorded = attemptFrom({
      id: "attempt-2",
      missionId: "003",
      createdAt: timestamp(4),
      source: "",
      match: matchOf(true),
      info: FAKE_TOOLCHAIN_INFO,
      aspsxVersion: "2.77",
    });
    expect(recorded.exact).toBe(true);
    expect(recorded.mismatchSummary.byKind).toEqual({});
  });
});

describe("pruneAttempts", () => {
  it("keeps up to the limit unchanged", () => {
    const kept = attempts(ATTEMPT_LIMIT);
    expect(pruneAttempts(kept)).toBe(kept);
  });

  it("drops the oldest unpinned attempts past the limit", () => {
    const pruned = pruneAttempts(attempts(ATTEMPT_LIMIT + 1));
    expect(pruned).toHaveLength(ATTEMPT_LIMIT);
    expect(pruned.some((a) => a.id === "attempt-0")).toBe(false);
  });

  it("does not count pinned attempts toward the limit", () => {
    const list = [
      ...attempts(ATTEMPT_LIMIT),
      ...[1, 2, 3].map((n) =>
        attempt({
          id: `pinned-${String(n)}`,
          createdAt: timestamp(-n),
          pinned: true,
        }),
      ),
    ];
    expect(pruneAttempts(list)).toBe(list);
  });

  it("keeps a pinned attempt older than every other", () => {
    const list = attempts(ATTEMPT_LIMIT + 2).map((a) =>
      a.id === "attempt-0" ? { ...a, pinned: true } : a,
    );
    const pruned = pruneAttempts(list);

    expect(pruned).toHaveLength(ATTEMPT_LIMIT + 1);
    expect(pruned[0]?.id).toBe("attempt-0");
    expect(pruned.some((a) => a.id === "attempt-1")).toBe(false);
  });

  it("drops the earlier-listed of two attempts made at the same time", () => {
    const list = [
      attempt({ id: "first", createdAt: timestamp(1) }),
      attempt({ id: "second", createdAt: timestamp(1) }),
      attempt({ id: "later", createdAt: timestamp(2) }),
    ];
    expect(pruneAttempts(list, 2).map((a) => a.id)).toEqual([
      "second",
      "later",
    ]);
  });

  it("decides age by time, not by position", () => {
    const pruned = pruneAttempts(attempts(4).toReversed(), 3);
    expect(pruned.map((a) => a.id)).toEqual([
      "attempt-3",
      "attempt-2",
      "attempt-1",
    ]);
  });
});

describe("betterMatch", () => {
  const inexact = (id: string, score: number) =>
    attempt({ id, score, exact: false });
  const exact = (id: string) => attempt({ id, score: 1, exact: true });

  it("starts from the first attempt", () => {
    expect(betterMatch(undefined, inexact("a", 0.5))).toEqual({
      attemptId: "a",
      exact: false,
      score: 0.5,
      equalWords: 1,
      targetWords: 2,
    });
  });

  it("prefers an exact match, then a higher score, and keeps ties", () => {
    const low = betterMatch(undefined, inexact("low", 0.25));
    const high = betterMatch(low, inexact("high", 0.75));
    expect(high.attemptId).toBe("high");
    expect(betterMatch(high, inexact("lower", 0.5))).toBe(high);
    expect(betterMatch(high, inexact("tie", 0.75))).toBe(high);

    const first = betterMatch(high, exact("first"));
    expect(first.attemptId).toBe("first");
    expect(betterMatch(first, exact("second"))).toBe(first);
  });
});
