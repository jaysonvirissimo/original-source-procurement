import { playerFromSave, saveFileBlob, saveFileFrom } from "./saveFile";
import { emptyPlayerState, type PlayerState } from "./schema";
import type { BrowserStorage } from "./types";

/** What memory storage holds; share one between opens to model a reload. */
export interface MemoryBacking {
  player: PlayerState;
  readonly cache: Map<string, unknown>;
}

export function memoryBacking(player = emptyPlayerState()): MemoryBacking {
  return { player, cache: new Map() };
}

export interface MemoryStorageOptions {
  readonly backing?: MemoryBacking;
  readonly now?: () => string;
}

/**
 * Storage that lasts as long as the page. Used when the browser refuses
 * storage and the player chooses to play without saving.
 */
export function createMemoryStorage(
  options: MemoryStorageOptions = {},
): BrowserStorage {
  const backing = options.backing ?? memoryBacking();
  const now = options.now ?? (() => new Date().toISOString());

  return {
    persistence: {
      load: () => Promise.resolve(backing.player),
      save: (state) => {
        backing.player = state;
        return Promise.resolve();
      },
      export: () =>
        Promise.resolve(saveFileBlob(saveFileFrom(backing.player, now()))),
      // An invalid save throws inside the executor, which rejects.
      import: (data) =>
        new Promise((resolve) => {
          const player = playerFromSave(data);
          backing.player = player;
          resolve(player);
        }),
      reset: () => {
        backing.player = emptyPlayerState();
        backing.cache.clear();
        return Promise.resolve();
      },
      lastLoadReport: () => ({ skippedRecords: 0 }),
    },
    upstreamCache: {
      get: (sha256) => Promise.resolve(backing.cache.get(sha256)),
      put: (sha256, value) => {
        backing.cache.set(sha256, value);
        return Promise.resolve();
      },
      clear: () => {
        backing.cache.clear();
        return Promise.resolve();
      },
    },
    close: () => undefined,
  };
}
