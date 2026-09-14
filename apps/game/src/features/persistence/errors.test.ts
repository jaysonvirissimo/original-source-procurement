import { describe, expect, it } from "vitest";
import {
  saveDataError,
  SaveDataError,
  storageError,
  type SaveDataErrorKind,
} from "./errors";

const KINDS: readonly SaveDataErrorKind[] = [
  "unavailable",
  "blocked",
  "too-new",
  "corrupt",
  "quota",
  "write-failed",
  "import-too-large",
  "import-not-json",
  "import-not-save",
  "import-too-new",
  "import-damaged",
];

describe("saveDataError", () => {
  it("gives every kind its own specific copy", () => {
    const messages = KINDS.map((kind) => {
      const error = saveDataError(kind);
      expect(error).toBeInstanceOf(SaveDataError);
      expect(error.kind).toBe(kind);
      expect(error.name).toBe("SaveDataError");
      expect(error.message).not.toMatch(/something went wrong/i);
      return error.message;
    });
    expect(new Set(messages).size).toBe(KINDS.length);
  });

  it("names the failing error of a write and the damaged field of an import", () => {
    expect(saveDataError("write-failed", "AbortError").message).toContain(
      "(AbortError)",
    );
    expect(
      saveDataError("import-damaged", "player.missions").message,
    ).toContain("damaged at player.missions");
  });

  it("tells the player an invalid import changed nothing", () => {
    for (const kind of KINDS.filter((name) => name.startsWith("import-"))) {
      expect(saveDataError(kind).message).toContain(
        "Your current progress hasn't changed.",
      );
    }
  });
});

describe("storageError", () => {
  const dom = (name: string) => new DOMException("storage", name);

  it("keeps an error that is already a save-data error", () => {
    const error = saveDataError("blocked");
    expect(storageError(error, "open")).toBe(error);
  });

  it("reports a full store as quota, whenever it happens", () => {
    expect(storageError(dom("QuotaExceededError"), "open").kind).toBe("quota");
    expect(storageError(dom("QuotaExceededError"), "write").kind).toBe("quota");
  });

  it("maps open failures", () => {
    expect(storageError(dom("VersionError"), "open").kind).toBe("too-new");
    expect(storageError(dom("SecurityError"), "open").kind).toBe("unavailable");
  });

  it("names the error of any other failed write", () => {
    const failed = storageError(dom("InvalidStateError"), "write");
    expect(failed.kind).toBe("write-failed");
    expect(failed.message).toContain("(InvalidStateError)");
    for (const thrown of ["boom", null, { name: 3 }]) {
      expect(storageError(thrown, "write").message).toContain("(UnknownError)");
    }
  });
});
