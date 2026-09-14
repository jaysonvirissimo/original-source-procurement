import { describe, expect, it } from "vitest";
import { PointerCorpusSchema } from "./corpus.ts";
import {
  issuesOf,
  PLACEHOLDER_COMMIT,
  realMission,
  syntheticMission,
} from "./testing.ts";

const corpus = {
  schemaVersion: 1,
  importerVersion: "0.0.0",
  upstreamCommit: PLACEHOLDER_COMMIT,
  sdkCommit: "2".repeat(40),
  missions: [
    realMission(),
    realMission({ id: "sample-live", kind: "live", hints: [] }),
  ],
};

describe("PointerCorpusSchema", () => {
  it("round-trips a corpus of real missions", () => {
    expect(
      PointerCorpusSchema.parse(JSON.parse(JSON.stringify(corpus))),
    ).toEqual(corpus);
  });

  it("rejects a synthetic mission", () => {
    expect(
      issuesOf(PointerCorpusSchema, {
        ...corpus,
        missions: [syntheticMission()],
      }),
    ).toEqual([
      {
        path: "missions.0.kind",
        message: "The pointer corpus holds only real missions.",
      },
    ]);
  });

  it("rejects an unknown schema version", () => {
    expect(
      PointerCorpusSchema.safeParse({ ...corpus, schemaVersion: 2 }).success,
    ).toBe(false);
  });
});
