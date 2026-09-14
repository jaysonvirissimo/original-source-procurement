import { describe, expect, it } from "vitest";
import {
  CompilerSettingsSchema,
  PSYQ_WASM_DEFAULT_CPP_FLAGS,
  sameList,
  startsWithList,
  UPSTREAM_DEFAULT_BUILD,
} from "./compiler.ts";
import {
  issuesOf,
  PLACEHOLDER_COMMIT,
  PLACEHOLDER_HASH,
  realMission,
  syntheticMission,
} from "./testing.ts";

const sdkHeader = {
  repository: "FoxdieTeam/psyq_sdk",
  commit: PLACEHOLDER_COMMIT,
  path: "psyq_4.4/include/sample.h",
  sha256: PLACEHOLDER_HASH,
} as const;

describe("list helpers", () => {
  it("startsWithList compares a prefix", () => {
    expect(startsWithList(["a", "b", "c"], ["a", "b"])).toBe(true);
    expect(startsWithList(["a"], ["a", "b"])).toBe(false);
    expect(startsWithList(["b", "a"], ["a"])).toBe(false);
  });

  it("sameList compares whole lists", () => {
    expect(sameList(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameList(["a", "b", "c"], ["a", "b"])).toBe(false);
  });
});

describe("UPSTREAM_DEFAULT_BUILD", () => {
  it("extends the psyq-wasm defaults with INTEGRAL and the include paths", () => {
    expect(UPSTREAM_DEFAULT_BUILD.cppFlags).toEqual([
      ...PSYQ_WASM_DEFAULT_CPP_FLAGS,
      "-DINTEGRAL",
      "-Ipsyq/include",
      "-Isource",
      "-Isource/include",
    ]);
  });
});

describe("CompilerSettingsSchema", () => {
  const synthetic = syntheticMission().compiler;
  const real = realMission().compiler;

  it("accepts authored and remote settings", () => {
    expect(issuesOf(CompilerSettingsSchema, synthetic)).toEqual([]);
    expect(issuesOf(CompilerSettingsSchema, real)).toEqual([]);
  });

  it("rejects cppFlags that do not start with the psyq-wasm defaults", () => {
    expect(
      issuesOf(CompilerSettingsSchema, {
        ...synthetic,
        cppFlags: ["-DEXTRA", ...PSYQ_WASM_DEFAULT_CPP_FLAGS],
      }),
    ).toEqual([
      {
        path: "cppFlags",
        message:
          "cppFlags must start with psyq-wasm's default preprocessor flags, because a supplied list replaces them.",
      },
    ]);
  });

  it("rejects -G in rawFlags", () => {
    expect(
      issuesOf(CompilerSettingsSchema, {
        ...synthetic,
        rawFlags: ["-O2", "-G8"],
      }),
    ).toEqual([
      {
        path: "rawFlags.1",
        message: "Set gpSize instead of passing -G in rawFlags.",
      },
    ]);
  });

  it("rejects a remote header with a line span", () => {
    expect(
      issuesOf(CompilerSettingsSchema, {
        ...real,
        remoteHeaders: {
          "psyq/include/sample.h": {
            ...sdkHeader,
            lines: { start: 1, end: 2 },
          },
        },
      }),
    ).toEqual([
      {
        path: "remoteHeaders.psyq/include/sample.h.lines",
        message:
          "A remote context header is a whole file and takes no line span.",
      },
    ]);
  });

  it("rejects a key shared by authored and remote headers", () => {
    expect(
      issuesOf(CompilerSettingsSchema, {
        ...real,
        headers: { "psyq/include/sample.h": "int x;\n" },
        remoteHeaders: { "psyq/include/sample.h": sdkHeader },
      }),
    ).toEqual([
      {
        path: "remoteHeaders.psyq/include/sample.h",
        message: "A header key cannot be both authored and remote.",
      },
    ]);
  });

  it("rejects a remote header from a repository outside the allowlist", () => {
    expect(
      CompilerSettingsSchema.safeParse({
        ...real,
        remoteHeaders: {
          "source/sample.h": { ...sdkHeader, repository: "someone/else" },
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["gpSize", { gpSize: 4 }],
    ["aspsxVersion", { aspsxVersion: "2.56" }],
    ["encoding", { encoding: "sjis" }],
    ["filename", { filename: "out.s" }],
    ["header key", { headers: { "../escape.h": "" } }],
  ])("rejects an invalid %s", (_name, change) => {
    expect(
      CompilerSettingsSchema.safeParse({ ...synthetic, ...change }).success,
    ).toBe(false);
  });
});
