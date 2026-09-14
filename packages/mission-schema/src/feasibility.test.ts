import { describe, expect, it } from "vitest";
import {
  directoryOf,
  FeasibilityPointerSchema,
  headerKeys,
} from "./feasibility.ts";
import {
  feasibilityPointer,
  issuesOf,
  PLACEHOLDER_COMMIT,
  PLACEHOLDER_HASH,
} from "./testing.ts";

function issues(value: unknown) {
  return issuesOf(FeasibilityPointerSchema, value);
}

function issue(path: string, message: string) {
  return { path, message };
}

const sdkHeader = {
  repository: "FoxdieTeam/psyq_sdk",
  commit: PLACEHOLDER_COMMIT,
  path: "psyq_4.4/include/sample.h",
  sha256: PLACEHOLDER_HASH,
} as const;

const upstreamHeader = {
  ...sdkHeader,
  repository: "FoxdieTeam/mgs_reversing",
  path: "source/sample/sample.h",
} as const;

const HEADER_KEY_MESSAGE =
  "A remote header is keyed by its mgs_reversing path or its path from the source file's directory, or under psyq/include/ for a psyq_sdk header in psyq_4.4/include/.";

describe("feasibility pointer", () => {
  it("accepts the builder", () => {
    expect(issues(feasibilityPointer())).toEqual([]);
  });

  it("rejects unknown keys, such as inline words", () => {
    expect(issues({ ...feasibilityPointer(), words: [1] })).not.toEqual([]);
  });

  it("rejects a pointer without upstream provenance", () => {
    const pointer = feasibilityPointer();
    pointer.source = { kind: "synthetic" };
    expect(issues(pointer)).toEqual([
      issue("source", "A pointer must record its upstream provenance."),
    ]);
  });

  it("rejects a symbol that differs from its source", () => {
    const pointer = feasibilityPointer();
    pointer.symbol = "other_function";
    expect(issues(pointer)).toEqual([
      issue("symbol", "A pointer's symbol must match its source symbol."),
    ]);
  });

  it("rejects a solution that is not the provenance's source file", () => {
    const pointer = feasibilityPointer();
    pointer.solution = { ...pointer.solution, path: "source/sample/other.c" };
    expect(issues(pointer)).toEqual([
      issue(
        "solution.path",
        "The solution must be the source file named by the provenance.",
      ),
    ]);
  });

  it("rejects a solution from psyq_sdk or with a line span", () => {
    const pointer = feasibilityPointer();
    pointer.solution = {
      ...pointer.solution,
      repository: "FoxdieTeam/psyq_sdk",
      lines: { start: 1, end: 2 },
    };
    expect(issues(pointer)).toEqual([
      issue("solution.repository", "The solution comes from mgs_reversing."),
      issue(
        "solution.lines",
        "The solution is a whole file and takes no line span.",
      ),
    ]);
  });

  it("holds compiler input to upstream's default build", () => {
    const pointer = feasibilityPointer();
    pointer.compiler.aspsxVersion = "2.81";
    pointer.compiler.headers = { "source/authored.h": "int authored;\n" };
    expect(issues(pointer)).toEqual([
      issue(
        "compiler.headers",
        "Real-function pointers load all context remotely and carry no authored headers.",
      ),
      issue(
        "compiler.aspsxVersion",
        'Real-function pointers use aspsxVersion "2.77", the assembler of upstream\'s default build.',
      ),
    ]);
  });

  it("accepts a header beside the source file keyed from its directory", () => {
    const pointer = feasibilityPointer();
    pointer.compiler.remoteHeaders = { "sample.h": upstreamHeader };
    expect(issues(pointer)).toEqual([]);
  });

  it("rejects remote headers keyed away from their include path", () => {
    const pointer = feasibilityPointer();
    pointer.compiler.remoteHeaders = {
      "source/sample.h": sdkHeader,
      "psyq/include/other.h": {
        ...sdkHeader,
        path: "psyq_4.5/include/other.h",
      },
      "source/include/renamed.h": {
        ...upstreamHeader,
        path: "source/include/original.h",
      },
    };
    expect(issues(pointer)).toEqual([
      issue("compiler.remoteHeaders.source/sample.h", HEADER_KEY_MESSAGE),
      issue("compiler.remoteHeaders.psyq/include/other.h", HEADER_KEY_MESSAGE),
      issue(
        "compiler.remoteHeaders.source/include/renamed.h",
        HEADER_KEY_MESSAGE,
      ),
    ]);
  });
});

describe("headerKeys", () => {
  it("keys SDK headers under psyq/include/ only when in the include directory", () => {
    expect(headerKeys(sdkHeader, "source/sample/")).toEqual([
      "psyq/include/sample.h",
    ]);
    expect(
      headerKeys({ ...sdkHeader, path: "psyq_4.5/include/sample.h" }, ""),
    ).toEqual([]);
  });

  it("keys upstream headers by path, and beside the source by name too", () => {
    expect(headerKeys(upstreamHeader, "source/sample/")).toEqual([
      "source/sample/sample.h",
      "sample.h",
    ]);
    expect(headerKeys(upstreamHeader, "source/other/")).toEqual([
      "source/sample/sample.h",
    ]);
    expect(headerKeys(upstreamHeader, "")).toEqual(["source/sample/sample.h"]);
  });
});

describe("directoryOf", () => {
  it("keeps the trailing slash and returns an empty string for a bare name", () => {
    expect(directoryOf("source/sample/sample.c")).toBe("source/sample/");
    expect(directoryOf("sample.c")).toBe("");
  });
});
