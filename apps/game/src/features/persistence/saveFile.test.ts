import { describe, expect, it } from "vitest";
import { SaveDataError } from "./errors";
import type { Migration } from "./migrations";
import { attempt, samplePlayer, timestamp } from "./persistence.test-helpers";
import {
  MAX_SAVE_BYTES,
  playerFromSave,
  readSaveFile,
  SAVE_FORMAT,
  saveFileBlob,
  saveFileFrom,
  type SaveFile,
} from "./saveFile";

const exportedAt = timestamp(100);

function exported(): SaveFile {
  return JSON.parse(
    JSON.stringify(saveFileFrom(samplePlayer(), exportedAt)),
  ) as SaveFile;
}

function thrownKind(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof SaveDataError ? error.kind : "other";
  }
  return undefined;
}

function thrownMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "";
}

describe("saveFileFrom", () => {
  it("wraps player state and lists attempts oldest first", () => {
    const player = samplePlayer();
    const mission = player.missions["003"];
    if (mission === undefined) {
      throw new Error("The sample player has progress on 003.");
    }
    const newestFirst = {
      ...player,
      missions: {
        ...player.missions,
        "003": { ...mission, attempts: mission.attempts.toReversed() },
      },
    };

    const file = saveFileFrom(newestFirst, exportedAt);

    expect(file).toMatchObject({
      format: SAVE_FORMAT,
      schemaVersion: 1,
      exportedAt,
    });
    expect(file.player.missions["003"]?.attempts.map((a) => a.id)).toEqual([
      "a",
      "b",
    ]);
    expect(newestFirst.missions["003"].attempts.map((a) => a.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("orders attempts made in the same second by position", () => {
    const player = samplePlayer();
    const mission = player.missions["003"];
    if (mission === undefined) {
      throw new Error("The sample player has progress on 003.");
    }
    const sameTime = [
      attempt({ id: "first", createdAt: timestamp(5) }),
      attempt({ id: "second", createdAt: timestamp(5) }),
      attempt({ id: "earlier", createdAt: timestamp(4) }),
    ];
    const file = saveFileFrom(
      { ...player, missions: { "003": { ...mission, attempts: sameTime } } },
      exportedAt,
    );
    expect(file.player.missions["003"]?.attempts.map((a) => a.id)).toEqual([
      "earlier",
      "first",
      "second",
    ]);
  });
});

describe("saveFileBlob", () => {
  it("writes JSON that reads back as the same save", async () => {
    const file = saveFileFrom(samplePlayer(), exportedAt);
    const blob = saveFileBlob(file);

    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual(file);
  });
});

describe("readSaveFile", () => {
  it("parses JSON", async () => {
    expect(await readSaveFile(new Blob(['{"format":"osp-save"}']))).toEqual({
      format: "osp-save",
    });
  });

  it("rejects text that is not JSON", async () => {
    const error: unknown = await readSaveFile(new Blob(["not json"])).catch(
      (thrown: unknown) => thrown,
    );
    expect(error).toMatchObject({ kind: "import-not-json" });
  });

  it("rejects a file too large to be a save, without reading it", async () => {
    const huge = {
      size: MAX_SAVE_BYTES + 1,
      text: () => Promise.reject(new Error("read")),
    } as unknown as Blob;
    const error: unknown = await readSaveFile(huge).catch(
      (thrown: unknown) => thrown,
    );
    expect(error).toMatchObject({ kind: "import-too-large" });
  });
});

describe("playerFromSave", () => {
  it("returns the player state of a valid save, source unchanged", () => {
    const player = playerFromSave(exported());

    expect(player).toEqual(samplePlayer());
    expect(player.missions["001"]?.source).toBe(
      "int return_path(void) { return 0; }\r\n\t// kept as typed\n",
    );
  });

  it("rejects anything that is not an OSP save", () => {
    for (const data of [null, "save", 1, {}, { format: "other" }]) {
      expect(thrownKind(() => playerFromSave(data))).toBe("import-not-save");
    }
  });

  it("rejects a save from a newer version", () => {
    const file = exported();
    const newer = {
      ...file,
      schemaVersion: 2,
      player: { ...file.player, schemaVersion: 2 },
    };
    expect(thrownKind(() => playerFromSave(newer))).toBe("import-too-new");
  });

  it("names the damaged field", () => {
    const file = exported();
    const cases: [unknown, string][] = [
      [{ format: SAVE_FORMAT, schemaVersion: 1 }, "player.schemaVersion"],
      [{ ...file, schemaVersion: 0 }, "schemaVersion"],
      [
        {
          ...file,
          player: {
            ...file.player,
            missions: {
              "003": { ...file.player.missions["003"], source: 7 },
            },
          },
        },
        "player.missions.003.source",
      ],
      [{ ...file, exportedAt: "yesterday" }, "exportedAt"],
      [{ ...file, extra: true }, "the top level"],
    ];
    for (const [data, path] of cases) {
      expect(thrownKind(() => playerFromSave(data))).toBe("import-damaged");
      expect(thrownMessage(() => playerFromSave(data))).toContain(
        `damaged at ${path}.`,
      );
    }
  });

  it("migrates an older save before validating it", () => {
    const file = exported();
    const player: Record<string, unknown> = {
      ...file.player,
      schemaVersion: 0,
    };
    delete player.settings;
    const older = { ...file, schemaVersion: 0, player };
    const addSettings: Migration = {
      from: 0,
      migrate: (state) => ({ ...state, settings: {} }),
    };

    expect(playerFromSave(older, [addSettings])).toEqual(samplePlayer());
  });
});
