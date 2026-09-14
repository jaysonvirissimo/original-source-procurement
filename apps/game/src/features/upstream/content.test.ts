import { sha256Hex, wordsSha256 } from "@osp/curriculum";
import type { RemoteCReference, RemoteTarget } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import { extractDwWords, verifyCBytes, verifyTargetText } from "./content";

// Every word, header, and hash here is OSP-authored placeholder content.

const COMMIT = "1".repeat(40);

const WORDS = [0x00000000, 0x12345678, 0xffffffff];

const TARGET_TEXT = [
  "glabel sample_function",
  "    dw 0x00000000 ; 80010000",
  "\tdw 0x12345678 ; 80010004",
  "    dw 0xFFFFFFFF ; 80010008",
  "",
].join("\r\n");

async function target(
  overrides: Partial<RemoteTarget> = {},
): Promise<RemoteTarget> {
  return {
    kind: "remote",
    commit: COMMIT,
    path: "asm/sample/sample_function.s",
    wordCount: WORDS.length,
    wordsSha256: await wordsSha256(WORDS),
    ...overrides,
  };
}

const encode = (text: string) => new TextEncoder().encode(text);

async function reference(
  bytes: Uint8Array,
  lines?: RemoteCReference["lines"],
): Promise<RemoteCReference> {
  return {
    repository: "FoxdieTeam/psyq_sdk",
    commit: COMMIT,
    path: "psyq_4.4/include/sample.h",
    sha256: await sha256Hex(bytes),
    ...(lines === undefined ? {} : { lines }),
  };
}

describe("extractDwWords", () => {
  it("reads dw values in order and ignores every other line", () => {
    expect(extractDwWords(TARGET_TEXT)).toEqual(WORDS);
  });

  it("reads no words from text without dw lines", () => {
    expect(extractDwWords("glabel sample_function\n.word 1\n")).toEqual([]);
  });
});

describe("verifyTargetText", () => {
  it("returns the words when count and hash match", async () => {
    expect(await verifyTargetText(TARGET_TEXT, await target())).toEqual(WORDS);
  });

  it("rejects a different word count", async () => {
    expect(
      await verifyTargetText(TARGET_TEXT, await target({ wordCount: 2 })),
    ).toBeUndefined();
  });

  it("rejects different words", async () => {
    const changed = TARGET_TEXT.replace("0x12345678", "0x12345679");
    expect(await verifyTargetText(changed, await target())).toBeUndefined();
  });
});

describe("verifyCBytes", () => {
  const crlf = encode("#define SAMPLE(a) \\\r\n  ((a) + 1)\r\nint sample;\r\n");

  it("verifies CRLF bytes as fetched and returns LF text", async () => {
    expect(await verifyCBytes(crlf, await reference(crlf))).toBe(
      "#define SAMPLE(a) \\\n  ((a) + 1)\nint sample;\n",
    );
  });

  it("rejects bytes whose hash differs", async () => {
    const lf = encode("#define SAMPLE(a) \\\n  ((a) + 1)\nint sample;\n");
    expect(await verifyCBytes(crlf, await reference(lf))).toBeUndefined();
  });

  it("returns only the line span", async () => {
    expect(
      await verifyCBytes(crlf, await reference(crlf, { start: 2, end: 3 })),
    ).toBe("  ((a) + 1)\nint sample;\n");
  });

  it("counts a last line without a newline", async () => {
    const bytes = encode("int a;\nint b;");
    expect(
      await verifyCBytes(bytes, await reference(bytes, { start: 2, end: 2 })),
    ).toBe("int b;\n");
  });

  it("rejects a span past the end of the file", async () => {
    expect(
      await verifyCBytes(crlf, await reference(crlf, { start: 3, end: 4 })),
    ).toBeUndefined();
  });
});
