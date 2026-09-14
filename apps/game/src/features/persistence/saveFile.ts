import { z } from "zod";
import { saveDataError } from "./errors";
import { MIGRATIONS, migratePlayerState, type Migration } from "./migrations";
import {
  PLAYER_SCHEMA_VERSION,
  PlayerStateSchema,
  type PlayerState,
} from "./schema";

export const SAVE_FORMAT = "osp-save";

/** Far above any real save; a larger file is not one. */
export const MAX_SAVE_BYTES = 20 * 1024 * 1024;

export const SaveFileSchema = z.strictObject({
  format: z.literal(SAVE_FORMAT),
  schemaVersion: z.literal(PLAYER_SCHEMA_VERSION),
  exportedAt: z.iso.datetime(),
  player: PlayerStateSchema,
});
export type SaveFile = z.infer<typeof SaveFileSchema>;

/** An exported save. Attempts are listed oldest first. */
export function saveFileFrom(
  player: PlayerState,
  exportedAt: string,
): SaveFile {
  const missions = Object.fromEntries(
    Object.entries(player.missions).map(([id, mission]) => [
      id,
      {
        ...mission,
        attempts: mission.attempts.toSorted((a, b) =>
          compareText(a.createdAt, b.createdAt),
        ),
      },
    ]),
  );
  return {
    format: SAVE_FORMAT,
    schemaVersion: PLAYER_SCHEMA_VERSION,
    exportedAt,
    player: { ...player, missions },
  };
}

export function saveFileBlob(file: SaveFile): Blob {
  return new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
}

/** Reads a file the player chose. Throws a `SaveDataError`. */
export async function readSaveFile(file: Blob): Promise<unknown> {
  if (file.size > MAX_SAVE_BYTES) {
    throw saveDataError("import-too-large");
  }
  const text = await file.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw saveDataError("import-not-json");
  }
}

/**
 * Checks, migrates, and validates an imported save. Throws a
 * `SaveDataError`; nothing is written here.
 */
export function playerFromSave(
  data: unknown,
  registry: readonly Migration[] = MIGRATIONS,
): PlayerState {
  if (
    typeof data !== "object" ||
    data === null ||
    !("format" in data) ||
    data.format !== SAVE_FORMAT
  ) {
    throw saveDataError("import-not-save");
  }
  const envelope = data as Record<string, unknown>;
  const player = envelope.player;
  const migrated = migratePlayerState(player, registry);
  if (migrated.kind === "too-new") {
    throw saveDataError("import-too-new");
  }
  if (migrated.kind === "unreadable") {
    throw saveDataError("import-damaged", "player.schemaVersion");
  }
  if (
    envelope.schemaVersion !== (player as Record<string, unknown>).schemaVersion
  ) {
    throw saveDataError("import-damaged", "schemaVersion");
  }
  const parsed = SaveFileSchema.safeParse({
    ...envelope,
    schemaVersion: migrated.state.schemaVersion,
    player: migrated.state,
  });
  if (!parsed.success) {
    throw saveDataError("import-damaged", issuePath(parsed.error));
  }
  return parsed.data.player;
}

function issuePath(error: z.ZodError): string {
  const [issue] = error.issues;
  /* v8 ignore next 3 -- a failed parse always reports at least one issue. */
  if (issue === undefined) {
    return "unknown";
  }
  return issue.path.length === 0 ? "the top level" : issue.path.join(".");
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
