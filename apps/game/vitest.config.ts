import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  test: {
    name: "game",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // These run in the root node project, against the real toolchain.
    exclude: ["src/**/*.node.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
