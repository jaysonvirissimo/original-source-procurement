/*
 * Web Crypto and TextEncoder exist in both browsers and Node.js, but the
 * workspace compiles against the ECMAScript library only, so the two members
 * used here are typed locally.
 */
interface Platform {
  readonly crypto: {
    readonly subtle: {
      digest(algorithm: "SHA-256", data: Uint8Array): Promise<ArrayBuffer>;
    };
  };
  readonly TextEncoder: new () => { encode(input: string): Uint8Array };
}

const platform = globalThis as unknown as Platform;

/** Lowercase hexadecimal SHA-256 of a string's UTF-8 bytes, or of raw bytes. */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string"
      ? new platform.TextEncoder().encode(input)
      : input;
  const digest = await platform.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** SHA-256 of 32-bit words laid out as little-endian bytes. */
export function wordsSha256(words: readonly number[]): Promise<string> {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  words.forEach((word, index) => {
    view.setUint32(index * 4, word, true);
  });
  return sha256Hex(bytes);
}
