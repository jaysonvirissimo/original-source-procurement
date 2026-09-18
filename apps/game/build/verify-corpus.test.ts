import type { FunctionVerdict } from "@osp/mgs-importer";
import {
  fileRecord,
  functionRecord,
  importIndex,
} from "@osp/mgs-importer/testing";
import { describe, expect, it, vi } from "vitest";
import { assembledObject, fakeToolchain } from "../src/test/fakeToolchain";
import type { UpstreamService } from "../src/features/upstream/types";
import {
  loadTargets,
  markAmbiguous,
  verifyCorpus,
  verifyFile,
} from "./verify-corpus";

// OSP-authored placeholder words; they stand for a target, not for one.
const WORDS = [0x03e00008, 0x00000000];
const SOURCE = "int f(void) { return 0; }\n";

function upstream(overrides: Partial<UpstreamService> = {}): UpstreamService {
  return {
    loadTarget: () =>
      Promise.resolve({ kind: "loaded", value: WORDS, source: "cache" }),
    loadC: () =>
      Promise.resolve({ kind: "loaded", value: SOURCE, source: "cache" }),
    clearCache: () => Promise.resolve(),
    ...overrides,
  };
}

const built = fakeToolchain({
  kind: "success",
  object: assembledObject(WORDS),
  compilerText: "",
  diagnostics: [],
});

const targets = new Map([["f", { words: WORDS, address: 0x80010000 }]]);

describe("verifyFile", () => {
  it("reports an exact match when the built words are the target's", async () => {
    const result = await verifyFile(fileRecord(), targets, built, upstream());
    expect(result.file.outcome).toBe("built");
    expect(result.file.definedFunctions).toBe(1);
    expect(result.functions).toEqual([
      {
        symbol: "f",
        sourcePath: "source/sample/sample.c",
        verdict: "exact",
        calls: [],
      },
    ]);
  });

  it("records each call in an exact function, named by the built relocation", async () => {
    // OSP-authored words: a linked jal to 0x80010040 from a function at
    // 0x80010000, and the same call unlinked, with its relocation.
    const linked = [0x0c004010, 0x00000000, 0x03e00008, 0x00000000];
    const unlinked = assembledObject([0x0c000000, 0, 0x03e00008, 0]);
    const object = {
      ...unlinked,
      sections: unlinked.sections.map((section) => ({
        ...section,
        relocations: [
          {
            offset: 0,
            kind: "MIPS26" as const,
            fieldMask: 0x03ffffff,
            fieldValue: 0,
            target: { kind: "symbol" as const, name: "helper", addend: 0 },
          },
        ],
      })),
    };
    const result = await verifyFile(
      fileRecord(),
      new Map([["f", { words: linked, address: 0x80010000 }]]),
      fakeToolchain({
        kind: "success",
        object,
        compilerText: "",
        diagnostics: [],
      }),
      upstream(),
    );
    expect(result.functions).toEqual([
      {
        symbol: "f",
        sourcePath: "source/sample/sample.c",
        verdict: "exact",
        calls: [{ word: 0, address: 0x80010040, symbol: "helper" }],
      },
    ]);
  });

  it("records a call that no relocation names without a name", async () => {
    // OSP-authored words: a jal whose field was never relocated.
    const words = [0x0c000000, 0x00000000, 0x03e00008, 0x00000000];
    const result = await verifyFile(
      fileRecord(),
      new Map([["f", { words, address: 0x80010000 }]]),
      fakeToolchain({
        kind: "success",
        object: assembledObject(words),
        compilerText: "",
        diagnostics: [],
      }),
      upstream(),
    );
    expect(result.functions[0]).toMatchObject({
      verdict: "exact",
      calls: [{ word: 0, address: 0x80000000 }],
    });
    expect(result.functions[0]?.calls?.[0]).not.toHaveProperty("symbol");
  });

  it("reports a mismatch with the kinds that explain it, sorted", async () => {
    // A different immediate and an instruction the target does not have.
    const other = fakeToolchain({
      kind: "success",
      object: assembledObject([0x03e00008, 0x24020005, 0x24030006]),
      compilerText: "",
      diagnostics: [],
    });
    const result = await verifyFile(fileRecord(), targets, other, upstream());
    const kinds = result.functions[0]?.mismatchKinds ?? [];
    expect(result.functions[0]?.verdict).toBe("mismatch");
    expect(kinds.length).toBeGreaterThan(1);
    expect(kinds).toEqual([...kinds].sort((a, b) => a.localeCompare(b)));
  });

  it("checks only the functions this run has a target for", async () => {
    const result = await verifyFile(fileRecord(), new Map(), built, upstream());
    expect(result.functions).toEqual([]);
    expect(result.file.outcome).toBe("built");
  });

  it("does not build a source that includes assembly files", async () => {
    const service = fakeToolchain();
    const result = await verifyFile(
      fileRecord({ includesAssembly: true }),
      targets,
      service,
      upstream(),
    );
    expect(result.file.outcome).toBe("unsupported");
    expect(service.build).not.toHaveBeenCalled();
  });

  it("reports a source that cannot be loaded", async () => {
    const result = await verifyFile(
      fileRecord(),
      targets,
      built,
      upstream({
        loadC: () => Promise.resolve({ kind: "unavailable", attempts: [] }),
      }),
    );
    expect(result.file).toMatchObject({
      outcome: "build-failed",
      detail: "source unavailable",
    });
  });

  it("reports context that cannot be resolved, naming the path", async () => {
    const result = await verifyFile(
      fileRecord(),
      targets,
      built,
      upstream({
        loadC: (reference) =>
          Promise.resolve(
            reference.path.endsWith(".h")
              ? { kind: "unavailable", attempts: [] }
              : { kind: "loaded", value: SOURCE, source: "cache" },
          ),
      }),
    );
    expect(result.file.detail).toContain("context unavailable");
    expect(result.file.detail).toContain("psyq/include/sample.h");
  });

  it("reports a build that failed", async () => {
    const failing = fakeToolchain({
      kind: "compiler-failure",
      diagnostics: [],
    });
    const result = await verifyFile(fileRecord(), targets, failing, upstream());
    expect(result.file).toMatchObject({
      outcome: "build-failed",
      detail: "compiler-failure",
    });
  });
});

describe("markAmbiguous", () => {
  const entry = (symbol: string, sourcePath: string): FunctionVerdict => ({
    symbol,
    sourcePath,
    verdict: "exact",
  });

  it("leaves a symbol one file defines alone", () => {
    const only = [entry("f", "a.c")];
    expect(markAmbiguous(only)).toEqual(only);
  });

  it("demotes a symbol two built files define", () => {
    expect(markAmbiguous([entry("f", "a.c"), entry("f", "b.c")])).toEqual([
      {
        symbol: "f",
        sourcePath: "a.c",
        verdict: "ambiguous",
        detail: "2 source files define it",
      },
      {
        symbol: "f",
        sourcePath: "b.c",
        verdict: "ambiguous",
        detail: "2 source files define it",
      },
    ]);
  });

  it("ignores a symbol no file defined when counting", () => {
    const unresolved: FunctionVerdict = {
      symbol: "g",
      sourcePath: "",
      verdict: "function-missing",
    };
    expect(markAmbiguous([entry("f", "a.c"), unresolved])).toEqual([
      entry("f", "a.c"),
      unresolved,
    ]);
  });
});

describe("loadTargets", () => {
  it("loads the words of every pinned function", async () => {
    const words = await loadTargets(importIndex(), upstream(), {});
    expect([...words.keys()]).toEqual(["sample_function"]);
  });

  it("loads only the functions a run asks for", async () => {
    const words = await loadTargets(importIndex(), upstream(), {
      symbols: new Set(["other"]),
    });
    expect(words.size).toBe(0);
  });

  it("skips a function whose target cannot be loaded", async () => {
    const words = await loadTargets(
      importIndex(),
      upstream({
        loadTarget: () =>
          Promise.resolve({ kind: "content-mismatch", attempts: [] }),
      }),
      {},
    );
    expect(words.size).toBe(0);
  });

  it("skips a function with no pinned target", async () => {
    const index = importIndex({
      functions: [
        {
          symbol: "unpinned",
          address: 1,
          size: 4,
          status: "SOLVED",
          rejection: { reason: "no-deletion" },
        },
      ],
    });
    expect((await loadTargets(index, upstream(), {})).size).toBe(0);
  });
});

describe("verifyCorpus", () => {
  const index = importIndex({
    files: [fileRecord()],
    functions: [functionRecord({ symbol: "f" })],
  });

  it("verifies every pinned function and reports progress", async () => {
    const log = vi.fn();
    const verdicts = await verifyCorpus(index, built, upstream(), { log });
    expect(verdicts.functions).toEqual([
      {
        symbol: "f",
        sourcePath: "source/sample/sample.c",
        verdict: "exact",
        calls: [],
      },
    ]);
    expect(verdicts.files).toHaveLength(1);
    expect(verdicts.upstreamCommit).toBe(index.upstreamCommit);
    expect(log).toHaveBeenCalledWith("loaded 1 target word lists");
  });

  it("orders the verdicts by symbol, so a rerun never reshuffles them", async () => {
    const two = importIndex({
      files: [fileRecord()],
      functions: [
        functionRecord({ symbol: "zzz" }),
        functionRecord({ symbol: "aaa" }),
      ],
    });
    const verdicts = await verifyCorpus(two, built, upstream(), {
      log: vi.fn(),
    });
    expect(verdicts.functions.map((entry) => entry.symbol)).toEqual([
      "aaa",
      "zzz",
    ]);
  });

  it("reports a pinned function that no built source defines", async () => {
    const elsewhere = importIndex({
      files: [fileRecord()],
      functions: [functionRecord({ symbol: "absent" })],
    });
    const verdicts = await verifyCorpus(elsewhere, built, upstream(), {
      log: vi.fn(),
    });
    expect(verdicts.functions).toEqual([
      {
        symbol: "absent",
        sourcePath: "",
        verdict: "function-missing",
        detail: "no built source file defines it",
      },
    ]);
  });

  it("logs after every fiftieth source file", async () => {
    const many = importIndex({
      files: Array.from({ length: 50 }, (_, position) =>
        fileRecord({ path: `source/sample/f${String(position)}.c` }),
      ),
      functions: [],
    });
    const log = vi.fn();
    await verifyCorpus(many, built, upstream(), { log });
    expect(log).toHaveBeenCalledWith("built 50 of 50 source files");
  });
});
