import type {
  AspsxVersion,
  AssembledObject,
  Diagnostic as AssemblerDiagnostic,
} from "psyq-asm";
import type { CompilerDiagnostic, CompilerInfo } from "psyq-wasm";

export type {
  AssembledObject,
  AssemblerDiagnostic,
  CompilerDiagnostic,
  CompilerInfo,
};

/**
 * Everything one build needs. Headers are complete file contents keyed by
 * virtual path, and include search paths are `-I` entries in `cppFlags`.
 */
export interface CompilationInput {
  readonly filename: string;
  readonly source: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly cppFlags: readonly string[];
  readonly rawFlags: readonly string[];
  readonly gpSize: 0 | 8;
  readonly aspsxVersion: AspsxVersion;
  readonly encoding: "utf8" | "eucjp";
}

export interface ToolchainInfo {
  readonly psyqWasm: CompilerInfo;
  readonly psyqAsmVersion: string;
}

export type BuildOutcome =
  | {
      readonly kind: "success";
      readonly object: AssembledObject;
      readonly compilerText: string;
      /** The exact bytes the compiler read after preprocessing. */
      readonly preprocessed?: Uint8Array | undefined;
      readonly diagnostics: readonly CompilerDiagnostic[];
    }
  | {
      readonly kind: "compiler-failure";
      readonly diagnostics: readonly CompilerDiagnostic[];
    }
  | {
      readonly kind: "assembler-failure";
      readonly compilerText: string;
      readonly diagnostics: readonly AssemblerDiagnostic[];
    }
  | { readonly kind: "cancelled" }
  | { readonly kind: "timeout"; readonly timeoutMs: number }
  | { readonly kind: "infrastructure-failure"; readonly message: string };

/**
 * Compiles C with psyq-wasm and assembles the result with psyq-asm. It does
 * no I/O and knows nothing about missions.
 */
export interface ToolchainService {
  readonly info: ToolchainInfo;
  build(input: CompilationInput, signal?: AbortSignal): Promise<BuildOutcome>;
  dispose(): void;
}
