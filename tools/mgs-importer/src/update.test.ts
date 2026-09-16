import { realMission, syntheticMission } from "@osp/mission-schema/testing";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "./hash.ts";
import type { ReadUpstream } from "./includes.ts";
import { checkPointers, diffImports, renderUpdateReport } from "./update.ts";
import {
  fileRecord,
  functionRecord,
  importIndex,
  pinnedTarget,
  unpinnedRecord,
  PRE_MATCH_COMMIT,
} from "./testing.ts";

const NEWER = "9".repeat(40);

function after(functions: ReturnType<typeof functionRecord>[]) {
  return importIndex({ upstreamCommit: NEWER, functions });
}

describe("diffImports", () => {
  it("reports nothing when nothing moved", () => {
    const report = diffImports(importIndex(), after([functionRecord()]));
    expect(report.functions).toEqual([]);
    expect(report.fromCommit).toBe(importIndex().upstreamCommit);
    expect(report.toCommit).toBe(NEWER);
  });

  it("reports a function upstream added", () => {
    const report = diffImports(
      importIndex(),
      after([functionRecord(), functionRecord({ symbol: "new_function" })]),
    );
    expect(report.functions).toEqual([
      { symbol: "new_function", kind: "added", detail: "SOLVED" },
    ]);
  });

  it("reports a function upstream removed", () => {
    expect(diffImports(importIndex(), after([])).functions).toEqual([
      { symbol: "sample_function", kind: "removed" },
    ]);
  });

  it("reports a function that upstream has now matched", () => {
    const before = importIndex({
      functions: [
        unpinnedRecord({ reason: "still-unmatched" }, { status: "LIVE" }),
      ],
    });
    expect(diffImports(before, after([functionRecord()])).functions).toEqual([
      {
        symbol: "sample_function",
        kind: "newly-matched",
        detail: "LIVE to SOLVED",
      },
    ]);
  });

  it("reports a function that went back to unmatched", () => {
    const now = after([
      unpinnedRecord({ reason: "still-unmatched" }, { status: "LIVE" }),
    ]);
    expect(diffImports(importIndex(), now).functions).toEqual([
      {
        symbol: "sample_function",
        kind: "status-changed",
        detail: "SOLVED to LIVE",
      },
    ]);
  });

  it("reports a target whose words changed", () => {
    const now = after([
      functionRecord({
        pinned: pinnedTarget({
          target: {
            kind: "remote",
            commit: PRE_MATCH_COMMIT,
            path: "asm/sample/sample_function_80016EF8.s",
            wordCount: 5,
            wordsSha256: "b".repeat(64),
          },
        }),
      }),
    ]);
    expect(diffImports(importIndex(), now).functions).toEqual([
      { symbol: "sample_function", kind: "target-changed" },
    ]);
  });

  it("reports a target that can no longer be pinned, with the reason", () => {
    const now = after([
      unpinnedRecord({ reason: "word-count", detail: "found 2, expected 4" }),
    ]);
    expect(diffImports(importIndex(), now).functions).toEqual([
      { symbol: "sample_function", kind: "target-lost", detail: "word-count" },
    ]);
  });

  it("reports a target lost even when no reason was recorded", () => {
    const now = after([
      {
        symbol: "sample_function",
        address: 0x80016ef8,
        size: 16,
        status: "SOLVED",
      },
    ]);
    expect(diffImports(importIndex(), now).functions).toEqual([
      { symbol: "sample_function", kind: "target-lost" },
    ]);
  });

  it("counts source files that came and went", () => {
    const report = diffImports(
      importIndex(),
      importIndex({
        upstreamCommit: NEWER,
        files: [fileRecord({ path: "source/other/other.c" })],
      }),
    );
    expect(report.sourceFiles).toEqual({ added: 1, removed: 1 });
  });
});

const HEADER = new TextEncoder().encode("#define SAMPLE 1\n");

describe("checkPointers", () => {
  const mission = realMission({
    compiler: {
      ...realMission().compiler,
      remoteHeaders: {
        "psyq/include/sample.h": {
          repository: "FoxdieTeam/psyq_sdk",
          commit: "1".repeat(40),
          path: "psyq_4.4/include/sample.h",
          sha256: sha256Hex(HEADER),
        },
      },
    },
  });
  const corpus = {
    schemaVersion: 1 as const,
    importerVersion: "1.0.0",
    upstreamCommit: "1".repeat(40),
    sdkCommit: "1".repeat(40),
    missions: [mission],
  };

  const resolving: ReadUpstream = (_, path) =>
    Promise.resolve(path.endsWith(".h") ? HEADER : new Uint8Array([1]));

  it("reports nothing while every pointer resolves", async () => {
    expect(await checkPointers(corpus, resolving)).toEqual([]);
  });

  it("reports a file that is gone", async () => {
    const missing: ReadUpstream = (_, path) =>
      Promise.resolve(path.endsWith(".h") ? undefined : new Uint8Array([1]));
    expect(await checkPointers(corpus, missing)).toEqual([
      {
        missionId: mission.id,
        symbol: mission.symbol,
        path: "psyq_4.4/include/sample.h",
        reason: "absent",
      },
    ]);
  });

  it("reports a context header whose bytes changed", async () => {
    const changed: ReadUpstream = (_, path) =>
      Promise.resolve(
        path.endsWith(".h")
          ? new TextEncoder().encode("#define SAMPLE 2\n")
          : new Uint8Array([1]),
      );
    expect((await checkPointers(corpus, changed))[0]?.reason).toBe(
      "content-changed",
    );
  });

  it("checks no target for a mission that carries its own words", async () => {
    // The corpus schema rejects a synthetic mission, but the check is what
    // decides that: it looks only at what a real mission points upstream at.
    const inline = { ...corpus, missions: [syntheticMission()] };
    expect(await checkPointers(inline, resolving)).toEqual([]);
  });

  it("reports a target file that is gone", async () => {
    const missing: ReadUpstream = (_, path) =>
      Promise.resolve(path.endsWith(".s") ? undefined : HEADER);
    expect((await checkPointers(corpus, missing))[0]?.path).toBe(
      "asm/sample/sample_function.s",
    );
  });
});

describe("renderUpdateReport", () => {
  it("says so plainly when nothing changed", () => {
    const text = renderUpdateReport({
      ...diffImports(importIndex(), after([functionRecord()])),
      unresolved: [],
    });
    expect(text).toContain("No change.");
    expect(text).toContain("None.");
  });

  it("groups changes by kind and lists unresolved pointers", () => {
    const text = renderUpdateReport({
      ...diffImports(
        importIndex(),
        after([functionRecord({ symbol: "new_function" })]),
      ),
      unresolved: [
        {
          missionId: "R001",
          symbol: "sample_function",
          path: "asm/sample/sample_function.s",
          reason: "absent",
        },
      ],
    });
    expect(text).toContain("### added (1)");
    expect(text).toContain("### removed (1)");
    expect(text).toContain("R001 (sample_function)");
  });

  it("truncates a long list", () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      functionRecord({ symbol: `f${String(index)}` }),
    );
    const text = renderUpdateReport({
      ...diffImports(importIndex({ functions: many }), after([])),
      unresolved: [],
    });
    expect(text).toContain("and 10 more");
  });
});
