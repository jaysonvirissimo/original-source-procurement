import { createHash } from "node:crypto";

/**
 * Lowercase hexadecimal SHA-256 of a string's UTF-8 bytes, or of raw bytes.
 *
 * The game computes the same digests with Web Crypto, which the importer
 * cannot reach: it must not depend on `@osp/curriculum`. Keep the two in step.
 */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/** SHA-256 of 32-bit words laid out as little-endian bytes. */
export function wordsSha256(words: readonly number[]): string {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  words.forEach((word, index) => {
    view.setUint32(index * 4, word, true);
  });
  return sha256Hex(bytes);
}
