import {
  extractFunction,
  matchFunction,
  type MatchResult,
  type MatchTarget,
} from "@osp/matching-core";
import { PSYQ_WASM_DEFAULT_CPP_FLAGS } from "@osp/mission-schema";
import { assemble, type AssembledObject } from "psyq-asm";
import { createCompiler } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PSYQ_ASM_VERSION } from "./browserToolchain";
import { createToolchainService } from "./toolchainService";
import type { ToolchainService } from "./types";

// Every C source in this file is OSP-authored. Targets are built from an
// OSP-authored solution with the same toolchain, as synthetic missions are.

describe("matching real compiler output", () => {
  let service: ToolchainService;

  beforeAll(async () => {
    service = await createToolchainService({
      createCompiler: () => createCompiler(),
      assemble,
      psyqAsmVersion: PSYQ_ASM_VERSION,
    });
  }, 30_000);

  afterAll(() => {
    service.dispose();
  });

  async function build(source: string): Promise<AssembledObject> {
    const outcome = await service.build({
      filename: "mission.c",
      source,
      headers: {},
      cppFlags: PSYQ_WASM_DEFAULT_CPP_FLAGS,
      rawFlags: ["-O2", "-g0", "-Wall"],
      gpSize: 0,
      aspsxVersion: "2.77",
      encoding: "utf8",
    });
    if (outcome.kind !== "success") {
      throw new Error(`Expected a successful build, got ${outcome.kind}.`);
    }
    return outcome.object;
  }

  async function unlinkedTarget(solution: string): Promise<MatchTarget> {
    const generated = extractFunction(await build(solution), "f");
    if (generated === undefined) {
      throw new Error("The solution defines no function f.");
    }
    return {
      kind: "unlinked",
      words: generated.words.map((word) => word.word),
      relocations: generated.relocations,
    };
  }

  async function match(solution: string, source: string): Promise<MatchResult> {
    const outcome = matchFunction(
      await build(source),
      "f",
      await unlinkedTarget(solution),
    );
    if (outcome.kind !== "matched") {
      throw new Error("The source defines no function f.");
    }
    return outcome.result;
  }

  function kinds(result: MatchResult): string[] {
    return result.mismatches.map((mismatch) => mismatch.kind);
  }

  const record = (delta: string) => `struct Rec { int id; ${delta} delta; };\n`;

  it("reports a known matching source as exact", async () => {
    const source = "int f(int a) { return a + 5; }\n";
    const result = await match(source, source);

    expect(result.exact).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it("classifies a signed char field target (lb) against plain char source (lbu) as LOAD_SIGNEDNESS", async () => {
    const body = "int f(struct Rec *r) { return r->delta; }\n";
    const result = await match(
      record("signed char") + body,
      record("char") + body,
    );

    expect(result.exact).toBe(false);
    expect(kinds(result)).toEqual(["LOAD_SIGNEDNESS"]);
  });

  it("classifies an int field target (lw) against a signed char field source (lb) as LOAD_WIDTH", async () => {
    const body = "int f(struct Rec *r) { return r->delta; }\n";
    const result = await match(
      record("int") + body,
      record("signed char") + body,
    );

    expect(kinds(result)).toEqual(["LOAD_WIDTH"]);
  });

  it("classifies an int store target (sw) against a signed char store source (sb) as STORE_WIDTH", async () => {
    const body = "void f(struct Rec *r, int v) { r->delta = v; }\n";
    const result = await match(
      record("int") + body,
      record("signed char") + body,
    );

    expect(kinds(result)).toEqual(["STORE_WIDTH"]);
  });

  it("reports &g[1] against &g[0], whose words are identical, as RELOCATION_TARGET", async () => {
    const declaration = "extern int g[];\n";
    const result = await match(
      `${declaration}int *f(void) { return &g[1]; }\n`,
      `${declaration}int *f(void) { return &g[0]; }\n`,
    );

    expect(result.exact).toBe(false);
    expect(result.alignment.every((row) => row.status === "equal")).toBe(true);
    expect(new Set(kinds(result))).toEqual(new Set(["RELOCATION_TARGET"]));
    expect(result.mismatches[0]?.evidence).toContain(
      "Target relocates HI16 g+4 here; your output does not.",
    );
  });

  it("reports an empty source as function-missing", async () => {
    expect(
      matchFunction(await build(""), "f", { kind: "linked", words: [0] }),
    ).toEqual({ kind: "function-missing", symbol: "f", definedFunctions: [] });
  });
});
