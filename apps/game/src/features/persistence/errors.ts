export type SaveDataErrorKind =
  /** The browser refuses storage, as private browsing can. */
  | "unavailable"
  /** Another tab holds the database open at an older version. */
  | "blocked"
  /** The stored save was written by a newer version of OSP. */
  | "too-new"
  /** The stored save cannot be read. */
  | "corrupt"
  | "quota"
  | "write-failed"
  | "import-too-large"
  | "import-not-json"
  | "import-not-save"
  | "import-too-new"
  | "import-damaged";

/** A storage or save-file failure, with copy the player can act on. */
export class SaveDataError extends Error {
  readonly kind: SaveDataErrorKind;

  constructor(kind: SaveDataErrorKind, message: string) {
    super(message);
    this.name = "SaveDataError";
    this.kind = kind;
  }
}

const UNCHANGED = "Your current progress hasn't changed.";

/** `detail` names the failing error for writes and the damaged field for imports. */
export function saveDataError(
  kind: SaveDataErrorKind,
  detail = "unknown",
): SaveDataError {
  return new SaveDataError(kind, messageFor(kind, detail));
}

function messageFor(kind: SaveDataErrorKind, detail: string): string {
  switch (kind) {
    case "unavailable":
      return "This browser isn't letting OSP store data. Private browsing or site-data settings can cause this.";
    case "blocked":
      return "OSP is open in another tab with an older version. Close the other tab, then try again.";
    case "too-new":
      return "This save was written by a newer version of OSP. OSP hasn't changed it.";
    case "corrupt":
      return "OSP couldn't read your save data and hasn't changed it.";
    case "quota":
      return "Your browser's storage for OSP is full, so your latest changes aren't saved. Export your save or clear downloaded game data in Settings.";
    case "write-failed":
      return `OSP couldn't write your save data (${detail}), so your latest changes aren't saved.`;
    case "import-too-large":
      return `That file is too large to be an OSP save. ${UNCHANGED}`;
    case "import-not-json":
      return `That file isn't valid JSON. ${UNCHANGED}`;
    case "import-not-save":
      return `That file isn't an OSP save. ${UNCHANGED}`;
    case "import-too-new":
      return `That save was written by a newer version of OSP. ${UNCHANGED}`;
    case "import-damaged":
      return `That save file is damaged at ${detail}. ${UNCHANGED}`;
  }
}

/** Maps an exception from browser storage to the failure the player sees. */
export function storageError(
  error: unknown,
  during: "open" | "write",
): SaveDataError {
  if (error instanceof SaveDataError) {
    return error;
  }
  const name = errorName(error);
  if (name === "QuotaExceededError") {
    return saveDataError("quota");
  }
  if (during === "open") {
    return saveDataError(name === "VersionError" ? "too-new" : "unavailable");
  }
  return saveDataError("write-failed", name);
}

function errorName(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
    ? error.name
    : "UnknownError";
}
