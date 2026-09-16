import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readImportIndex,
  reviewReportPath,
  updateReportPath,
  writeImportIndex,
  writeVerdictIndex,
} from "./artifacts.ts";
import {
  runImportCommand,
  runUpdateCommand,
  runWriteCommand,
  messageOf,
  MISSING_CHECKOUTS,
} from "./cli.ts";
import { CORPUS_MODULE_PATH } from "./corpus.ts";
import { OVERRIDES_PATH } from "./overrides.ts";
import { importIndex, verdictIndex, UPSTREAM_COMMIT } from "./testing.ts";

/*
 * The commands are driven against temporary directories: a repository root
 * they write into, and a small git repository shaped like upstream that they
 * read. They never touch the pinned upstream clones, so they run anywhere.
 */

const config = {
  importerVersion: "1.0.0",
  upstreamCommit: UPSTREAM_COMMIT,
  sdkCommit: "2".repeat(40),
};

const checkouts = { mgsReversing: ".", psyqSdk: "." };

const run = promisify(execFile);

const TARGET = "\tdw 0x03E00008 ; 80016EF8\n\tdw 0x00000000 ; 80016EFC\n";

const LINKER = String.raw`
{% if not VR_EXE %}
    include "{{OBJ_DIR}}\libgv\util.obj"
{% endif %}
`;

/**
 * A git repository shaped like upstream: an inventory, a linker command
 * file, one source file, and one assembly target that a later commit removes.
 */
async function upstreamRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "osp-corpus-upstream-"));
  const git = (...args: string[]) => run("git", ["-C", directory, ...args]);

  await git("init", "--quiet", "--initial-branch", "main");
  await git("config", "user.email", "test@example.invalid");
  await git("config", "user.name", "Test");

  const write = async (path: string, contents: string) => {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), contents);
  };

  await write("build/functions.txt", "80016EF8 8 f\n");
  await write("build/linker_command_file.txt", LINKER);
  await write("source/libgv/util.c", "int f(void) { return 0; }\n");
  await write("asm/libgv/f_80016EF8.s", TARGET);
  await git("add", "-A");
  await git("commit", "--quiet", "-m", "Add the function's assembly");

  await rm(join(directory, "asm/libgv/f_80016EF8.s"));
  await git("add", "-A");
  await git("commit", "--quiet", "-m", "Match the function");

  return directory;
}
const corpus = {
  schemaVersion: 1 as const,
  importerVersion: "1.0.0",
  upstreamCommit: UPSTREAM_COMMIT,
  sdkCommit: "2".repeat(40),
  missions: [],
};

function output() {
  return { log: vi.fn(), error: vi.fn() };
}

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "osp-corpus-cli-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function put(path: string, contents: string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), contents);
}

describe("messageOf", () => {
  it("takes an error's message", () => {
    expect(messageOf(new Error("no inventory"))).toBe("no inventory");
  });

  it("describes something thrown that is not an error", () => {
    expect(messageOf("no inventory")).toBe("no inventory");
  });
});

describe("runImportCommand", () => {
  it("explains what to set when the checkouts are not configured", async () => {
    const out = output();
    await expect(runImportCommand(undefined, config, out, root)).resolves.toBe(
      1,
    );
    expect(out.error).toHaveBeenCalledWith(MISSING_CHECKOUTS);
  });

  it("reports the failure when the checkout has no inventory", async () => {
    const out = output();
    await expect(runImportCommand(checkouts, config, out, root)).resolves.toBe(
      1,
    );
    expect(out.error).toHaveBeenCalledWith(
      expect.stringContaining("is missing at"),
    );
  });

  it("imports pointers and writes the index and the report", async () => {
    const upstream = await upstreamRepository();
    try {
      const out = output();
      const at = { ...config, upstreamCommit: "HEAD" };
      await expect(
        runImportCommand(
          { mgsReversing: upstream, psyqSdk: upstream },
          at,
          out,
          root,
        ),
      ).resolves.toBe(0);

      const index = await readImportIndex(root);
      expect(index.files.map((file) => file.path)).toEqual([
        "source/libgv/util.c",
      ]);
      expect(index.functions[0]?.pinned?.target.wordCount).toBe(2);
      await expect(
        readFile(join(root, reviewReportPath("HEAD")), "utf8"),
      ).resolves.toContain("with a pinned target: 1");
      expect(out.log).toHaveBeenCalledWith(
        expect.stringContaining("1 pinned targets"),
      );
    } finally {
      await rm(upstream, { recursive: true, force: true });
    }
  });
});

describe("runWriteCommand", () => {
  const verbatim = (contents: string) => contents;

  beforeEach(async () => {
    await writeImportIndex(importIndex(), root);
    await writeVerdictIndex(verdictIndex(), root);
    await put(OVERRIDES_PATH, '{"schemaVersion":1,"missions":[]}');
  });

  it("writes the generated corpus module", async () => {
    const out = output();
    await expect(runWriteCommand(verbatim, out, root)).resolves.toBe(0);
    const text = await readFile(join(root, CORPUS_MODULE_PATH), "utf8");
    expect(text).toContain("export const pointerCorpus");
    expect(out.log).toHaveBeenCalledWith(`wrote ${CORPUS_MODULE_PATH}`);
  });

  it("leaves the module alone when a rebuild would not change it", async () => {
    await runWriteCommand(verbatim, output(), root);
    const out = output();
    await expect(runWriteCommand(verbatim, out, root)).resolves.toBe(0);
    expect(out.log).toHaveBeenCalledWith(`${CORPUS_MODULE_PATH}: unchanged`);
  });

  it("formats the module with the formatter it is given", async () => {
    const out = output();
    await runWriteCommand((contents) => `// formatted\n${contents}`, out, root);
    await expect(
      readFile(join(root, CORPUS_MODULE_PATH), "utf8"),
    ).resolves.toContain("// formatted");
  });

  it("reports a reviewed mission that was not imported", async () => {
    await put(
      OVERRIDES_PATH,
      JSON.stringify({
        schemaVersion: 1,
        missions: [
          {
            symbol: "absent_function",
            id: "R001",
            title: "SAMPLE",
            phase: "Field work",
            kind: "real-solved",
            scaffold: "field",
            requires: [],
            practices: [],
            briefing: { objective: "Match it." },
            starterSource: "",
            hints: [],
            reviewedAt: "2026-09-15",
          },
        ],
      }),
    );
    const out = output();
    await expect(runWriteCommand(verbatim, out, root)).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      expect.stringContaining("not imported from this checkout"),
    );
  });

  it("reports a missing import index instead of writing an empty corpus", async () => {
    await rm(join(root, "tmp"), { recursive: true, force: true });
    const out = output();
    await expect(runWriteCommand(verbatim, out, root)).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      expect.stringContaining("pnpm corpus:import"),
    );
  });
});

describe("runUpdateCommand", () => {
  it("explains what to set when the checkouts are not configured", async () => {
    const out = output();
    await expect(
      runUpdateCommand(undefined, config, corpus, out, root),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(MISSING_CHECKOUTS);
  });

  it("refuses to compare a checkout against itself", async () => {
    await writeImportIndex(importIndex(), root);
    const out = output();
    await expect(
      runUpdateCommand(checkouts, config, corpus, out, root),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      expect.stringContaining("already at"),
    );
  });

  it("reports the failure when the newer checkout cannot be read", async () => {
    await writeImportIndex(
      importIndex({ upstreamCommit: "8".repeat(40) }),
      root,
    );
    const out = output();
    await expect(
      runUpdateCommand(checkouts, config, corpus, out, root),
    ).resolves.toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      expect.stringContaining("is missing at"),
    );
  });

  it("reports what a repin would change, and changes nothing itself", async () => {
    const upstream = await upstreamRepository();
    try {
      const before = importIndex({
        upstreamCommit: "8".repeat(40),
        functions: [],
      });
      await writeImportIndex(before, root);

      const out = output();
      await expect(
        runUpdateCommand(
          { mgsReversing: upstream, psyqSdk: upstream },
          { ...config, upstreamCommit: "HEAD" },
          corpus,
          out,
          root,
        ),
      ).resolves.toBe(0);

      const report = await readFile(
        join(root, updateReportPath("HEAD")),
        "utf8",
      );
      expect(report).toContain("# Corpus update");
      expect(report).toContain("### added (1)");
      expect(report).toContain("- f — SOLVED");
      // The last import is the baseline, so adopting a repin stays deliberate.
      expect(await readImportIndex(root)).toEqual(before);
    } finally {
      await rm(upstream, { recursive: true, force: true });
    }
  });
});
