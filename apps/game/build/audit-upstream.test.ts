import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  feasibilityPointer,
  PLACEHOLDER_HASH,
  realMission,
  syntheticMission,
} from "@osp/mission-schema/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  auditFile,
  fingerprintsOf,
  listTrackedFiles,
  runUpstreamAudit,
  sha256Hex,
  type UpstreamFingerprints,
} from "./audit-upstream";

// OSP-authored placeholder content. Hashes are computed from it here, and
// target lines are assembled at run time so this file holds none.

const HEADER_CRLF = "#define SAMPLE 1\r\nint sample;\r\n";
const HEADER_LF = HEADER_CRLF.replaceAll("\r\n", "\n");
const WORDS = [0x11111111, 0x22222222, 0x33333333, 0x44444444];

function littleEndian(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => {
    view.setUint32(index * 4, value, true);
  });
  return bytes;
}

const FINGERPRINTS: UpstreamFingerprints = {
  fileHashes: new Set([sha256Hex(HEADER_CRLF)]),
  targets: [
    { wordCount: 4, wordsSha256: sha256Hex(littleEndian(WORDS)) },
    { wordCount: 4, wordsSha256: sha256Hex(littleEndian([1, 2, 3, 4])) },
  ],
};

const encode = (text: string) => new TextEncoder().encode(text);
const hex = (value: number) => `0x${value.toString(16).padStart(8, "0")}`;

function codes(path: string, content: string | Uint8Array) {
  const bytes = typeof content === "string" ? encode(content) : content;
  return auditFile(path, bytes, FINGERPRINTS).map((issue) => issue.code);
}

describe("auditFile", () => {
  it("passes a file with no upstream content", () => {
    expect(codes("src/sample.ts", "export const sample = 1;\n")).toEqual([]);
  });

  it("fails an upstream target file by path", () => {
    expect(codes("apps/game/dist/asm/sample/sample.s", "\n")).toEqual([
      "target-file",
    ]);
  });

  it("fails a dw 0x target line", () => {
    const listing = ["glabel sample", `    dw ${hex(0x12345678)} ; 1`, ""];
    expect(codes("notes.txt", listing.join("\n"))).toEqual(["target-line"]);
  });

  it("fails a referenced upstream file as-is and after converting to LF", () => {
    expect(codes("copy.h", HEADER_CRLF)).toEqual(["upstream-file"]);
    expect(codes("copy.h", HEADER_LF)).toEqual(["upstream-file"]);
  });

  it("fails a copy converted to CRLF from an LF original", () => {
    const fingerprints = {
      ...FINGERPRINTS,
      fileHashes: new Set([sha256Hex(HEADER_LF)]),
    };
    expect(
      auditFile("copy.h", encode(HEADER_CRLF), fingerprints).map(
        (issue) => issue.code,
      ),
    ).toEqual(["upstream-file"]);
  });

  it("fails a target's words as hexadecimal or decimal numbers in text", () => {
    expect(
      codes(
        "table.ts",
        `export const table = [${WORDS.map(hex).join(", ")}];\n`,
      ),
    ).toEqual(["target-words"]);
    expect(codes("table.json", JSON.stringify({ words: WORDS }))).toEqual([
      "target-words",
    ]);
  });

  it("passes a target's words interrupted by another number", () => {
    const interrupted = [...WORDS.slice(0, 2), 5, ...WORDS.slice(2)];
    expect(codes("table.json", JSON.stringify(interrupted))).toEqual([]);
  });

  it("ignores numbers wider than 32 bits", () => {
    expect(codes("big.txt", "9999999999 0x123456789\n")).toEqual([]);
  });

  it("fails a target's words aligned in binary content", () => {
    const withNul = new Uint8Array([0, 0, 0, 0, ...littleEndian(WORDS), 7]);
    expect(codes("data.bin", withNul)).toEqual(["target-words"]);
    const invalidUtf8 = new Uint8Array([
      0xff,
      0xfe,
      0xfd,
      0xfc,
      ...littleEndian(WORDS),
    ]);
    expect(codes("data.bin", invalidUtf8)).toEqual(["target-words"]);
  });
});

describe("fingerprintsOf", () => {
  it("collects every referenced file hash and target from pointers and missions", () => {
    const bare = feasibilityPointer();
    delete bare.compiler.remoteHeaders;
    bare.solution.sha256 = "b".repeat(64);

    const fingerprints = fingerprintsOf(
      [feasibilityPointer(), bare],
      [realMission(), syntheticMission()],
    );

    expect(fingerprints.fileHashes).toEqual(
      new Set([PLACEHOLDER_HASH, "b".repeat(64)]),
    );
    expect(fingerprints.targets).toEqual([
      { wordCount: 4, wordsSha256: PLACEHOLDER_HASH },
      { wordCount: 4, wordsSha256: PLACEHOLDER_HASH },
      { wordCount: 4, wordsSha256: PLACEHOLDER_HASH },
    ]);
  });
});

describe("listTrackedFiles", () => {
  it("lists files git tracks, relative to the repository root", async () => {
    await expect(listTrackedFiles(process.cwd())).resolves.toContain(
      "package.json",
    );
  });
});

describe("runUpstreamAudit", () => {
  let root: string;
  let site: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "osp-upstream-audit-"));
    site = join(root, "dist");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function put(path: string, content: string) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }

  function output() {
    return { log: vi.fn(), error: vi.fn() };
  }

  const listed =
    (...paths: string[]) =>
    () =>
      Promise.resolve(paths);

  it("checks tracked and built files, skips deleted ones, and exits 0", async () => {
    await put("clean.txt", "clean\n");
    await put("dist/index.js", "console.log(1);\n");
    const out = output();

    await expect(
      runUpstreamAudit(
        {
          repositoryRoot: root,
          siteDirectory: site,
          fingerprints: FINGERPRINTS,
          listTracked: listed("clean.txt", "deleted.txt"),
        },
        out,
      ),
    ).resolves.toBe(0);
    expect(out.log).toHaveBeenCalledWith(
      "Upstream audit passed: checked 2 files against 1 upstream file hashes and 2 target word hashes.",
    );
  });

  it("checks only tracked files when there is no built site", async () => {
    await put("clean.txt", "clean\n");
    const out = output();

    await expect(
      runUpstreamAudit(
        {
          repositoryRoot: root,
          siteDirectory: site,
          fingerprints: FINGERPRINTS,
          listTracked: listed("clean.txt"),
        },
        out,
      ),
    ).resolves.toBe(0);
    expect(out.log).toHaveBeenCalledWith(
      `No built site at ${site}; only tracked files were checked.`,
    );
  });

  it("fails when a required built site is missing", async () => {
    await put("clean.txt", "clean\n");
    const out = output();

    await expect(
      runUpstreamAudit(
        {
          repositoryRoot: root,
          siteDirectory: site,
          fingerprints: FINGERPRINTS,
          requireSite: true,
          listTracked: listed("clean.txt"),
        },
        out,
      ),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      `No built site at ${site}. Run pnpm build before the upstream audit.`,
    );
    expect(out.log).not.toHaveBeenCalled();
  });

  it("prints each issue with its path and exits 1", async () => {
    await put("dist/copy.h", HEADER_LF);
    const out = output();

    await expect(
      runUpstreamAudit(
        {
          repositoryRoot: root,
          siteDirectory: site,
          fingerprints: FINGERPRINTS,
          listTracked: listed(),
        },
        out,
      ),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      `${site}/copy.h: Matches a referenced upstream file, as-is or after converting its line endings. [upstream-file]`,
    );
    expect(out.error).toHaveBeenLastCalledWith(
      "Upstream audit failed with 1 issue.",
    );
  });

  it("counts several issues", async () => {
    await put("copy.h", HEADER_CRLF);
    await put("table.json", JSON.stringify(WORDS));
    const out = output();

    await runUpstreamAudit(
      {
        repositoryRoot: root,
        siteDirectory: site,
        fingerprints: FINGERPRINTS,
        listTracked: listed("copy.h", "table.json"),
      },
      out,
    );

    expect(out.error).toHaveBeenLastCalledWith(
      "Upstream audit failed with 2 issues.",
    );
  });

  it("exits 1 when tracked files cannot be listed", async () => {
    const out = output();

    await expect(
      runUpstreamAudit(
        {
          repositoryRoot: root,
          siteDirectory: site,
          fingerprints: FINGERPRINTS,
          listTracked: () => Promise.reject(new Error("not a repository")),
        },
        out,
      ),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      `Could not list tracked files in ${root}.`,
    );
  });
});
