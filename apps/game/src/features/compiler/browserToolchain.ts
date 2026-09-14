import { assemble } from "psyq-asm";
import { createCompiler, type Compiler } from "psyq-wasm";
import { createToolchainService } from "./toolchainService";
import type { ToolchainService } from "./types";

/** The psyq-asm version the game is built with. */
export const PSYQ_ASM_VERSION = "0.2.0";

/**
 * Where the build places psyq-wasm's worker and compiler artifacts, relative
 * to the site root. They ship there byte-for-byte instead of being bundled.
 */
export const PSYQ_WASM_VENDOR_DIRECTORY = "vendor/psyq-wasm/1.0.0";

export interface CompilerAssetUrls {
  readonly workerUrl: URL;
  readonly wasmUrl: URL;
  readonly preprocessorWasmUrl: URL;
}

export function compilerAssetUrls(baseUri: string): CompilerAssetUrls {
  const base = new URL(`${PSYQ_WASM_VENDOR_DIRECTORY}/`, baseUri);
  return {
    workerUrl: new URL("worker.js", base),
    wasmUrl: new URL("cc1psx.wasm", base),
    preprocessorWasmUrl: new URL("cccp.wasm", base),
  };
}

export function createBrowserCompiler(): Promise<Compiler> {
  return createCompiler(compilerAssetUrls(document.baseURI));
}

export function createBrowserToolchain(): Promise<ToolchainService> {
  return createToolchainService({
    createCompiler: createBrowserCompiler,
    assemble,
    psyqAsmVersion: PSYQ_ASM_VERSION,
  });
}
