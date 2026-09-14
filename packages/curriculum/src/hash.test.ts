import { describe, expect, it } from "vitest";
import { sha256Hex, wordsSha256 } from "./hash.ts";

describe("sha256Hex", () => {
  it("hashes a string's UTF-8 bytes", async () => {
    await expect(sha256Hex("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes raw bytes", async () => {
    await expect(sha256Hex(new Uint8Array([0x61, 0x62, 0x63]))).resolves.toBe(
      await sha256Hex("abc"),
    );
  });
});

describe("wordsSha256", () => {
  it("lays words out as little-endian bytes", async () => {
    // 0x64636261 is "abcd" in little-endian byte order.
    await expect(wordsSha256([0x6463_6261])).resolves.toBe(
      await sha256Hex("abcd"),
    );
  });

  it("hashes an empty word list as empty input", async () => {
    await expect(wordsSha256([])).resolves.toBe(await sha256Hex(""));
  });
});
