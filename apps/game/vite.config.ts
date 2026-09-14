import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
  psyqWasmDistribution,
  renderCompilerProvenance,
} from "./build/psyq-wasm-distribution.ts";
import { PSYQ_WASM_RELEASE } from "./build/psyq-wasm-release.ts";
import { thirdPartyNotices } from "./build/third-party-notices.ts";

export default defineConfig({
  // Relative asset URLs let one build run from any path, including a
  // GitHub Pages project site, without knowing the repository name.
  base: "./",
  plugins: [
    psyqWasmDistribution(),
    react(),
    thirdPartyNotices({
      appendix: renderCompilerProvenance(PSYQ_WASM_RELEASE),
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
