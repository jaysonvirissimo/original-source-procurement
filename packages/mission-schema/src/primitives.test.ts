import { describe, expect, it } from "vitest";
import {
  CommitShaSchema,
  isSafeRelativePath,
  ManualEntryIdSchema,
  MissionIdSchema,
  Sha256HexSchema,
  SkillIdSchema,
  SymbolSchema,
  TextSchema,
  Uint32Schema,
  uniqueArray,
} from "./primitives.ts";

describe("isSafeRelativePath", () => {
  it.each(["source/include/sample.h", "asm/a.s", "a"])("accepts %s", (path) => {
    expect(isSafeRelativePath(path)).toBe(true);
  });

  it.each([
    "",
    "/absolute.h",
    "trailing/",
    "a//b",
    "./a",
    "a/../b",
    "..",
    "a\\b",
  ])("rejects %j", (path) => {
    expect(isSafeRelativePath(path)).toBe(false);
  });
});

describe("primitive schemas", () => {
  it("accepts well-formed values", () => {
    expect(SkillIdSchema.parse("MIPS.LOAD.BYTE")).toBe("MIPS.LOAD.BYTE");
    expect(MissionIdSchema.parse("001-return_path.v2")).toBe(
      "001-return_path.v2",
    );
    expect(ManualEntryIdSchema.parse("mips.loads-and-stores")).toBe(
      "mips.loads-and-stores",
    );
    expect(SymbolSchema.parse("_sample1")).toBe("_sample1");
    expect(Uint32Schema.parse(0xffff_ffff)).toBe(0xffff_ffff);
  });

  it.each([
    [SkillIdSchema, "RETURN"],
    [SkillIdSchema, "abi.return"],
    [MissionIdSchema, "-leading"],
    [MissionIdSchema, "has/slash"],
    [ManualEntryIdSchema, "Upper.Case"],
    [SymbolSchema, "1sample"],
    [TextSchema, "   "],
    [Sha256HexSchema, "A".repeat(64)],
    [Sha256HexSchema, "a".repeat(63)],
    [CommitShaSchema, "abc1234"],
    [Uint32Schema, -1],
    [Uint32Schema, 0x1_0000_0000],
    [Uint32Schema, 1.5],
  ] as const)("rejects an invalid value (%#)", (schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it("uniqueArray rejects repeated entries", () => {
    const schema = uniqueArray(TextSchema);
    expect(schema.safeParse(["a", "b"]).success).toBe(true);
    expect(schema.safeParse(["a", "a"]).success).toBe(false);
  });
});
