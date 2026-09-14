import type { assemble as assembleFunction } from "psyq-asm";
import {
  CompileTimeoutError,
  EncodingError,
  isAbortError,
  type CompileSourceOptions,
  type CompileSuccess,
  type Compiler,
} from "psyq-wasm";
import type { BuildOutcome, CompilationInput, ToolchainService } from "./types";

export interface ToolchainDependencies {
  /** Called once; the service reuses the compiler for every build. */
  readonly createCompiler: () => Promise<Compiler>;
  readonly assemble: typeof assembleFunction;
  readonly psyqAsmVersion: string;
  /** Per-build time limit. psyq-wasm's default applies when omitted. */
  readonly timeoutMs?: number;
}

/**
 * Creates the toolchain service. It is the only code that knows psyq-wasm's
 * and psyq-asm's result shapes and error classes; everything else sees a
 * `BuildOutcome`. A compiler-reported error, such as a syntax error, is a
 * `compiler-failure`, not an exception.
 */
export async function createToolchainService(
  dependencies: ToolchainDependencies,
): Promise<ToolchainService> {
  const compiler = await dependencies.createCompiler();

  return {
    info: {
      psyqWasm: compiler.info,
      psyqAsmVersion: dependencies.psyqAsmVersion,
    },

    async build(input, signal) {
      if (signal?.aborted === true) {
        return { kind: "cancelled" };
      }
      try {
        const result = await compiler.compileSource(
          input.source,
          compileOptions(input, signal, dependencies.timeoutMs),
        );
        return result.success
          ? assembleOutput(dependencies.assemble, input, result)
          : { kind: "compiler-failure", diagnostics: result.diagnostics };
      } catch (error) {
        return outcomeOfRejection(error, input, signal);
      }
    },

    dispose() {
      compiler.dispose();
    },
  };
}

/** The assembler's file name for a C file: `mission.c` becomes `mission.s`. */
export function assemblyFilename(filename: string): string {
  return `${filename.endsWith(".c") ? filename.slice(0, -2) : filename}.s`;
}

function compileOptions(
  input: CompilationInput,
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): CompileSourceOptions {
  return {
    filename: input.filename,
    headers: input.headers,
    cppFlags: input.cppFlags,
    rawFlags: input.rawFlags,
    gpSize: input.gpSize,
    encoding: input.encoding,
    ...(signal === undefined ? {} : { signal }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

function assembleOutput(
  assemble: typeof assembleFunction,
  input: CompilationInput,
  compiled: CompileSuccess,
): BuildOutcome {
  // The exact compiler bytes, not the LF-normalized text.
  const assembled = assemble(compiled.asm, {
    gpSize: input.gpSize,
    aspsxVersion: input.aspsxVersion,
    filename: assemblyFilename(input.filename),
  });

  return assembled.success
    ? {
        kind: "success",
        object: assembled.object,
        compilerText: compiled.text,
        diagnostics: compiled.diagnostics,
      }
    : {
        kind: "assembler-failure",
        compilerText: compiled.text,
        diagnostics: assembled.diagnostics,
      };
}

function outcomeOfRejection(
  error: unknown,
  input: CompilationInput,
  signal: AbortSignal | undefined,
): BuildOutcome {
  if (signal?.aborted === true || isAbortError(error)) {
    return { kind: "cancelled" };
  }
  if (error instanceof CompileTimeoutError) {
    return { kind: "timeout", timeoutMs: error.timeoutMs };
  }
  if (error instanceof EncodingError) {
    // A character in the player's own source has no EUC-JP mapping.
    return {
      kind: "compiler-failure",
      diagnostics: [
        { severity: "error", file: input.filename, message: error.message },
      ],
    };
  }
  return {
    kind: "infrastructure-failure",
    message:
      error instanceof Error ? error.message : "The toolchain failed to run.",
  };
}
