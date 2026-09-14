import { z } from "zod";
import { SaveDataError, saveDataError, storageError } from "./errors";
import { migratePlayerState } from "./migrations";
import { playerFromSave, saveFileBlob, saveFileFrom } from "./saveFile";
import {
  AttemptSchema,
  emptyPlayerState,
  MissionRecordSchema,
  SettingsSchema,
  SkillEvidenceSchema,
  type Attempt,
  type MissionProgress,
  type PlayerState,
  type SkillEvidence,
} from "./schema";
import type {
  BrowserStorage,
  LoadReport,
  PersistenceService,
  UpstreamCacheStore,
} from "./types";

export const DATABASE_NAME = "osp";

/**
 * Tracks the store layout only. Record shapes change through the player
 * state migrations.
 */
export const DATABASE_VERSION = 1;

const META = "meta";
const MISSIONS = "missions";
const ATTEMPTS = "attempts";
const EVIDENCE = "evidence";
const UPSTREAM_CACHE = "upstreamCache";
const PLAYER_STORES = [META, MISSIONS, ATTEMPTS, EVIDENCE];
const PLAYER_KEY = "player";
const SETTINGS_KEY = "settings";

const STORE_LAYOUT: readonly {
  readonly name: string;
  readonly keyPath?: string;
  readonly index?: { readonly name: string; readonly keyPath: string };
}[] = [
  { name: META },
  { name: MISSIONS, keyPath: "missionId" },
  {
    name: ATTEMPTS,
    keyPath: "id",
    index: { name: "byMission", keyPath: "missionId" },
  },
  {
    name: EVIDENCE,
    keyPath: "id",
    index: { name: "bySkill", keyPath: "skill" },
  },
  // Keyed by content hash, outside player state.
  { name: UPSTREAM_CACHE },
];

const MetaSchema = z.strictObject({
  schemaVersion: z.number().int().min(0),
  corpusVersion: z.string(),
});

export interface OpenStorageOptions {
  /** Defaults to the browser's `indexedDB`. */
  readonly factory?: IDBFactory;
  readonly name?: string;
  /** Newer builds raise this; tests open newer versions to exercise upgrades. */
  readonly version?: number;
  readonly now?: () => string;
}

/**
 * Opens OSP's database. Rejects with a `SaveDataError` when the browser
 * refuses storage, another tab blocks an upgrade, or the database is newer
 * than this build.
 */
export async function openBrowserStorage(
  options: OpenStorageOptions = {},
): Promise<BrowserStorage> {
  const factory =
    options.factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (factory === undefined) {
    throw saveDataError("unavailable");
  }
  const db = await openDatabase(
    factory,
    options.name ?? DATABASE_NAME,
    options.version ?? DATABASE_VERSION,
  );
  return createStorage(db, options.now ?? (() => new Date().toISOString()));
}

function openDatabase(
  factory: IDBFactory,
  name: string,
  version: number,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: SaveDataError) => {
      settled = true;
      reject(error);
    };
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name, version);
    } catch (error) {
      fail(storageError(error, "open"));
      return;
    }
    request.onupgradeneeded = () => {
      createStores(request.result);
    };
    request.onblocked = () => {
      fail(saveDataError("blocked"));
    };
    request.onsuccess = () => {
      const db = request.result;
      // The player already saw the blocked state; this late connection is unused.
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      // Let a newer build in another tab upgrade the database.
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    request.onerror = () => {
      fail(storageError(request.error, "open"));
    };
  });
}

function createStores(db: IDBDatabase): void {
  for (const store of STORE_LAYOUT) {
    if (db.objectStoreNames.contains(store.name)) {
      continue;
    }
    const created =
      store.keyPath === undefined
        ? db.createObjectStore(store.name)
        : db.createObjectStore(store.name, { keyPath: store.keyPath });
    if (store.index !== undefined) {
      created.createIndex(store.index.name, store.index.keyPath);
    }
  }
}

/**
 * Runs `work` in one transaction and resolves with its return value once the
 * transaction commits. A failure aborts it, so nothing is half written.
 */
function transaction<T>(
  db: IDBDatabase,
  stores: readonly string[],
  mode: IDBTransactionMode,
  during: "open" | "write",
  work: (tx: IDBTransaction) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction([...stores], mode);
    } catch (error) {
      reject(storageError(error, during));
      return;
    }
    let result: T | undefined;
    tx.oncomplete = () => {
      resolve(result as T);
    };
    tx.onabort = () => {
      reject(storageError(tx.error, during));
    };
    try {
      result = work(tx);
    } catch (error) {
      reject(storageError(error, during));
      tx.abort();
    }
  });
}

function createStorage(db: IDBDatabase, now: () => string): BrowserStorage {
  let lastSaved = emptyPlayerState();
  let metaWritten = false;
  let report: LoadReport = { skippedRecords: 0 };

  const persistence: PersistenceService = {
    async load() {
      const read = await transaction(
        db,
        PLAYER_STORES,
        "readonly",
        "open",
        (tx) => ({
          player: tx.objectStore(META).get(PLAYER_KEY),
          settings: tx.objectStore(META).get(SETTINGS_KEY),
          missions: tx.objectStore(MISSIONS).getAll(),
          attempts: tx.objectStore(ATTEMPTS).getAll(),
          evidence: tx.objectStore(EVIDENCE).getAll(),
        }),
      );
      const loaded = assemble({
        player: read.player.result,
        settings: read.settings.result,
        missions: read.missions.result,
        attempts: read.attempts.result,
        evidence: read.evidence.result,
      });
      lastSaved = loaded.state;
      metaWritten = loaded.metaFound;
      report = { skippedRecords: loaded.skipped };
      return loaded.state;
    },

    async save(next) {
      const last = lastSaved;
      const writeMeta = !metaWritten;
      await transaction(db, PLAYER_STORES, "readwrite", "write", (tx) => {
        writeState(tx, last, next, writeMeta);
      });
      lastSaved = next;
      metaWritten = true;
    },

    export() {
      return Promise.resolve(saveFileBlob(saveFileFrom(lastSaved, now())));
    },

    async import(data) {
      const player = playerFromSave(data);
      await transaction(db, PLAYER_STORES, "readwrite", "write", (tx) => {
        for (const name of PLAYER_STORES) {
          tx.objectStore(name).clear();
        }
        writeState(tx, emptyPlayerState(), player, true);
      });
      lastSaved = player;
      metaWritten = true;
      report = { skippedRecords: 0 };
      return player;
    },

    async reset() {
      await transaction(
        db,
        [...PLAYER_STORES, UPSTREAM_CACHE],
        "readwrite",
        "write",
        (tx) => {
          for (const name of [...PLAYER_STORES, UPSTREAM_CACHE]) {
            tx.objectStore(name).clear();
          }
        },
      );
      lastSaved = emptyPlayerState();
      metaWritten = false;
      report = { skippedRecords: 0 };
    },

    lastLoadReport: () => report,
  };

  const upstreamCache: UpstreamCacheStore = {
    async get(sha256) {
      const request = await transaction(
        db,
        [UPSTREAM_CACHE],
        "readonly",
        "write",
        (tx) => tx.objectStore(UPSTREAM_CACHE).get(sha256),
      );
      return request.result as unknown;
    },
    async put(sha256, value) {
      await transaction(db, [UPSTREAM_CACHE], "readwrite", "write", (tx) => {
        tx.objectStore(UPSTREAM_CACHE).put(value, sha256);
      });
    },
    async clear() {
      await transaction(db, [UPSTREAM_CACHE], "readwrite", "write", (tx) => {
        tx.objectStore(UPSTREAM_CACHE).clear();
      });
    },
  };

  return {
    persistence,
    upstreamCache,
    close: () => {
      db.close();
    },
  };
}

/**
 * Writes what differs between `before` and `after`. Reducers update state
 * immutably, so an unchanged mission or skill is the same object.
 */
function writeState(
  tx: IDBTransaction,
  before: PlayerState,
  after: PlayerState,
  writeMeta: boolean,
): void {
  const meta = tx.objectStore(META);
  if (writeMeta || before.corpusVersion !== after.corpusVersion) {
    meta.put(
      {
        schemaVersion: after.schemaVersion,
        corpusVersion: after.corpusVersion,
      },
      PLAYER_KEY,
    );
  }
  if (writeMeta || before.settings !== after.settings) {
    meta.put(after.settings, SETTINGS_KEY);
  }

  const missions = tx.objectStore(MISSIONS);
  const attempts = tx.objectStore(ATTEMPTS);
  for (const [id, mission] of Object.entries(after.missions)) {
    const previous = before.missions[id];
    if (previous === mission) {
      continue;
    }
    const { attempts: list, ...record } = mission;
    missions.put(record);
    const earlier = new Map(
      (previous?.attempts ?? []).map((attempt) => [attempt.id, attempt]),
    );
    for (const attempt of list) {
      if (earlier.get(attempt.id) !== attempt) {
        attempts.put(attempt);
      }
      earlier.delete(attempt.id);
    }
    for (const removed of earlier.keys()) {
      attempts.delete(removed);
    }
  }
  for (const [id, previous] of Object.entries(before.missions)) {
    if (after.missions[id] === undefined) {
      missions.delete(id);
      for (const attempt of previous.attempts) {
        attempts.delete(attempt.id);
      }
    }
  }

  // Evidence is only ever added.
  const evidence = tx.objectStore(EVIDENCE);
  for (const [skill, progress] of Object.entries(after.skills)) {
    const previous = before.skills[skill];
    if (previous === progress) {
      continue;
    }
    const known = new Set(previous?.evidence.map((event) => event.id));
    for (const event of progress.evidence) {
      if (!known.has(event.id)) {
        evidence.put(event);
      }
    }
  }
}

interface StoredSnapshot {
  readonly player: unknown;
  readonly settings: unknown;
  readonly missions: readonly unknown[];
  readonly attempts: readonly unknown[];
  readonly evidence: readonly unknown[];
}

interface Assembled {
  readonly state: PlayerState;
  readonly metaFound: boolean;
  readonly skipped: number;
}

/**
 * Rebuilds player state from stored records. A record that fails validation
 * is skipped and counted, and stays in storage untouched. Unreadable version
 * information is fatal, because nothing else can be trusted without it.
 */
function assemble(snapshot: StoredSnapshot): Assembled {
  if (snapshot.player === undefined) {
    return { state: emptyPlayerState(), metaFound: false, skipped: 0 };
  }
  const meta = MetaSchema.safeParse(snapshot.player);
  if (!meta.success) {
    throw saveDataError("corrupt");
  }

  let skipped = 0;
  const missions: Record<string, Record<string, unknown>> = {};
  const missionAttempts: Record<string, unknown[]> = {};
  for (const record of snapshot.missions) {
    const id = stringField(record, "missionId");
    if (id === undefined) {
      skipped += 1;
      continue;
    }
    missionAttempts[id] = [];
    missions[id] = { ...(record as object), attempts: missionAttempts[id] };
  }
  for (const record of snapshot.attempts) {
    const id = stringField(record, "missionId");
    const list = id === undefined ? undefined : missionAttempts[id];
    if (list === undefined) {
      skipped += 1;
      continue;
    }
    list.push(record);
  }
  const skills: Record<string, { evidence: unknown[] }> = {};
  for (const record of snapshot.evidence) {
    const skill = stringField(record, "skill");
    if (skill === undefined) {
      skipped += 1;
      continue;
    }
    (skills[skill] ??= { evidence: [] }).evidence.push(record);
  }

  const migrated = migratePlayerState({
    ...meta.data,
    missions,
    skills,
    settings: snapshot.settings ?? {},
  });
  if (migrated.kind === "too-new") {
    throw saveDataError("too-new");
  }
  if (migrated.kind === "unreadable") {
    throw saveDataError("corrupt");
  }
  const raw = migrated.state as {
    corpusVersion: string;
    missions: Record<string, Record<string, unknown>>;
    skills: Record<string, { evidence: unknown[] }>;
    settings: unknown;
  };

  const settings = SettingsSchema.safeParse(raw.settings);
  if (!settings.success) {
    skipped += 1;
  }

  const validMissions: Record<string, MissionProgress> = {};
  for (const [id, { attempts, ...fields }] of Object.entries(raw.missions)) {
    const rawAttempts = attempts as unknown[];
    const record = MissionRecordSchema.safeParse(fields);
    if (!record.success) {
      skipped += 1 + rawAttempts.length;
      continue;
    }
    const valid: Attempt[] = [];
    for (const candidate of rawAttempts) {
      const attempt = AttemptSchema.safeParse(candidate);
      if (attempt.success) {
        valid.push(attempt.data);
      } else {
        skipped += 1;
      }
    }
    validMissions[id] = {
      ...record.data,
      attempts: valid.toSorted((a, b) => compareText(a.createdAt, b.createdAt)),
    };
  }

  const validSkills: Record<string, { evidence: SkillEvidence[] }> = {};
  for (const [skill, progress] of Object.entries(raw.skills)) {
    const valid: SkillEvidence[] = [];
    for (const candidate of progress.evidence) {
      const event = SkillEvidenceSchema.safeParse(candidate);
      if (event.success) {
        valid.push(event.data);
      } else {
        skipped += 1;
      }
    }
    if (valid.length > 0) {
      validSkills[skill] = {
        evidence: valid.toSorted((a, b) =>
          compareText(a.completedAt, b.completedAt),
        ),
      };
    }
  }

  return {
    state: {
      ...emptyPlayerState(),
      corpusVersion: raw.corpusVersion,
      missions: validMissions,
      skills: validSkills,
      settings: settings.success ? settings.data : {},
    },
    metaFound: true,
    skipped,
  };
}

/** Stores with a key path hold only objects, so every record has fields. */
function stringField(record: unknown, field: string): string | undefined {
  const value = (record as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
