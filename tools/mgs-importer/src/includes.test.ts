import { describe, expect, it } from "vitest";
import {
  directoryOf,
  includeClosure,
  includeDirectives,
  normalizePath,
  upstreamFileOf,
  type ReadUpstream,
} from "./includes.ts";

describe("includeDirectives", () => {
  it("reads angle and quoted includes, in order", () => {
    expect(
      includeDirectives('#include <libgte.h>\n#include "libgv.h"\n'),
    ).toEqual([
      { name: "libgte.h", quoted: false },
      { name: "libgv.h", quoted: true },
    ]);
  });

  it("allows space around the hash and the keyword", () => {
    expect(includeDirectives("  #  include <sys/types.h>")).toEqual([
      { name: "sys/types.h", quoted: false },
    ]);
  });

  it("ignores a line that only mentions include", () => {
    expect(includeDirectives("/* include <x.h> */\nint f(void);")).toEqual([]);
  });
});

describe("normalizePath", () => {
  it("collapses dot and dot-dot segments", () => {
    expect(normalizePath("source/./libgv/../include/common.h")).toBe(
      "source/include/common.h",
    );
  });

  it("is empty for a path that escapes the root", () => {
    expect(normalizePath("../secrets")).toBe("");
  });
});

describe("directoryOf", () => {
  it("keeps the trailing slash", () => {
    expect(directoryOf("source/libgv/util.c")).toBe("source/libgv/");
  });

  it("is empty for a bare file name", () => {
    expect(directoryOf("util.c")).toBe("");
  });
});

describe("upstreamFileOf", () => {
  it("maps the SDK prefix onto the SDK include directory", () => {
    expect(upstreamFileOf("psyq/include/sys/types.h", "source/libgv/")).toEqual(
      {
        repository: "FoxdieTeam/psyq_sdk",
        path: "psyq_4.4/include/sys/types.h",
      },
    );
  });

  it("keeps an upstream path as it is", () => {
    expect(upstreamFileOf("source/include/common.h", "source/libgv/")).toEqual({
      repository: "FoxdieTeam/mgs_reversing",
      path: "source/include/common.h",
    });
  });

  it("resolves a bare name against the compiled file's own directory", () => {
    expect(upstreamFileOf("libgv.h", "source/libgv/")).toEqual({
      repository: "FoxdieTeam/mgs_reversing",
      path: "source/libgv/libgv.h",
    });
  });
});

const FILES: Record<string, string> = {
  "FoxdieTeam/mgs_reversing:source/libgv/libgv.h":
    '#include <libgte.h>\n#include "vector.h"\n',
  "FoxdieTeam/mgs_reversing:source/libgv/vector.h": "typedef int VEC;\n",
  "FoxdieTeam/mgs_reversing:source/include/common.h": "#include <stddef.h>\n",
  "FoxdieTeam/psyq_sdk:psyq_4.4/include/libgte.h": "#include <sys/types.h>\n",
  "FoxdieTeam/psyq_sdk:psyq_4.4/include/sys/types.h": "typedef int u_long;\n",
  "FoxdieTeam/psyq_sdk:psyq_4.4/include/stddef.h": "#define NULL 0\n",
};

const read: ReadUpstream = (repository, path) =>
  Promise.resolve(
    Object.hasOwn(FILES, `${repository}:${path}`)
      ? new TextEncoder().encode(FILES[`${repository}:${path}`])
      : undefined,
  );

describe("includeClosure", () => {
  it("resolves quoted, angle, and transitive includes", async () => {
    const closure = await includeClosure(
      "source/libgv/util.c",
      '#include "libgv.h"\n#include <common.h>\n',
      read,
    );
    expect(closure.map((entry) => entry.key)).toEqual([
      "libgv.h",
      "psyq/include/libgte.h",
      "psyq/include/stddef.h",
      "psyq/include/sys/types.h",
      "source/include/common.h",
      "vector.h",
    ]);
  });

  it("keys a header beside the compiled file by its bare name", async () => {
    const closure = await includeClosure(
      "source/libgv/util.c",
      '#include "libgv.h"\n',
      read,
    );
    expect(closure.find((entry) => entry.key === "libgv.h")?.path).toBe(
      "source/libgv/libgv.h",
    );
  });

  it("resolves a quoted include relative to the including header", async () => {
    const closure = await includeClosure(
      "source/libgv/util.c",
      '#include "libgv.h"\n',
      read,
    );
    expect(closure.map((entry) => entry.key)).toContain("vector.h");
  });

  it("skips a directive that resolves to no file in either checkout", async () => {
    const closure = await includeClosure(
      "source/libgv/util.c",
      "#include <absent.h>\n",
      read,
    );
    expect(closure).toEqual([]);
  });

  it("stops on a cycle", async () => {
    const cyclic: ReadUpstream = (_, path) =>
      Promise.resolve(
        path === "source/a.h" || path === "source/b.h"
          ? new TextEncoder().encode(
              `#include <${path === "source/a.h" ? "b" : "a"}.h>\n`,
            )
          : undefined,
      );
    const closure = await includeClosure(
      "source/x.c",
      "#include <a.h>\n",
      cyclic,
    );
    expect(closure.map((entry) => entry.key)).toEqual([
      "source/a.h",
      "source/b.h",
    ]);
  });

  it("carries each header's bytes so the caller can hash them", async () => {
    const closure = await includeClosure(
      "source/libgv/util.c",
      "#include <common.h>\n",
      read,
    );
    const common = closure.find(
      (entry) => entry.key === "source/include/common.h",
    );
    expect(new TextDecoder().decode(common?.bytes)).toContain("stddef.h");
  });
});
