import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { progressReducer } from "../progress/progressReducer";
import { DATABASE_NAME, openBrowserStorage } from "./indexedDbPersistence";
import {
  attempt,
  samplePlayer,
  skillEvidence,
  timestamp,
} from "./persistence.test-helpers";
import { describeStorageContract } from "./storageContract.test-helpers";
import type { BrowserStorage } from "./types";

const now = () => timestamp(100);

describeStorageContract("IndexedDB", () => {
  const factory = new IDBFactory();
  return { open: () => openBrowserStorage({ factory, now }) };
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A connection that ignores version changes, as an old tab might. */
function rawOpen(factory: IDBFactory, version = 1): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, version);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onblocked = () => {
      reject(new Error("blocked"));
    };
    request.onerror = () => {
      reject(request.error ?? new Error("open failed"));
    };
  });
}

function rawWrite(
  db: IDBDatabase,
  store: string,
  entries: readonly (readonly [unknown, IDBValidKey?])[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    for (const [value, key] of entries) {
      if (key === undefined) {
        tx.objectStore(store).put(value);
      } else {
        tx.objectStore(store).put(value, key);
      }
    }
    tx.oncomplete = () => {
      resolve();
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error("aborted"));
    };
  });
}

function rawCount(db: IDBDatabase, store: string): Promise<number> {
  return new Promise((resolve) => {
    const request = db.transaction(store).objectStore(store).count();
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

async function savedStorage(factory: IDBFactory): Promise<{
  storage: BrowserStorage;
  saved: ReturnType<typeof samplePlayer>;
}> {
  const storage = await openBrowserStorage({ factory, now });
  await storage.persistence.load();
  const saved = samplePlayer();
  await storage.persistence.save(saved);
  return { storage, saved };
}

function watchPuts() {
  const put = vi.spyOn(IDBObjectStore.prototype, "put");
  return () => put.mock.contexts.map((store) => (store as IDBObjectStore).name);
}

describe("openBrowserStorage", () => {
  it("reports storage as unavailable when the browser has none", async () => {
    // jsdom provides no indexedDB.
    expect(await rejection(openBrowserStorage())).toMatchObject({
      kind: "unavailable",
    });
  });

  it("reports storage as unavailable when the browser refuses it", async () => {
    const refusing = {
      open: () => {
        throw new DOMException("denied", "SecurityError");
      },
    } as unknown as IDBFactory;

    expect(
      await rejection(openBrowserStorage({ factory: refusing })),
    ).toMatchObject({ kind: "unavailable" });
  });

  it("refuses a database written by a newer build", async () => {
    const factory = new IDBFactory();
    (await rawOpen(factory, 3)).close();

    expect(await rejection(openBrowserStorage({ factory }))).toMatchObject({
      kind: "too-new",
    });
  });

  it("reports a blocked upgrade and closes the connection that arrives later", async () => {
    const factory = new IDBFactory();
    const oldTab = await rawOpen(factory);

    expect(
      await rejection(openBrowserStorage({ factory, version: 2 })),
    ).toMatchObject({ kind: "blocked" });

    oldTab.close();
    // Blocked again if the late version 2 connection had stayed open.
    const newer = await rawOpen(factory, 3);
    newer.close();
  });

  it("upgrades an existing database without losing progress", async () => {
    const factory = new IDBFactory();
    const { storage } = await savedStorage(factory);
    storage.close();

    const upgraded = await openBrowserStorage({ factory, version: 2 });
    expect(await upgraded.persistence.load()).toEqual(samplePlayer());
  });

  it("closes itself so a newer build in another tab can upgrade", async () => {
    const factory = new IDBFactory();
    const { storage, saved } = await savedStorage(factory);

    const newer = await rawOpen(factory, 2);
    newer.close();

    expect(
      await rejection(storage.persistence.save({ ...saved, settings: {} })),
    ).toMatchObject({ kind: "write-failed" });
    expect(await rejection(storage.persistence.load())).toMatchObject({
      kind: "unavailable",
    });
  });
});

describe("IndexedDB persistence", () => {
  it("writes only the records that changed", async () => {
    const factory = new IDBFactory();
    const { storage, saved } = await savedStorage(factory);
    const puts = watchPuts();

    const edited = progressReducer(saved, {
      type: "source-saved",
      mission: { id: "001", starterSource: "" },
      source: "edited\n",
      at: timestamp(50),
    });
    await storage.persistence.save(edited);
    expect(puts()).toEqual(["missions"]);

    const pinned = progressReducer(edited, {
      type: "attempt-pinned",
      missionId: "003",
      attemptId: "a",
      pinned: true,
    });
    await storage.persistence.save(pinned);
    expect(puts()).toEqual(["missions", "missions", "attempts"]);

    const completed = progressReducer(pinned, {
      type: "mission-completed",
      mission: { id: "002", starterSource: "" },
      completionId: "c2",
      at: timestamp(60),
      skills: [
        skillEvidence({
          id: "c2:ABI.RETURN",
          completionId: "c2",
          missionId: "002",
          completedAt: timestamp(60),
        }),
        skillEvidence({
          id: "c2:ABI.ARGUMENTS",
          completionId: "c2",
          skill: "ABI.ARGUMENTS",
          missionId: "002",
          completedAt: timestamp(60),
        }),
      ],
    });
    await storage.persistence.save(completed);
    expect(puts().slice(3)).toEqual(["missions", "evidence", "evidence"]);

    await storage.persistence.save({
      ...completed,
      corpusVersion: "next",
      settings: {},
    });
    expect(puts().slice(6)).toEqual(["meta", "meta"]);

    expect(
      await (await openBrowserStorage({ factory })).persistence.load(),
    ).toEqual({
      ...completed,
      corpusVersion: "next",
    });
  });

  it("saves and reloads the scaffold setting", async () => {
    const factory = new IDBFactory();
    const { storage, saved } = await savedStorage(factory);
    await storage.persistence.save({
      ...saved,
      settings: { scaffold: "minimal" },
    });

    const reopened = await openBrowserStorage({ factory });
    expect((await reopened.persistence.load()).settings).toEqual({
      scaffold: "minimal",
    });
  });

  it("deletes a mission and its attempts once they leave the state", async () => {
    const factory = new IDBFactory();
    const { storage, saved } = await savedStorage(factory);
    const rest = Object.fromEntries(
      Object.entries(saved.missions).filter(([id]) => id !== "003"),
    );

    await storage.persistence.save({ ...saved, missions: rest });

    const db = await rawOpen(factory);
    expect(await rawCount(db, "missions")).toBe(1);
    expect(await rawCount(db, "attempts")).toBe(0);
    db.close();
  });

  it("keeps the last good save when storage is full, then retries the change", async () => {
    const factory = new IDBFactory();
    const { storage, saved } = await savedStorage(factory);
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const edited = progressReducer(saved, {
      type: "attempt-recorded",
      mission: { id: "003", starterSource: "" },
      attempt: attempt({ id: "c", createdAt: timestamp(3) }),
    });

    expect(await rejection(storage.persistence.save(edited))).toMatchObject({
      kind: "quota",
    });
    const reopened = await openBrowserStorage({ factory });
    expect(await reopened.persistence.load()).toEqual(saved);

    await storage.persistence.save(edited);
    expect(await reopened.persistence.load()).toEqual(edited);
  });

  it("reports a transaction that aborts after its writes", async () => {
    const factory = new IDBFactory();
    const { storage, saved } = await savedStorage(factory);
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(function (
      this: IDBObjectStore,
    ) {
      const tx = this.transaction;
      queueMicrotask(() => {
        tx.abort();
      });
      return {} as IDBRequest<IDBValidKey>;
    });

    const error = await rejection(
      storage.persistence.save({ ...saved, settings: {} }),
    );
    expect(error).toMatchObject({ kind: "write-failed" });
    expect((error as Error).message).toContain("(UnknownError)");
  });

  it("leaves the previous save in place when an import fails part way", async () => {
    const factory = new IDBFactory();
    const { storage, saved } = await savedStorage(factory);
    const text = await (await storage.persistence.export()).text();
    const data: unknown = JSON.parse(text);
    await storage.persistence.save(
      progressReducer(saved, {
        type: "source-saved",
        mission: { id: "003", starterSource: "" },
        source: "newer\n",
        at: timestamp(70),
      }),
    );
    vi.spyOn(IDBObjectStore.prototype, "put")
      .mockImplementationOnce(function (this: IDBObjectStore) {
        return {} as IDBRequest<IDBValidKey>;
      })
      .mockImplementationOnce(() => {
        throw new DOMException("bad", "DataError");
      });

    expect(await rejection(storage.persistence.import(data))).toMatchObject({
      kind: "write-failed",
    });
    const loaded = await (
      await openBrowserStorage({ factory })
    ).persistence.load();
    expect(loaded.missions["003"]?.source).toBe("newer\n");
  });

  it("skips, counts, and keeps records it cannot read", async () => {
    const factory = new IDBFactory();
    const { storage } = await savedStorage(factory);
    storage.close();
    const db = await rawOpen(factory);
    await rawWrite(db, "missions", [
      [{ missionId: "004", source: 5 }],
      [{ missionId: 42, source: "" }],
    ]);
    await rawWrite(db, "attempts", [
      [attempt({ id: "belongs-to-bad-mission", missionId: "004" })],
      [{ id: "bad", missionId: "003" }],
      [attempt({ id: "no-mission", missionId: "777" })],
      [{ id: "no-mission-id" }],
    ]);
    await rawWrite(db, "evidence", [
      [{ id: "bad-evidence", skill: "ABI.RETURN" }],
      [{ id: "no-skill" }],
      [{ id: "only-bad", skill: "MIPS.LOAD.WORD" }],
    ]);
    await rawWrite(db, "meta", [[{ theme: "dark" }, "settings"]]);

    const reopened = await openBrowserStorage({ factory });
    expect(await reopened.persistence.load()).toEqual(samplePlayer());
    expect(reopened.persistence.lastLoadReport()).toEqual({
      skippedRecords: 10,
    });

    await reopened.persistence.save(samplePlayer());
    expect(await rawCount(db, "missions")).toBe(4);
    expect(await rawCount(db, "attempts")).toBe(6);
    expect(await rawCount(db, "evidence")).toBe(4);
    db.close();
  });

  it("refuses to load a save whose version record is unreadable", async () => {
    const cases: [unknown, string][] = [
      ["garbage", "corrupt"],
      [{ schemaVersion: 9, corpusVersion: "training" }, "too-new"],
      [{ schemaVersion: 0, corpusVersion: "training" }, "corrupt"],
    ];
    for (const [player, kind] of cases) {
      const factory = new IDBFactory();
      (await openBrowserStorage({ factory })).close();
      const db = await rawOpen(factory);
      await rawWrite(db, "meta", [[player, "player"]]);
      db.close();

      const storage = await openBrowserStorage({ factory });
      expect(await rejection(storage.persistence.load())).toMatchObject({
        kind,
      });
    }
  });

  it("loads attempts oldest first, and attempts made at the same time by ID", async () => {
    const factory = new IDBFactory();
    const storage = await openBrowserStorage({ factory });
    await storage.persistence.load();
    const player = samplePlayer();
    const mission = player.missions["003"];
    if (mission === undefined) {
      throw new Error("The sample player has progress on 003.");
    }
    await storage.persistence.save({
      ...player,
      missions: {
        ...player.missions,
        "003": {
          ...mission,
          attempts: [
            attempt({ id: "z-late", createdAt: timestamp(9) }),
            attempt({ id: "m-same", createdAt: timestamp(5) }),
            attempt({ id: "k-same", createdAt: timestamp(5) }),
            attempt({ id: "a-early", createdAt: timestamp(1) }),
          ],
        },
      },
    });

    const loaded = await (
      await openBrowserStorage({ factory })
    ).persistence.load();
    expect(loaded.missions["003"]?.attempts.map((a) => a.id)).toEqual([
      "a-early",
      "k-same",
      "m-same",
      "z-late",
    ]);
  });

  it("stamps exports with the clock when no time source is given", async () => {
    const storage = await openBrowserStorage({ factory: new IDBFactory() });
    const before = new Date().toISOString();
    const file = JSON.parse(
      await (await storage.persistence.export()).text(),
    ) as { exportedAt: string };

    expect(file.exportedAt >= before).toBe(true);
  });
});
