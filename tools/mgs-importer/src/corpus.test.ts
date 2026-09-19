import { PointerCorpusSchema } from "@osp/mission-schema";
import { describe, expect, it } from "vitest";
import {
  buildCorpus,
  buildMission,
  renderCorpusModule,
  resolveCalls,
  sameCorpus,
} from "./corpus.ts";
import type { MissionOverride } from "./overrides.ts";
import type { FunctionVerdict } from "./records.ts";
import {
  fileRecord,
  functionRecord,
  importIndex,
  pinnedTarget,
  unpinnedRecord,
  verdictIndex,
  PRE_MATCH_COMMIT,
  SDK_COMMIT,
  UPSTREAM_COMMIT,
} from "./testing.ts";

const override: MissionOverride = {
  symbol: "sample_function",
  id: "R001",
  title: "SAMPLE FIELD WORK",
  phase: "Field work",
  kind: "real-solved",
  scaffold: "field",
  requires: ["ABI.RETURN"],
  practices: [],
  briefing: { objective: "Match the function." },
  starterSource: "void sample_function(void) {\n}\n",
  hints: [{ stage: 1, text: "Look at the return register." }],
  reviewedAt: "2026-09-15",
};

describe("buildMission", () => {
  const mission = buildMission(override, functionRecord(), fileRecord(), []);

  it("takes the pointer, the flags, and the provenance from the import", () => {
    expect(mission.target.kind).toBe("remote");
    expect(mission.target).toMatchObject({ calls: [] });
    expect(mission.source).toEqual({
      kind: "mgs-reversing",
      repository: "FoxdieTeam/mgs_reversing",
      build: "default",
      overlay: "main",
      symbol: "sample_function",
      address: 0x80016ef8,
      sourcePath: "source/sample/sample.c",
    });
    expect(mission.compiler.remoteHeaders).toBeDefined();
  });

  it("takes everything a player reads from the reviewed override", () => {
    expect(mission.title).toBe("SAMPLE FIELD WORK");
    expect(mission.briefing).toEqual(override.briefing);
    expect(mission.hints).toEqual(override.hints);
  });

  it("copies context type names only when the override lists them", () => {
    expect(mission.contextTypes).toBeUndefined();
    expect(
      buildMission(
        { ...override, contextTypes: ["SAMPLE", "struct sample"] },
        functionRecord(),
        fileRecord(),
        [],
      ).contextTypes,
    ).toEqual(["SAMPLE", "struct sample"]);
  });

  it("copies glossary terms only when the override lists them", () => {
    expect(mission.terms).toBeUndefined();
    expect(
      buildMission(
        { ...override, terms: ["glossary.word"] },
        functionRecord(),
        fileRecord(),
        [],
      ).terms,
    ).toEqual(["glossary.word"]);
  });

  it("teaches nothing and carries no known solution", () => {
    expect(mission.teaches).toEqual([]);
    expect(mission.solution).toBeUndefined();
    expect(mission.completion).toBe("exact");
  });

  it("scores difficulty from the target words and the header count", () => {
    expect(mission.difficulty.size).toBe(4);
    expect(mission.difficulty.context).toBe(1);
  });

  it("scores a file that needs no context at all", () => {
    const bare = fileRecord();
    const built = buildMission(
      override,
      functionRecord(),
      {
        ...bare,
        compiler: { ...bare.compiler, remoteHeaders: undefined },
      },
      [],
    );
    expect(built.difficulty.context).toBe(0);
  });

  it("rejects a record with no pinned target", () => {
    expect(() =>
      buildMission(
        override,
        unpinnedRecord({ reason: "no-deletion" }),
        fileRecord(),
        [],
      ),
    ).toThrow(/no pinned target/);
  });
});

describe("buildCorpus", () => {
  it("builds a corpus its own schema accepts", () => {
    const corpus = buildCorpus(importIndex(), verdictIndex(), [override]);
    expect(PointerCorpusSchema.safeParse(corpus).success).toBe(true);
    expect(corpus.missions).toHaveLength(1);
    expect(corpus.upstreamCommit).toBe(UPSTREAM_COMMIT);
    expect(corpus.sdkCommit).toBe(SDK_COMMIT);
    expect(corpus.toolchain).toEqual(verdictIndex().toolchain);
  });

  it("builds an empty corpus when nothing is reviewed yet", () => {
    expect(buildCorpus(importIndex(), verdictIndex(), []).missions).toEqual([]);
  });

  it("orders missions by id, so a rebuild never reshuffles them", () => {
    const second = { ...override, id: "R000", symbol: "other_function" };
    const corpus = buildCorpus(
      importIndex({
        functions: [
          functionRecord(),
          functionRecord({ symbol: "other_function" }),
        ],
      }),
      verdictIndex({
        functions: [
          ...verdictIndex().functions,
          {
            symbol: "other_function",
            sourcePath: "source/sample/sample.c",
            verdict: "exact",
          },
        ],
      }),
      [override, second],
    );
    expect(corpus.missions.map((mission) => mission.id)).toEqual([
      "R000",
      "R001",
    ]);
  });

  it("fails when a reviewed mission was not imported", () => {
    expect(() =>
      buildCorpus(importIndex({ functions: [] }), verdictIndex(), [override]),
    ).toThrow(/not imported from this checkout/);
  });

  it("fails rather than dropping a mission that stopped reproducing", () => {
    expect(() =>
      buildCorpus(
        importIndex(),
        verdictIndex({
          functions: [
            {
              symbol: "sample_function",
              sourcePath: "source/sample/sample.c",
              verdict: "mismatch",
            },
          ],
        }),
        [override],
      ),
    ).toThrow(/verdict is "mismatch"/);
  });

  it("fails when the verified source file is not in the import", () => {
    expect(() =>
      buildCorpus(
        importIndex({ files: [fileRecord({ path: "source/other/other.c" })] }),
        verdictIndex(),
        [override],
      ),
    ).toThrow(/which the import does not describe/);
  });

  it("fails when the verdicts came from another checkout", () => {
    expect(() =>
      buildCorpus(
        importIndex(),
        verdictIndex({ upstreamCommit: "9".repeat(40) }),
        [],
      ),
    ).toThrow(/different commits/);
  });

  it("fails when a merged mission would not satisfy the schema", () => {
    expect(() =>
      buildCorpus(importIndex(), verdictIndex(), [
        { ...override, hints: [{ stage: 1, text: "" }] },
      ]),
    ).toThrow(/The corpus is not valid/);
  });
});

describe("sameCorpus", () => {
  it("is true for an unchanged rebuild", () => {
    const a = buildCorpus(importIndex(), verdictIndex(), [override]);
    const b = buildCorpus(importIndex(), verdictIndex(), [override]);
    expect(sameCorpus(a, b)).toBe(true);
  });

  it("is false once a pointer moves", () => {
    const a = buildCorpus(importIndex(), verdictIndex(), [override]);
    const b = buildCorpus(
      importIndex({
        functions: [
          functionRecord({
            pinned: pinnedTarget({
              target: {
                kind: "remote",
                commit: PRE_MATCH_COMMIT,
                path: "asm/sample/sample_function_80016EF8.s",
                wordCount: 5,
                wordsSha256: "b".repeat(64),
              },
            }),
          }),
        ],
      }),
      verdictIndex(),
      [override],
    );
    expect(sameCorpus(a, b)).toBe(false);
  });
});

describe("renderCorpusModule", () => {
  it("marks the module generated and exports the corpus", () => {
    const text = renderCorpusModule(
      buildCorpus(importIndex(), verdictIndex(), []),
    );
    expect(text).toContain("Generated by `pnpm corpus:write`");
    expect(text).toContain("Do not edit");
    expect(text).toContain("export const pointerCorpus: PointerCorpus =");
  });
});

describe("resolveCalls", () => {
  // OSP-authored placeholder addresses and names.
  const exact = (
    symbol: string,
    calls: NonNullable<FunctionVerdict["calls"]>,
  ): FunctionVerdict => ({
    symbol,
    sourcePath: "source/sample/sample.c",
    verdict: "exact",
    calls,
  });

  it("names each call from the verdict, in word order", () => {
    const verdict = exact("caller", [
      { word: 2, address: 0x80010000, symbol: "helper" },
      { word: 6, address: 0x80020000, symbol: "library_function" },
    ]);
    expect(
      resolveCalls(verdict, verdictIndex({ functions: [verdict] })),
    ).toEqual([
      { word: 2, symbol: "helper" },
      { word: 6, symbol: "library_function" },
    ]);
  });

  it("is empty for a function that calls nothing", () => {
    const verdict = exact("leaf", []);
    expect(
      resolveCalls(verdict, verdictIndex({ functions: [verdict] })),
    ).toEqual([]);
  });

  it("fails on a call that no relocation names", () => {
    const verdict = exact("caller", [{ word: 2, address: 0x80010000 }]);
    expect(() =>
      resolveCalls(verdict, verdictIndex({ functions: [verdict] })),
    ).toThrow(/caller word 2 is a call that no relocation names/);
  });

  it("fails when exact functions call one address by two names", () => {
    const verdict = exact("caller", [
      { word: 2, address: 0x80010000, symbol: "helper" },
    ]);
    const other = exact("other", [
      { word: 1, address: 0x80010000, symbol: "renamed_helper" },
    ]);
    expect(() =>
      resolveCalls(verdict, verdictIndex({ functions: [verdict, other] })),
    ).toThrow(/by 2 names: helper, renamed_helper/);
  });

  it("ignores a call another function leaves unnamed", () => {
    const verdict = exact("caller", [
      { word: 2, address: 0x80010000, symbol: "helper" },
    ]);
    const other = exact("other", [{ word: 1, address: 0x80010000 }]);
    expect(
      resolveCalls(verdict, verdictIndex({ functions: [verdict, other] })),
    ).toEqual([{ word: 2, symbol: "helper" }]);
  });

  it("ignores the names a mismatched function would give", () => {
    const verdict = exact("caller", [
      { word: 2, address: 0x80010000, symbol: "helper" },
    ]);
    const mismatched: FunctionVerdict = {
      ...exact("other", [{ word: 1, address: 0x80010000, symbol: "wrong" }]),
      verdict: "mismatch",
    };
    expect(
      resolveCalls(verdict, verdictIndex({ functions: [verdict, mismatched] })),
    ).toEqual([{ word: 2, symbol: "helper" }]);
  });
});
