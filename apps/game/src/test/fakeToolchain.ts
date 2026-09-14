import { vi, type Mock } from "vitest";
import type {
  AssembledObject,
  BuildOutcome,
  CompilationInput,
  ToolchainInfo,
  ToolchainService,
} from "../features/compiler/types";

export const FAKE_TOOLCHAIN_INFO: ToolchainInfo = {
  psyqWasm: {
    psyqVersion: "4.4",
    gccVersion: "2.8.1",
    buildId: "compiler-build",
    preprocessorBuildId: "preprocessor-build",
  },
  psyqAsmVersion: "0.2.0",
};

export interface FakeToolchain extends ToolchainService {
  readonly build: Mock<
    (input: CompilationInput, signal?: AbortSignal) => Promise<BuildOutcome>
  >;
  readonly dispose: Mock<() => void>;
}

/** A toolchain whose builds resolve to `outcome` without compiling. */
export function fakeToolchain(
  outcome: BuildOutcome = { kind: "cancelled" },
): FakeToolchain {
  return {
    info: FAKE_TOOLCHAIN_INFO,
    build: vi.fn(() => Promise.resolve(outcome)),
    dispose: vi.fn(),
  };
}

/** An object holding one function, `f`, made of `words`. */
export function assembledObject(words: readonly number[]): AssembledObject {
  return {
    info: { aspsxVersion: "2.77", gpSize: 0, partialDivExpansion: false },
    sections: [
      {
        name: ".text",
        kind: "code",
        bytes: new Uint8Array(words.length * 4),
        size: words.length * 4,
        words: Uint32Array.from(words),
        relocations: [],
        provenance: words.map(() => ({ line: 1, kind: "instruction" })),
      },
    ],
    symbols: [],
    functions: [{ name: "f", section: ".text", start: 0, end: words.length }],
    smallData: [],
  };
}

export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}
