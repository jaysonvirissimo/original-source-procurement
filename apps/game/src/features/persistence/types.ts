import type { PlayerState } from "./schema";

export interface LoadReport {
  /** Stored records the last load could not read. They stay in storage. */
  readonly skippedRecords: number;
}

/**
 * Player progress in browser storage. Every method rejects with a
 * `SaveDataError`.
 */
export interface PersistenceService {
  load(): Promise<PlayerState>;
  /** Writes `state`. Only what changed since the last successful save is written. */
  save(state: PlayerState): Promise<void>;
  /** The last saved state as an OSP save file. Downloaded game data is never included. */
  export(): Promise<Blob>;
  /** Replaces all progress with a parsed save file, or changes nothing. */
  import(data: unknown): Promise<PlayerState>;
  /** Clears progress and downloaded game data. */
  reset(): Promise<void>;
  lastLoadReport(): LoadReport;
}

/**
 * Content downloaded from upstream, keyed by its SHA-256. It is not player
 * state: it is never exported or imported.
 */
export interface UpstreamCacheStore {
  get(sha256: string): Promise<unknown>;
  put(sha256: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
}

export interface BrowserStorage {
  readonly persistence: PersistenceService;
  readonly upstreamCache: UpstreamCacheStore;
  close(): void;
}
