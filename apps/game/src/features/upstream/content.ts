import { sha256Hex, wordsSha256 } from "@osp/curriculum";
import type { RemoteCReference, RemoteWords } from "@osp/mission-schema";

const DW_LINE = /^[ \t]*dw[ \t]+0x[0-9A-Fa-f]{1,8}\b/gm;

/**
 * The value of every `dw 0x` line in an upstream target file, in order.
 * Reading these values is data extraction; OSP parses no other assembly.
 */
export function extractDwWords(text: string): number[] {
  return (text.match(DW_LINE) ?? []).map((line) =>
    Number.parseInt(line.slice(line.indexOf("0x") + 2), 16),
  );
}

/**
 * The words of a fetched target file, or `undefined` when their count or
 * their little-endian SHA-256 differs from the target's record.
 */
export async function verifyTargetText(
  text: string,
  target: RemoteWords,
): Promise<readonly number[] | undefined> {
  const words = extractDwWords(text);
  if (
    words.length !== target.wordCount ||
    (await wordsSha256(words)) !== target.wordsSha256
  ) {
    return undefined;
  }
  return words;
}

/**
 * Verifies a whole fetched C file against its reference and returns it with
 * LF line endings: the whole file, or only the reference's line span. The
 * hash covers the original bytes, before conversion, because most PsyQ SDK
 * headers use CRLF and the preprocessor needs LF. Returns `undefined` when
 * the hash differs or the span does not fit the file.
 */
export async function verifyCBytes(
  bytes: Uint8Array,
  reference: RemoteCReference,
): Promise<string | undefined> {
  if ((await sha256Hex(bytes)) !== reference.sha256) {
    return undefined;
  }
  const text = new TextDecoder().decode(bytes).replaceAll("\r\n", "\n");
  const { lines: span } = reference;
  if (span === undefined) {
    return text;
  }
  const lines = text.split("\n");
  if (text.endsWith("\n")) {
    lines.pop();
  }
  if (span.end > lines.length) {
    return undefined;
  }
  return `${lines.slice(span.start - 1, span.end).join("\n")}\n`;
}
