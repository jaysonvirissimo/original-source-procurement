import { describe, expect, it } from "vitest";
import { migratePlayerState, type Migration } from "./migrations";

const addSettings: Migration = {
  from: 0,
  migrate: (state) => ({ ...state, settings: {} }),
};
const markRenamed: Migration = {
  from: 1,
  migrate: (state) => ({ ...state, renamed: true }),
};

describe("migratePlayerState", () => {
  it("passes current state through", () => {
    expect(
      migratePlayerState({ schemaVersion: 1, corpusVersion: "x" }),
    ).toEqual({
      kind: "migrated",
      state: { schemaVersion: 1, corpusVersion: "x" },
    });
  });

  it("applies each step in order and records the new version", () => {
    expect(
      migratePlayerState({ schemaVersion: 0 }, [markRenamed, addSettings], 2),
    ).toEqual({
      kind: "migrated",
      state: { schemaVersion: 2, settings: {}, renamed: true },
    });
  });

  it("refuses state from a newer version", () => {
    expect(migratePlayerState({ schemaVersion: 2 })).toEqual({
      kind: "too-new",
      version: 2,
    });
  });

  it("reports state without a usable version as unreadable", () => {
    for (const raw of [
      null,
      [],
      "save",
      {},
      { schemaVersion: "1" },
      { schemaVersion: -1 },
      { schemaVersion: 1.5 },
    ]) {
      expect(migratePlayerState(raw)).toEqual({ kind: "unreadable" });
    }
  });

  it("reports a version with no migration step as unreadable", () => {
    expect(migratePlayerState({ schemaVersion: 0 })).toEqual({
      kind: "unreadable",
    });
  });
});
