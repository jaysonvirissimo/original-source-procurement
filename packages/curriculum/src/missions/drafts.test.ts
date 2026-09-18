import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { missionDrafts } from "./drafts.ts";

/** A mission file: its id, then a slug. Helpers and registries have no id. */
const MISSION_FILE = /^(\d{3}[A-Z]?)-[a-z0-9-]+\.ts$/;

describe("missionDrafts", () => {
  it("lists every mission file in this directory, under its own id", async () => {
    const files = (await readdir(new URL(".", import.meta.url)))
      .map((name) => MISSION_FILE.exec(name)?.[1])
      .filter((id) => id !== undefined)
      .sort();

    expect(missionDrafts.map((draft) => draft.id).sort()).toEqual(files);
  });
});
