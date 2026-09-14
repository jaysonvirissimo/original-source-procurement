import type { ReactElement, ReactNode } from "react";
import {
  createMemoryStorage,
  memoryBacking,
  type MemoryBacking,
} from "../features/persistence/memoryPersistence";
import { PersistenceProvider } from "../features/persistence/PersistenceProvider";
import {
  emptyPlayerState,
  type PlayerState,
} from "../features/persistence/schema";
import type { BrowserStorage } from "../features/persistence/types";
import { CaptureDispatch, type ProgressDispatch } from "./CaptureDispatch";

export interface MemoryProgress {
  readonly backing: MemoryBacking;
  readonly storage: BrowserStorage;
  readonly openStorage: () => Promise<BrowserStorage>;
  /** Timestamps one second apart, from a fixed start. */
  readonly now: () => string;
  readonly newId: () => string;
  /** Wraps `children` in a provider over this storage. */
  readonly wrap: (children: ReactNode) => ReactElement;
  /** Sends a progress event to the mounted provider. Wrap calls in `act`. */
  readonly dispatch: ProgressDispatch;
}

/** Memory-backed progress with a predictable clock and IDs. */
export function memoryProgress(
  player: PlayerState = emptyPlayerState(),
): MemoryProgress {
  const backing = memoryBacking(player);
  let seconds = 0;
  let ids = 0;
  let mounted: ProgressDispatch | undefined;
  const now = () =>
    new Date(Date.UTC(2026, 8, 13, 12, 0, (seconds += 1))).toISOString();
  const newId = () => `id-${String((ids += 1))}`;
  const storage = createMemoryStorage({ backing, now });
  const openStorage = () => Promise.resolve(storage);
  return {
    backing,
    storage,
    openStorage,
    now,
    newId,
    wrap: (children) => (
      <PersistenceProvider openStorage={openStorage} now={now} newId={newId}>
        <CaptureDispatch
          onDispatch={(dispatch) => {
            mounted = dispatch;
          }}
        />
        {children}
      </PersistenceProvider>
    ),
    dispatch: (event) => {
      if (mounted === undefined) {
        throw new Error("No progress provider has loaded.");
      }
      mounted(event);
    },
  };
}
