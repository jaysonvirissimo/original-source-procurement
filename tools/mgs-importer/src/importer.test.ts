import { describe, expect, it, vi } from "vitest";
import type { GitDeletion, GitReader } from "./checkout.ts";
import {
  compilerSettingsFor,
  createUpstreamReader,
  importFiles,
  importFunctions,
  importTarget,
  runImport,
} from "./importer.ts";
import { deletionsByName } from "./history.ts";
import { SDK_COMMIT, UPSTREAM_COMMIT } from "./testing.ts";

const config = {
  importerVersion: "1.0.0",
  upstreamCommit: UPSTREAM_COMMIT,
  sdkCommit: SDK_COMMIT,
};

const silent = { log: () => undefined };
const encode = (text: string) => new TextEncoder().encode(text);

const TARGET = "\tdw 0x03E00008 ; 80016EF8\n\tdw 0x00000000 ; 80016EFC\n";

/** A git reader over a fixed set of blobs, deletions, and revisions. */
function reader(options: {
  blobs?: Record<string, string>;
  paths?: readonly string[];
  deletions?: readonly GitDeletion[];
  parents?: Record<string, string>;
}): GitReader {
  const blobs = options.blobs ?? {};
  return {
    blob: (commit, path) => {
      const contents = blobs[`${commit}:${path}`];
      return Promise.resolve(
        contents === undefined ? undefined : encode(contents),
      );
    },
    paths: () => Promise.resolve(options.paths ?? []),
    resolve: (revision) => Promise.resolve(options.parents?.[revision]),
    deletions: () => Promise.resolve(options.deletions ?? []),
  };
}

describe("createUpstreamReader", () => {
  it("reads each file once and sends it to the right checkout", async () => {
    const upstream = reader({
      blobs: { [`${UPSTREAM_COMMIT}:a.c`]: "int a;" },
    });
    const sdk = reader({ blobs: { [`${SDK_COMMIT}:b.h`]: "int b;" } });
    const upstreamBlob = vi.spyOn(upstream, "blob");
    const read = createUpstreamReader({ upstream, sdk }, config);

    expect(await read("FoxdieTeam/mgs_reversing", "a.c")).toBeDefined();
    expect(await read("FoxdieTeam/mgs_reversing", "a.c")).toBeDefined();
    expect(upstreamBlob).toHaveBeenCalledTimes(1);
    expect(await read("FoxdieTeam/psyq_sdk", "b.h")).toBeDefined();
  });
});

describe("compilerSettingsFor", () => {
  it("uses upstream's default build and the file's own small-data size", () => {
    const settings = compilerSettingsFor("source/libgv/util.c", {});
    expect(settings.gpSize).toBe(8);
    expect(settings.aspsxVersion).toBe("2.77");
    expect(settings.encoding).toBe("eucjp");
    expect(settings.filename).toBe("util.c");
    expect(settings.headers).toEqual({});
  });
});

describe("importFiles", () => {
  const blobs = {
    [`${UPSTREAM_COMMIT}:source/libgv/util.c`]:
      '#include "libgv.h"\n#include <libgte.h>\n',
    [`${UPSTREAM_COMMIT}:source/libgv/libgv.h`]: "int f(void);\n",
    [`${UPSTREAM_COMMIT}:source/mts/mts_new.c`]: "int g(void);\n",
    [`${UPSTREAM_COMMIT}:source/overlays/brf/b.c`]:
      '#pragma INCLUDE_ASM("asm/overlays/brf/x.s")\n',
  };
  const read = createUpstreamReader(
    {
      upstream: reader({ blobs }),
      sdk: reader({
        blobs: {
          [`${SDK_COMMIT}:psyq_4.4/include/libgte.h`]: "typedef int VEC;\n",
        },
      }),
    },
    config,
  );

  it("resolves each file's context and records its hashes", async () => {
    const files = await importFiles(
      ["source/libgv/util.c"],
      new Set(),
      read,
      config,
      silent,
    );
    expect(files).toHaveLength(1);
    expect(files[0]?.gpSize).toBe(8);
    expect(files[0]?.overlay).toBe("main");
    expect(files[0]?.reference.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(files[0]?.compiler.remoteHeaders ?? {})).toEqual([
      "libgv.h",
      "psyq/include/libgte.h",
    ]);
  });

  it("pins each header to the checkout it came from", async () => {
    const files = await importFiles(
      ["source/libgv/util.c"],
      new Set(),
      read,
      config,
      silent,
    );
    const headers = files[0]?.compiler.remoteHeaders ?? {};
    expect(headers["libgv.h"]?.commit).toBe(UPSTREAM_COMMIT);
    expect(headers["psyq/include/libgte.h"]?.commit).toBe(SDK_COMMIT);
  });

  it("leaves out the sources built with the older toolchain", async () => {
    expect(
      await importFiles(
        ["source/mts/mts_new.c"],
        new Set(),
        read,
        config,
        silent,
      ),
    ).toEqual([]);
  });

  it("leaves out a source the VR disc alone links", async () => {
    expect(
      await importFiles(
        ["source/libgv/util.c"],
        new Set(["source/libgv/util.c"]),
        read,
        config,
        silent,
      ),
    ).toEqual([]);
  });

  it("leaves out a file name the compiler would not take", async () => {
    expect(
      await importFiles(
        ["source/libgv/-odd.c"],
        new Set(),
        read,
        config,
        silent,
      ),
    ).toEqual([]);
  });

  it("skips a path that is not in the tree", async () => {
    expect(
      await importFiles(
        ["source/gone/gone.c"],
        new Set(),
        read,
        config,
        silent,
      ),
    ).toEqual([]);
  });

  it("marks a source that includes assembly files", async () => {
    const files = await importFiles(
      ["source/overlays/brf/b.c"],
      new Set(),
      read,
      config,
      silent,
    );
    expect(files[0]?.includesAssembly).toBe(true);
    expect(files[0]?.overlay).toBe("brf");
  });

  it("reports progress every hundred files", async () => {
    const many = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [
        `${UPSTREAM_COMMIT}:source/many/f${String(index)}.c`,
        "int f(void);\n",
      ]),
    );
    const log = vi.fn();
    await importFiles(
      Object.keys(many).map((key) => key.slice(UPSTREAM_COMMIT.length + 1)),
      new Set(),
      createUpstreamReader(
        { upstream: reader({ blobs: many }), sdk: reader({}) },
        config,
      ),
      config,
      { log },
    );
    expect(log).toHaveBeenCalledWith("resolved context for 100 source files");
  });
});

const entry = { symbol: "f", address: 0x80016ef8, size: 8 };
const deletion = {
  commit: "d".repeat(40),
  paths: ["asm/libgv/f_80016EF8.s"],
};

describe("importTarget", () => {
  const byName = deletionsByName([deletion]);
  const parents = { [`${deletion.commit}^`]: "p".repeat(40) };

  it("pins the target to the commit before the file was removed", async () => {
    const upstream = reader({
      parents,
      blobs: { [`${"p".repeat(40)}:asm/libgv/f_80016EF8.s`]: TARGET },
    });
    const result = await importTarget(entry, upstream, byName);
    expect(result.pinned?.target.commit).toBe("p".repeat(40));
    expect(result.pinned?.target.wordCount).toBe(2);
    expect(result.pinned?.facts.words).toBe(2);
    expect(result.pinned?.tags).toBeDefined();
  });

  it("rejects a function whose assembly file was never removed", async () => {
    expect(
      (await importTarget(entry, reader({}), deletionsByName([]))).rejection,
    ).toEqual({ reason: "no-deletion" });
  });

  it("rejects a deletion whose parent cannot be resolved", async () => {
    const result = await importTarget(entry, reader({}), byName);
    expect(result.rejection?.reason).toBe("no-parent");
  });

  it("rejects a pin whose file is not at the parent", async () => {
    const result = await importTarget(entry, reader({ parents }), byName);
    expect(result.rejection?.reason).toBe("target-absent");
  });

  it("rejects a pin whose word count disagrees with the inventory", async () => {
    const upstream = reader({
      parents,
      blobs: { [`${"p".repeat(40)}:asm/libgv/f_80016EF8.s`]: TARGET },
    });
    const result = await importTarget({ ...entry, size: 44 }, upstream, byName);
    expect(result.rejection).toEqual({
      reason: "word-count",
      detail: "found 2, expected 11",
    });
  });

  it("rejects a pin whose file holds no words", async () => {
    const upstream = reader({
      parents,
      blobs: { [`${"p".repeat(40)}:asm/libgv/f_80016EF8.s`]: "\txdef f\n" },
    });
    expect((await importTarget(entry, upstream, byName)).rejection).toEqual({
      reason: "no-words",
      detail: "asm/libgv/f_80016EF8.s",
    });
  });
});

describe("importFunctions", () => {
  const inventory = "80016EF8 8 f\n80016F00 8 live_f\n";

  it("pins solved functions and marks the ones still unmatched", async () => {
    const upstream = reader({
      blobs: {
        [`${UPSTREAM_COMMIT}:build/functions.txt`]: inventory,
        [`${"p".repeat(40)}:asm/libgv/f_80016EF8.s`]: TARGET,
      },
      parents: { [`${deletion.commit}^`]: "p".repeat(40) },
      deletions: [deletion],
    });
    const records = await importFunctions(
      upstream,
      config,
      ["asm/libgv/live_f_80016F00.s"],
      silent,
    );
    expect(records.map((record) => [record.symbol, record.status])).toEqual([
      ["f", "SOLVED"],
      ["live_f", "LIVE"],
    ]);
    expect(records[0]?.pinned).toBeDefined();
    expect(records[1]?.rejection).toEqual({ reason: "still-unmatched" });
  });

  it("refuses to pin a name upstream uses twice", async () => {
    const upstream = reader({
      blobs: {
        [`${UPSTREAM_COMMIT}:build/functions.txt`]:
          "80016EF8 8 f\n80016F00 8 f\n",
      },
    });
    const records = await importFunctions(upstream, config, [], silent);
    expect(
      records.every(
        (record) => record.rejection?.reason === "duplicate-symbol",
      ),
    ).toBe(true);
  });

  it("fails when the inventory is missing from the checkout", async () => {
    await expect(
      importFunctions(reader({}), config, [], silent),
    ).rejects.toThrow(/functions.txt is missing/);
  });
});

describe("runImport", () => {
  const blobs = {
    [`${UPSTREAM_COMMIT}:build/functions.txt`]: "80016EF8 8 f\n80017000 8 g\n",
    [`${UPSTREAM_COMMIT}:build/linker_command_file.txt`]: String.raw`
{% if not VR_EXE %}
    include "{{OBJ_DIR}}\chara\snake\sna_init.obj"
{% else %}
    include "{{OBJ_DIR}}\chara\snake_vr\sna_init.obj"
{% endif %}
`,
    [`${UPSTREAM_COMMIT}:source/libgv/util.c`]: "int f(void);\n",
    [`${UPSTREAM_COMMIT}:source/game/area.c`]: "int g(void);\n",
    [`${UPSTREAM_COMMIT}:source/chara/snake_vr/sna_init.c`]: "int h(void);\n",
    [`${"p".repeat(40)}:asm/libgv/f_80016EF8.s`]: TARGET,
  };

  const readers = {
    upstream: reader({
      blobs,
      paths: [
        "source/libgv/util.c",
        "source/game/area.c",
        "source/chara/snake_vr/sna_init.c",
        "asm/other/x.s",
        "README.md",
      ],
      deletions: [deletion],
      parents: { [`${deletion.commit}^`]: "p".repeat(40) },
    }),
    sdk: reader({}),
  };

  it("imports files and functions, sorted, at the pinned commits", async () => {
    const index = await runImport(readers, config, silent);
    expect(index.schemaVersion).toBe(1);
    expect(index.upstreamCommit).toBe(UPSTREAM_COMMIT);
    expect(index.sdkCommit).toBe(SDK_COMMIT);
    expect(index.files.map((file) => file.path)).toEqual([
      "source/game/area.c",
      "source/libgv/util.c",
    ]);
    expect(index.functions.map((record) => record.symbol)).toEqual(["f", "g"]);
  });

  it("is deterministic", async () => {
    expect(await runImport(readers, config, silent)).toEqual(
      await runImport(readers, config, silent),
    );
  });

  it("fails when the linker command file is missing", async () => {
    await expect(
      runImport(
        { upstream: reader({ blobs: {}, paths: [] }), sdk: reader({}) },
        config,
        silent,
      ),
    ).rejects.toThrow(/linker_command_file.txt is missing/);
  });
});
