import { PLAYER_SCHEMA_VERSION } from "./schema";

/** Rewrites player state from version `from` to version `from + 1`. */
export interface Migration {
  readonly from: number;
  readonly migrate: (
    state: Readonly<Record<string, unknown>>,
  ) => Record<string, unknown>;
}

/** Every record-shape change since version 1, oldest first. */
export const MIGRATIONS: readonly Migration[] = [];

export type MigrationOutcome =
  | { readonly kind: "migrated"; readonly state: Record<string, unknown> }
  | { readonly kind: "too-new"; readonly version: number }
  /** Not an object, no usable version, or no migration from its version. */
  | { readonly kind: "unreadable" };

/**
 * Brings raw player state up to the current version, one step at a time.
 * Validation happens afterwards, against the current schema.
 */
export function migratePlayerState(
  raw: unknown,
  registry: readonly Migration[] = MIGRATIONS,
  current: number = PLAYER_SCHEMA_VERSION,
): MigrationOutcome {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { kind: "unreadable" };
  }
  let state = raw as Record<string, unknown>;
  const stored = state.schemaVersion;
  if (typeof stored !== "number" || !Number.isInteger(stored) || stored < 0) {
    return { kind: "unreadable" };
  }
  if (stored > current) {
    return { kind: "too-new", version: stored };
  }
  for (let version = stored; version < current; version += 1) {
    const from = version;
    const step = registry.find((migration) => migration.from === from);
    if (step === undefined) {
      return { kind: "unreadable" };
    }
    state = { ...step.migrate(state), schemaVersion: from + 1 };
  }
  return { kind: "migrated", state };
}
