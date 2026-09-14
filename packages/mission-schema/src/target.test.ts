import { describe, expect, it } from "vitest";
import {
  InlineTargetSchema,
  RelocationTargetSchema,
  RemoteTargetSchema,
  TargetSchema,
} from "./target.ts";
import { inlineTarget, issuesOf, remoteTarget } from "./testing.ts";

const relocation = {
  offset: 0,
  kind: "HI16",
  fieldMask: 0xffff,
  fieldValue: 0,
  target: { kind: "symbol", name: "global_value", addend: 4 },
} as const;

describe("RelocationTargetSchema", () => {
  it("accepts symbol and section targets", () => {
    expect(
      RelocationTargetSchema.safeParse({
        kind: "symbol",
        name: "g",
        addend: 0,
      }).success,
    ).toBe(true);
    expect(
      RelocationTargetSchema.safeParse({
        kind: "section",
        section: ".data",
        offset: 8,
        label: "table",
      }).success,
    ).toBe(true);
  });

  it("rejects a target given as a string", () => {
    expect(RelocationTargetSchema.safeParse("global_value+4").success).toBe(
      false,
    );
  });

  it("rejects a symbol target without an addend", () => {
    expect(
      RelocationTargetSchema.safeParse({ kind: "symbol", name: "g" }).success,
    ).toBe(false);
  });
});

describe("InlineTargetSchema", () => {
  it("accepts a target with a relocation on one of its words", () => {
    expect(
      issuesOf(InlineTargetSchema, {
        ...inlineTarget(),
        relocations: [{ ...relocation, offset: 4 }],
      }),
    ).toEqual([]);
  });

  it("rejects a relocation whose target is a string", () => {
    expect(
      InlineTargetSchema.safeParse({
        ...inlineTarget(),
        relocations: [{ ...relocation, target: "global_value" }],
      }).success,
    ).toBe(false);
  });

  it("requires one provenance entry per word", () => {
    expect(
      issuesOf(InlineTargetSchema, { ...inlineTarget(), provenance: [] }),
    ).toEqual([
      {
        path: "provenance",
        message: "Provenance needs exactly one entry per word.",
      },
    ]);
  });

  it.each([2, 8])("rejects a relocation at byte offset %i", (offset) => {
    expect(
      issuesOf(InlineTargetSchema, {
        ...inlineTarget(),
        relocations: [{ ...relocation, offset }],
      }),
    ).toEqual([
      {
        path: "relocations.0.offset",
        message: "A relocation offset must fall on a word inside the function.",
      },
    ]);
  });

  it("rejects words that are not 32-bit values", () => {
    expect(
      InlineTargetSchema.safeParse({ ...inlineTarget(), words: [-1, 2] })
        .success,
    ).toBe(false);
  });
});

describe("RemoteTargetSchema", () => {
  it("accepts a pointer", () => {
    expect(issuesOf(RemoteTargetSchema, remoteTarget())).toEqual([]);
  });

  it.each([
    ["a malformed commit", { commit: "abc1234" }],
    ["path traversal", { path: "asm/../source/sample.c" }],
    ["a path outside asm/", { path: "source/sample.s" }],
    ["a path that is not a .s file", { path: "asm/sample.c" }],
    ["a non-hex hash", { wordsSha256: "z".repeat(64) }],
    ["a zero word count", { wordCount: 0 }],
    ["inline words", { words: [1, 2, 3, 4] }],
  ])("rejects %s", (_name, change) => {
    expect(
      RemoteTargetSchema.safeParse({ ...remoteTarget(), ...change }).success,
    ).toBe(false);
  });
});

describe("TargetSchema", () => {
  it("discriminates inline and remote targets", () => {
    expect(TargetSchema.parse(inlineTarget()).kind).toBe("inline");
    expect(TargetSchema.parse(remoteTarget()).kind).toBe("remote");
  });
});
