import type { AssembleResult } from "psyq-asm";
import {
  CompilerDisposedError,
  CompileTimeoutError,
  EncodingError,
  type CompileResult,
  type Compiler,
} from "psyq-wasm";
import { describe, expect, it, vi } from "vitest";
import { assembledObject, FAKE_TOOLCHAIN_INFO } from "../../test/fakeToolchain";
import {
  assemblyFilename,
  createToolchainService,
  type ToolchainDependencies,
} from "./toolchainService";
import type { CompilationInput } from "./types";

const INPUT: CompilationInput = {
  filename: "check.c",
  source: "int f(int a) { return a; }\n",
  headers: { "codec.h": "#define OSP_RATE 5\n" },
  cppFlags: ["-D_PSYQ", "-Isource"],
  rawFlags: ["-O2", "-g0"],
  gpSize: 8,
  aspsxVersion: "2.77",
  encoding: "eucjp",
};

const ASM = new TextEncoder().encode("\tjr\t$31\r\n");
const PREPROCESSED = new TextEncoder().encode("int f(int a) { return a; }\n");
const TIMINGS = { instantiateMs: 0, compileMs: 0, totalMs: 0 };

function compiled(): CompileResult {
  return {
    success: true,
    exitCode: 0,
    asm: ASM,
    text: "\tjr\t$31\n",
    preprocessed: PREPROCESSED,
    diagnostics: [{ severity: "warning", message: "unused" }],
    rawStdout: "",
    rawStderr: "",
    compiler: FAKE_TOOLCHAIN_INFO.psyqWasm,
    timings: TIMINGS,
  };
}

type CompileSource = Compiler["compileSource"];

function fakeCompiler(compileSource: CompileSource) {
  return {
    info: FAKE_TOOLCHAIN_INFO.psyqWasm,
    compileSource: vi.fn(compileSource),
    compilePreprocessed: vi.fn<Compiler["compilePreprocessed"]>(),
    dispose: vi.fn(),
  };
}

const OBJECT = assembledObject([0x03e00008, 0]);
const assembled: AssembleResult = {
  success: true,
  object: OBJECT,
  diagnostics: [],
};

function dependencies(
  compiler: Compiler,
  overrides: Partial<ToolchainDependencies> = {},
): ToolchainDependencies {
  return {
    createCompiler: () => Promise.resolve(compiler),
    assemble: vi.fn(() => assembled),
    psyqAsmVersion: "0.2.0",
    ...overrides,
  };
}

describe("createToolchainService", () => {
  it("creates one compiler and reuses it for every build", async () => {
    const compiler = fakeCompiler(() => Promise.resolve(compiled()));
    const createCompiler = vi.fn(() => Promise.resolve(compiler));

    const service = await createToolchainService(
      dependencies(compiler, { createCompiler }),
    );
    await service.build(INPUT);
    await service.build(INPUT);

    expect(createCompiler).toHaveBeenCalledTimes(1);
    expect(compiler.compileSource).toHaveBeenCalledTimes(2);
    expect(service.info).toEqual(FAKE_TOOLCHAIN_INFO);
  });

  it("compiles the input unchanged and assembles the exact compiler bytes", async () => {
    const compiler = fakeCompiler(() => Promise.resolve(compiled()));
    const deps = dependencies(compiler, { timeoutMs: 1500 });
    const controller = new AbortController();

    const service = await createToolchainService(deps);
    const outcome = await service.build(INPUT, controller.signal);

    expect(compiler.compileSource).toHaveBeenCalledWith(INPUT.source, {
      filename: "check.c",
      headers: INPUT.headers,
      cppFlags: INPUT.cppFlags,
      rawFlags: INPUT.rawFlags,
      gpSize: 8,
      encoding: "eucjp",
      signal: controller.signal,
      timeoutMs: 1500,
    });
    expect(deps.assemble).toHaveBeenCalledWith(ASM, {
      gpSize: 8,
      aspsxVersion: "2.77",
      filename: "check.s",
    });
    expect(outcome).toEqual({
      kind: "success",
      object: OBJECT,
      compilerText: "\tjr\t$31\n",
      preprocessed: PREPROCESSED,
      diagnostics: [{ severity: "warning", message: "unused" }],
    });
  });

  it("passes no signal or timeout when none is given", async () => {
    const compiler = fakeCompiler(() => Promise.resolve(compiled()));

    const service = await createToolchainService(dependencies(compiler));
    await service.build(INPUT);

    const [, options] = compiler.compileSource.mock.calls[0] ?? [];
    expect(options).not.toHaveProperty("signal");
    expect(options).not.toHaveProperty("timeoutMs");
  });

  it("returns compiler diagnostics as a compiler failure", async () => {
    const diagnostics = [
      { severity: "error", file: "check.c", line: 1, message: "parse error" },
    ] as const;
    const compiler = fakeCompiler(() =>
      Promise.resolve({
        success: false,
        exitCode: 1,
        stage: "compile",
        diagnostics,
        rawStdout: "",
        rawStderr: "",
        compiler: FAKE_TOOLCHAIN_INFO.psyqWasm,
        timings: TIMINGS,
      }),
    );
    const assemble = vi.fn(() => assembled);

    const service = await createToolchainService(
      dependencies(compiler, { assemble }),
    );

    await expect(service.build(INPUT)).resolves.toEqual({
      kind: "compiler-failure",
      diagnostics,
    });
    expect(assemble).not.toHaveBeenCalled();
  });

  it("resolves to an assembler failure when the injected assembler rejects the output", async () => {
    const diagnostics = [
      {
        severity: "error",
        file: "check.s",
        line: 1,
        code: "unknown-mnemonic",
        message: "unknown mnemonic",
      },
    ] as const;
    const compiler = fakeCompiler(() => Promise.resolve(compiled()));

    const service = await createToolchainService(
      dependencies(compiler, {
        assemble: () => ({ success: false, diagnostics }),
      }),
    );

    await expect(service.build(INPUT)).resolves.toEqual({
      kind: "assembler-failure",
      compilerText: "\tjr\t$31\n",
      diagnostics,
    });
  });

  it("does not compile when the signal has already fired", async () => {
    const compiler = fakeCompiler(() => Promise.resolve(compiled()));
    const controller = new AbortController();
    controller.abort();

    const service = await createToolchainService(dependencies(compiler));

    await expect(service.build(INPUT, controller.signal)).resolves.toEqual({
      kind: "cancelled",
    });
    expect(compiler.compileSource).not.toHaveBeenCalled();
  });

  it("maps an abort rejection to cancelled", async () => {
    const compiler = fakeCompiler(() =>
      Promise.reject(new DOMException("Aborted", "AbortError")),
    );

    const service = await createToolchainService(dependencies(compiler));

    await expect(service.build(INPUT)).resolves.toEqual({ kind: "cancelled" });
  });

  it("maps a rejection with a custom abort reason to cancelled", async () => {
    const controller = new AbortController();
    const compiler = fakeCompiler(() => {
      controller.abort("stop");
      return Promise.reject(new Error("stop"));
    });

    const service = await createToolchainService(dependencies(compiler));

    await expect(service.build(INPUT, controller.signal)).resolves.toEqual({
      kind: "cancelled",
    });
  });

  it("maps a compile timeout to a timeout outcome", async () => {
    const compiler = fakeCompiler(() =>
      Promise.reject(new CompileTimeoutError(1500)),
    );

    const service = await createToolchainService(dependencies(compiler));

    await expect(service.build(INPUT)).resolves.toEqual({
      kind: "timeout",
      timeoutMs: 1500,
    });
  });

  it("reports an unencodable character in the source as a compiler failure", async () => {
    const compiler = fakeCompiler(() =>
      Promise.reject(
        new EncodingError("No EUC-JP mapping for U+00A5.", {
          character: "¥",
          index: 12,
        }),
      ),
    );

    const service = await createToolchainService(dependencies(compiler));

    await expect(service.build(INPUT)).resolves.toEqual({
      kind: "compiler-failure",
      diagnostics: [
        {
          severity: "error",
          file: "check.c",
          message: "No EUC-JP mapping for U+00A5.",
        },
      ],
    });
  });

  it("maps other library errors to an infrastructure failure", async () => {
    const compiler = fakeCompiler(() =>
      Promise.reject(new CompilerDisposedError()),
    );

    const service = await createToolchainService(dependencies(compiler));
    const outcome = await service.build(INPUT);

    expect(outcome.kind).toBe("infrastructure-failure");
    expect(outcome.kind === "infrastructure-failure" && outcome.message).toBe(
      new CompilerDisposedError().message,
    );
  });

  it("describes a rejection that is not an error", async () => {
    const compiler = fakeCompiler(() =>
      Promise.reject(new Error("unused")).catch(() => {
        throw "not an error" as unknown as Error;
      }),
    );

    const service = await createToolchainService(dependencies(compiler));

    await expect(service.build(INPUT)).resolves.toEqual({
      kind: "infrastructure-failure",
      message: "The toolchain failed to run.",
    });
  });

  it("maps a throwing assembler to an infrastructure failure", async () => {
    const compiler = fakeCompiler(() => Promise.resolve(compiled()));

    const service = await createToolchainService(
      dependencies(compiler, {
        assemble: () => {
          throw new Error("gpSize must be a non-negative integer");
        },
      }),
    );

    await expect(service.build(INPUT)).resolves.toEqual({
      kind: "infrastructure-failure",
      message: "gpSize must be a non-negative integer",
    });
  });

  it("disposes the compiler", async () => {
    const compiler = fakeCompiler(() => Promise.resolve(compiled()));

    const service = await createToolchainService(dependencies(compiler));
    service.dispose();

    expect(compiler.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("assemblyFilename", () => {
  it.each([
    ["mission.c", "mission.s"],
    ["check", "check.s"],
  ])("names the assembly for %s", (filename, expected) => {
    expect(assemblyFilename(filename)).toBe(expected);
  });
});
