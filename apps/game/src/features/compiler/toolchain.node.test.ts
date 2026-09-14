import { createRequire } from "node:module";
import {
  ASPSX_VERSIONS,
  PSYQ_WASM_DEFAULT_CPP_FLAGS,
  type Mission,
  type RemoteCReference,
} from "@osp/mission-schema";
import {
  PLACEHOLDER_COMMIT,
  PLACEHOLDER_HASH,
  syntheticMission,
} from "@osp/mission-schema/testing";
import { assemble, decode, format, SUPPORTED_ASPSX_VERSIONS } from "psyq-asm";
import { createCompiler, DEFAULT_CPP_FLAGS } from "psyq-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PSYQ_WASM_RELEASE } from "../../../build/psyq-wasm-release.ts";
import type { UpstreamService } from "../upstream/types";
import {
  PSYQ_ASM_VERSION,
  PSYQ_WASM_VENDOR_DIRECTORY,
} from "./browserToolchain";
import { createMissionContextResolver } from "./missionContextResolver";
import {
  createToolchainService,
  type ToolchainDependencies,
} from "./toolchainService";
import type { BuildOutcome, CompilationInput, ToolchainService } from "./types";

// Every C source and header in this file is OSP-authored.

const require = createRequire(import.meta.url);

function packageVersion(name: string): string {
  return (require(`${name}/package.json`) as { version: string }).version;
}

const TINY = "int f(int a) { return a + 5; }\n";

function input(source: string): CompilationInput {
  return {
    filename: "check.c",
    source,
    headers: {},
    cppFlags: PSYQ_WASM_DEFAULT_CPP_FLAGS,
    rawFlags: ["-O2", "-g0", "-Wall"],
    gpSize: 0,
    aspsxVersion: "2.77",
    encoding: "utf8",
  };
}

/** Enough generated functions to take several seconds to compile. */
function generatedSource(functions: number): string {
  return Array.from(
    { length: functions },
    (_, index) =>
      `int osp_f${String(index)}(int a, int b) { int c = a * ${String(index)} + b; if (c > ${String(index)}) { c -= b << 2; } return c ^ ${String(index)}; }\n`,
  ).join("");
}

function success(outcome: BuildOutcome) {
  if (outcome.kind !== "success") {
    throw new Error(`Expected a successful build, got ${outcome.kind}.`);
  }
  return outcome.object;
}

function instructions(outcome: BuildOutcome, symbol: string): string[] {
  const object = success(outcome);
  const range = object.functions.find((entry) => entry.name === symbol);
  const words = object.sections.find(
    (section) => section.name === ".text",
  )?.words;
  if (range === undefined || words === undefined) {
    throw new Error(`The object defines no function named ${symbol}.`);
  }
  return Array.from(words.subarray(range.start, range.end), (word) =>
    format(decode(word)),
  );
}

function realDependencies(
  overrides: Partial<ToolchainDependencies> = {},
): ToolchainDependencies {
  return {
    createCompiler: () => createCompiler(),
    assemble,
    psyqAsmVersion: PSYQ_ASM_VERSION,
    ...overrides,
  };
}

describe("toolchain pins", () => {
  it("keeps mission-schema's default preprocessor flags equal to psyq-wasm's", () => {
    expect(PSYQ_WASM_DEFAULT_CPP_FLAGS).toEqual(DEFAULT_CPP_FLAGS);
  });

  it("keeps mission-schema's assembler versions equal to psyq-asm's", () => {
    expect(ASPSX_VERSIONS).toEqual(SUPPORTED_ASPSX_VERSIONS);
  });

  it("matches the installed package versions and vendor directory", () => {
    expect(packageVersion("psyq-asm")).toBe(PSYQ_ASM_VERSION);
    expect(packageVersion("psyq-wasm")).toBe(PSYQ_WASM_RELEASE.version);
    expect(PSYQ_WASM_VENDOR_DIRECTORY).toBe(PSYQ_WASM_RELEASE.vendorDirectory);
  });
});

describe("the toolchain service with the real compiler and assembler", () => {
  let service: ToolchainService;
  let compilersCreated = 0;

  beforeAll(async () => {
    service = await createToolchainService(
      realDependencies({
        createCompiler: () => {
          compilersCreated += 1;
          return createCompiler();
        },
      }),
    );
  }, 30_000);

  afterAll(() => {
    service.dispose();
  });

  it("compiles and assembles a tiny function into the words ASPSX 2.77 emits", async () => {
    const outcome = await service.build(input(TINY));

    expect(instructions(outcome, "f")).toEqual(["jr $ra", "addiu $v0,$a0,0x5"]);
    expect(service.info).toEqual({
      psyqWasm: {
        psyqVersion: "4.4",
        gccVersion: "2.8.1",
        buildId: PSYQ_WASM_RELEASE.buildIds[0],
        preprocessorBuildId: PSYQ_WASM_RELEASE.buildIds[1],
      },
      psyqAsmVersion: "0.2.0",
    });
  });

  it("returns a syntax error as compiler diagnostics", async () => {
    const outcome = await service.build(
      input("int f(int a) { return a + ; }\n"),
    );

    expect(outcome.kind).toBe("compiler-failure");
    expect(
      outcome.kind === "compiler-failure" &&
        outcome.diagnostics.some(
          (diagnostic) => diagnostic.severity === "error",
        ),
    ).toBe(true);
  });

  it("builds empty source with no function", async () => {
    const object = success(await service.build(input("")));

    expect(object.functions).toEqual([]);
  });

  it("builds source whose only function has a different name", async () => {
    const object = success(
      await service.build(input("int g(int a) { return a; }\n")),
    );

    expect(object.functions.map((entry) => entry.name)).toEqual(["g"]);
  });

  it("accepts a new build after a cancelled one", async () => {
    const controller = new AbortController();
    const cancelled = service.build(
      input(generatedSource(8000)),
      controller.signal,
    );
    controller.abort();

    await expect(cancelled).resolves.toEqual({ kind: "cancelled" });
    expect(instructions(await service.build(input(TINY)), "f")).toHaveLength(2);
  });

  it("reuses its one compiler for every build", () => {
    expect(compilersCreated).toBe(1);
  });

  it("accepts a new build after a timeout", async () => {
    const limited = await createToolchainService(
      realDependencies({ timeoutMs: 1000 }),
    );
    try {
      await expect(
        limited.build(input(generatedSource(20000))),
      ).resolves.toEqual({ kind: "timeout", timeoutMs: 1000 });
      expect(instructions(await limited.build(input(TINY)), "f")).toEqual([
        "jr $ra",
        "addiu $v0,$a0,0x5",
      ]);
    } finally {
      limited.dispose();
    }
  }, 30_000);
});

describe("mission context with the real toolchain", () => {
  let service: ToolchainService;

  beforeAll(async () => {
    service = await createToolchainService(realDependencies());
  }, 30_000);

  afterAll(() => {
    service.dispose();
  });

  function reference(path: string): RemoteCReference {
    return {
      repository: "FoxdieTeam/mgs_reversing",
      commit: PLACEHOLDER_COMMIT,
      path,
      sha256: PLACEHOLDER_HASH,
    };
  }

  function upstreamServing(
    files: Readonly<Record<string, string>>,
  ): UpstreamService {
    return {
      loadC: (ref) => {
        const value = files[ref.path];
        return Promise.resolve(
          value === undefined
            ? { kind: "unavailable", attempts: [] }
            : { kind: "loaded", value, source: "cache" },
        );
      },
      loadTarget: () => Promise.reject(new Error("Not used.")),
      clearCache: () => Promise.resolve(),
    };
  }

  function missionWithOuterHeader(): Mission {
    const mission = syntheticMission();
    return {
      ...mission,
      compiler: {
        ...mission.compiler,
        cppFlags: [...PSYQ_WASM_DEFAULT_CPP_FLAGS, "-Isource/include"],
        rawFlags: ["-O2", "-g0"],
        headers: { "source/include/osp_bias.h": "#define OSP_BIAS 5\n" },
        remoteHeaders: {
          "source/include/osp_outer.h": reference("source/include/osp_outer.h"),
        },
      },
    };
  }

  const SOURCE =
    "#include <osp_outer.h>\nint f(int a) { return a + OSP_BIAS; }\n";

  it("compiles a header that a remote header includes", async () => {
    const resolved = await createMissionContextResolver(
      upstreamServing({
        "source/include/osp_outer.h": '#include "osp_bias.h"\nint f(int a);\n',
      }),
    ).resolve(missionWithOuterHeader(), SOURCE);
    if (resolved.kind !== "ready") {
      throw new Error(`Expected resolved context, got ${resolved.kind}.`);
    }

    expect(Object.keys(resolved.input.headers).sort()).toEqual([
      "source/include/osp_bias.h",
      "source/include/osp_outer.h",
    ]);
    expect(instructions(await service.build(resolved.input), "f")).toEqual([
      "jr $ra",
      "addiu $v0,$a0,0x5",
    ]);
  });

  it("reports a missing transitively included header as compiler diagnostics", async () => {
    const resolved = await createMissionContextResolver(
      upstreamServing({
        "source/include/osp_outer.h":
          '#include "osp_missing.h"\nint f(int a);\n',
      }),
    ).resolve(missionWithOuterHeader(), SOURCE);
    if (resolved.kind !== "ready") {
      throw new Error(`Expected resolved context, got ${resolved.kind}.`);
    }

    const outcome = await service.build(resolved.input);

    expect(outcome.kind).toBe("compiler-failure");
    expect(JSON.stringify(outcome)).toContain("osp_missing.h");
  });
});
