import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { thirdPartyNotices } from "./build/third-party-notices.ts";

export default defineConfig({
  // Relative asset URLs let one build run from any path, including a
  // GitHub Pages project site, without knowing the repository name.
  base: "./",
  plugins: [react(), thirdPartyNotices()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
