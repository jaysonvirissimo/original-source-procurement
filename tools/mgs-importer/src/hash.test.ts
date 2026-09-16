import { describe, expect, it } from "vitest";
import { sha256Hex, wordsSha256 } from "./hash.ts";

describe("sha256Hex", () => {
  it("hashes the empty input to the published digest", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes a string as its UTF-8 bytes", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(sha256Hex("abc"));
  });
});

describe("wordsSha256", () => {
  it("lays words out little-endian", () => {
    expect(wordsSha256([0x03e00008])).toBe(
      sha256Hex(new Uint8Array([0x08, 0x00, 0xe0, 0x03])),
    );
  });

  it("hashes no words to the empty digest", () => {
    expect(wordsSha256([])).toBe(sha256Hex(""));
  });

  it("distinguishes order", () => {
    expect(wordsSha256([1, 2])).not.toBe(wordsSha256([2, 1]));
  });
});
