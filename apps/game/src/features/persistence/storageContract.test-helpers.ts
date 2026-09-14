import { beforeEach, describe, expect, it } from "vitest";
import { progressReducer } from "../progress/progressReducer";
import { SaveDataError } from "./errors";
import { attempts, samplePlayer, timestamp } from "./persistence.test-helpers";
import { emptyPlayerState } from "./schema";
import type { BrowserStorage } from "./types";

export interface StorageHarness {
  /** Opens storage over the same backing each time, as a reload would. */
  readonly open: () => Promise<BrowserStorage>;
}

const CACHE_MARKER = "osp-authored cache marker";
const ref = { id: "003", starterSource: "starter\n" };

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

/** Behavior every storage implementation shares. */
export function describeStorageContract(
  name: string,
  harness: () => StorageHarness,
): void {
  describe(`${name} storage contract`, () => {
    let open: () => Promise<BrowserStorage>;

    beforeEach(() => {
      ({ open } = harness());
    });

    async function reloaded() {
      const storage = await open();
      return storage.persistence.load();
    }

    it("loads an empty state on first run", async () => {
      const storage = await open();

      expect(await storage.persistence.load()).toEqual(emptyPlayerState());
      expect(storage.persistence.lastLoadReport()).toEqual({
        skippedRecords: 0,
      });
    });

    it("loads what it saved, with source exactly as typed", async () => {
      const storage = await open();
      await storage.persistence.load();
      await storage.persistence.save(samplePlayer());

      const loaded = await reloaded();
      expect(loaded).toEqual(samplePlayer());
      expect(loaded.missions["001"]?.source).toContain("\r\n\t");
    });

    it("keeps up with a sequence of changes", async () => {
      const storage = await open();
      let state = await storage.persistence.load();
      const apply = async (next: typeof state) => {
        state = next;
        await storage.persistence.save(state);
      };

      await apply(
        progressReducer(state, {
          type: "mission-started",
          mission: ref,
          at: timestamp(0),
        }),
      );
      for (const recorded of attempts(52)) {
        state = progressReducer(state, {
          type: "attempt-recorded",
          mission: ref,
          attempt: recorded,
        });
      }
      await apply(state);
      await apply(
        progressReducer(state, {
          type: "attempt-pinned",
          missionId: "003",
          attemptId: "attempt-0",
          pinned: true,
        }),
      );
      await apply(
        progressReducer(state, { type: "attempts-pruned", missionId: "003" }),
      );
      await apply(
        progressReducer(state, {
          type: "source-saved",
          mission: ref,
          source: "edited\n",
          at: timestamp(60),
        }),
      );

      const loaded = await reloaded();
      expect(loaded).toEqual(state);
      expect(loaded.missions["003"]?.attempts).toHaveLength(51);
      expect(loaded.missions["003"]?.attempts[0]).toMatchObject({
        id: "attempt-0",
        pinned: true,
      });

      await apply(
        progressReducer(state, { type: "history-cleared", missionId: "003" }),
      );
      expect((await reloaded()).missions["003"]?.attempts).toHaveLength(1);
    });

    it("restores an exported save after a reset", async () => {
      const storage = await open();
      await storage.persistence.load();
      await storage.persistence.save(samplePlayer());

      const text = await (await storage.persistence.export()).text();
      await storage.persistence.reset();
      expect(await reloaded()).toEqual(emptyPlayerState());

      const imported = await storage.persistence.import(JSON.parse(text));
      expect(imported).toEqual(samplePlayer());
      expect(await reloaded()).toEqual(samplePlayer());
      expect(text).toContain(
        JSON.stringify(samplePlayer().missions["001"]?.source),
      );
    });

    it("keeps the current save when an import is invalid", async () => {
      const storage = await open();
      await storage.persistence.load();
      await storage.persistence.save(samplePlayer());

      const notSave = await rejection(
        storage.persistence.import({ format: "other" }),
      );
      const damaged = await rejection(
        storage.persistence.import({
          format: "osp-save",
          schemaVersion: 1,
          exportedAt: timestamp(0),
          player: { ...emptyPlayerState(), missions: { "003": {} } },
        }),
      );

      expect(notSave).toBeInstanceOf(SaveDataError);
      expect(notSave).toMatchObject({ kind: "import-not-save" });
      expect(damaged).toMatchObject({ kind: "import-damaged" });
      expect(await reloaded()).toEqual(samplePlayer());
    });

    it("never exports downloaded game data, and reset clears it", async () => {
      const storage = await open();
      await storage.persistence.load();
      await storage.persistence.save(samplePlayer());
      await storage.upstreamCache.put("a".repeat(64), CACHE_MARKER);

      expect(await storage.upstreamCache.get("a".repeat(64))).toBe(
        CACHE_MARKER,
      );
      const text = await (await storage.persistence.export()).text();
      expect(text).not.toContain(CACHE_MARKER);

      await storage.upstreamCache.clear();
      expect(await storage.upstreamCache.get("a".repeat(64))).toBeUndefined();
      expect(await reloaded()).toEqual(samplePlayer());

      await storage.upstreamCache.put("b".repeat(64), CACHE_MARKER);
      await storage.persistence.reset();
      expect(await storage.upstreamCache.get("b".repeat(64))).toBeUndefined();
    });
  });
}
