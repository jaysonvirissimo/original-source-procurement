import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeImportIndex } from "./artifacts.ts";
import {
  DECODE_USAGE,
  SPANS_USAGE,
  runDecodeCommand,
  runSpansCommand,
} from "./authoringCommands.ts";
import type { GitReader } from "./checkout.ts";
import { MISSING_CHECKOUTS } from "./cli.ts";
import { sha256Hex } from "./hash.ts";
import type { FunctionRecord } from "./records.ts";
import {
  functionRecord,
  importIndex,
  PRE_MATCH_COMMIT,
  UPSTREAM_COMMIT,
} from "./testing.ts";

/*
 * The upstream repository is a map of `commit:path` to OSP-authored
 * placeholder text. Nothing here is drawn from a real file.
 */

const config = {
  importerVersion: "1.0.0",
  upstreamCommit: UPSTREAM_COMMIT,
  sdkCommit: "2".repeat(40),
};

const SOURCE = [
  '#include "sample.h"',
  "",
  "int sample_function(int limit)",
  "{",
  "    return limit + 1;",
  "}",
  "",
].join("\n");

const TARGET = "\tdw 0x03E00008 ; 80016EF8\n\tdw 0x00000000 ; 80016EFC\n";

function reader(files: Record<string, string>): GitReader {
  const encoder = new TextEncoder();
  return {
    blob: (commit, path) => {
      const text = files[`${commit}:${path}`];
      return Promise.resolve(
        text === undefined ? undefined : encoder.encode(text),
      );
    },
    paths: () => Promise.resolve([]),
    resolve: () => Promise.resolve(undefined),
    deletions: () => Promise.resolve([]),
  };
}

function output() {
  return {
    log: vi.fn<(line: string) => void>(),
    error: vi.fn<(line: string) => void>(),
  };
}

const upstream = reader({
  [`${UPSTREAM_COMMIT}:source/sample/sample.c`]: SOURCE,
  [`${UPSTREAM_COMMIT}:source/sample/bare.c`]: "int bare(void) { return 0; }",
  [`${PRE_MATCH_COMMIT}:asm/sample/sample_function_80016EF8.s`]: TARGET,
});

describe("runSpansCommand", () => {
  it("prints the file hash, the span, and the signature", async () => {
    const out = output();
    await expect(
      runSpansCommand(
        upstream,
        config,
        ["sample_function", "source/sample/sample.c"],
        out,
      ),
    ).resolves.toBe(0);
    const lines = out.log.mock.calls.map(([line]) => line);
    expect(lines).toContain("sample_function  source/sample/sample.c");
    expect(lines).toContain(`  commit      : ${UPSTREAM_COMMIT}`);
    expect(lines).toContain(`  file sha256 : ${sha256Hex(SOURCE)}`);
    expect(lines).toContain(
      `  bytes       : ${String(new TextEncoder().encode(SOURCE).byteLength)}   lines: 6`,
    );
    expect(lines).toContain("  span        : 3..6   (4 lines)");
    expect(lines).toContain("  signature   : int sample_function(int limit)");
    expect(out.error).not.toHaveBeenCalled();
  });

  it("counts the lines of a file without a final newline", async () => {
    const out = output();
    await expect(
      runSpansCommand(upstream, config, ["bare", "source/sample/bare.c"], out),
    ).resolves.toBe(0);
    const lines = out.log.mock.calls.map(([line]) => line);
    expect(lines).toContain("  bytes       : 28   lines: 1");
    expect(lines).toContain("  span        : 1..1   (1 lines)");
  });

  it("fails when a file is absent or does not define the symbol", async () => {
    const out = output();
    await expect(
      runSpansCommand(
        upstream,
        config,
        [
          "sample_function",
          "source/sample/missing.c",
          "other_function",
          "source/sample/sample.c",
        ],
        out,
      ),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      `source/sample/missing.c: not in mgs_reversing at ${UPSTREAM_COMMIT}.`,
    );
    expect(out.error).toHaveBeenCalledWith(
      "  span        : other_function is not defined in this file.",
    );
  });

  it("explains missing checkouts and odd arguments", async () => {
    const out = output();
    await expect(
      runSpansCommand(undefined, config, ["sample_function", "x"], out),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(MISSING_CHECKOUTS);
    await expect(
      runSpansCommand(upstream, config, ["sample_function"], out),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(SPANS_USAGE);
  });
});

describe("runDecodeCommand", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "osp-decode-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("decodes the words of each symbol's pinned target", async () => {
    await writeImportIndex(importIndex(), root);
    const out = output();
    await expect(
      runDecodeCommand(upstream, ["sample_function"], out, root),
    ).resolves.toBe(0);
    const lines = out.log.mock.calls.map(([line]) => line);
    expect(lines).toContain("sample_function  (2 rows)");
    expect(lines.some((line) => /row {3}0 {2}jr /.test(line))).toBe(true);
  });

  it("fails for a symbol without a pinned target or with a missing file", async () => {
    const unpinned = Object.fromEntries(
      Object.entries(functionRecord()).filter(([key]) => key !== "pinned"),
    ) as FunctionRecord;
    await writeImportIndex(
      importIndex({
        functions: [functionRecord(), { ...unpinned, symbol: "unpinned" }],
      }),
      root,
    );
    const out = output();
    await expect(
      runDecodeCommand(
        reader({}),
        ["unpinned", "sample_function", "unknown"],
        out,
        root,
      ),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      "unpinned: the last import pinned no target for it.",
    );
    expect(out.error).toHaveBeenCalledWith(
      `sample_function: asm/sample/sample_function_80016EF8.s is not in mgs_reversing at ${PRE_MATCH_COMMIT}.`,
    );
    expect(out.error).toHaveBeenCalledWith(
      "unknown: the last import pinned no target for it.",
    );
  });

  it("explains missing checkouts, arguments, and an import that never ran", async () => {
    const out = output();
    await expect(
      runDecodeCommand(undefined, ["sample_function"], out, root),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(MISSING_CHECKOUTS);
    await expect(runDecodeCommand(upstream, [], out, root)).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(DECODE_USAGE);
    await expect(
      runDecodeCommand(upstream, ["sample_function"], out, root),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      expect.stringMatching(/Run pnpm corpus:import first\.$/),
    );
  });
});
