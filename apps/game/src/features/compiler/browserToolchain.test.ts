import type { Compiler } from "psyq-wasm";
import { describe, expect, it, vi } from "vitest";
import { FAKE_TOOLCHAIN_INFO } from "../../test/fakeToolchain";
import {
  compilerAssetUrls,
  createBrowserToolchain,
  PSYQ_ASM_VERSION,
} from "./browserToolchain";

const { createCompiler } = vi.hoisted(() => ({
  createCompiler: vi.fn<(options: unknown) => Promise<Compiler>>(),
}));

vi.mock("psyq-wasm", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createCompiler,
}));

describe("compilerAssetUrls", () => {
  it("places the worker and compiler modules under the vendor directory of the page's base", () => {
    expect(
      compilerAssetUrls(
        "https://example.test/original-source-procurement/#/settings",
      ),
    ).toEqual({
      workerUrl: new URL(
        "https://example.test/original-source-procurement/vendor/psyq-wasm/1.0.0/worker.js",
      ),
      wasmUrl: new URL(
        "https://example.test/original-source-procurement/vendor/psyq-wasm/1.0.0/cc1psx.wasm",
      ),
      preprocessorWasmUrl: new URL(
        "https://example.test/original-source-procurement/vendor/psyq-wasm/1.0.0/cccp.wasm",
      ),
    });
  });
});

describe("createBrowserToolchain", () => {
  it("creates the compiler from the vendor URLs and reports the assembler version", async () => {
    createCompiler.mockResolvedValue({
      info: FAKE_TOOLCHAIN_INFO.psyqWasm,
      compileSource: vi.fn(),
      compilePreprocessed: vi.fn(),
      dispose: vi.fn(),
    });

    const service = await createBrowserToolchain();

    expect(createCompiler).toHaveBeenCalledWith(
      compilerAssetUrls(document.baseURI),
    );
    expect(service.info).toEqual({
      psyqWasm: FAKE_TOOLCHAIN_INFO.psyqWasm,
      psyqAsmVersion: PSYQ_ASM_VERSION,
    });
  });
});
