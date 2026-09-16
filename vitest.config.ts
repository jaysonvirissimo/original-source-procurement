import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/game/vitest.config.ts",
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "apps/game/build/**/*.test.ts",
            // Game code tested against the real toolchain in Node.
            "apps/game/src/**/*.node.test.ts",
            "packages/*/src/**/*.test.ts",
            "tools/*/src/**/*.test.ts",
          ],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html", "json-summary"],
      include: [
        "apps/*/src/**/*.{ts,tsx}",
        "apps/game/build/**/*.ts",
        "packages/*/src/**/*.ts",
        "tools/*/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        // Generators shared by property tests; no product behavior.
        "**/*.test-helpers.ts",
        // Command-line entry point that passes the shipped curriculum and the
        // console to runValidation, which unit tests cover directly.
        "packages/curriculum/src/bin/**",
        // Command-line entry point that passes the pinned release and the
        // console to runDistributionAudit, which unit tests cover directly.
        "apps/game/build/bin/**",
        // Command-line entry points that pass the pinned commits, the local
        // checkouts, and the console to the importer functions, which unit
        // tests cover directly.
        "tools/mgs-importer/src/bin/**",
        "**/*.d.ts",
        // Test-only setup that registers Testing Library cleanup; no product behavior.
        "apps/game/src/test/**",
        // Browser bootstrap that mounts React into index.html. The browser
        // test suite exercises it; unit tests cannot meaningfully execute it.
        "apps/game/src/main.tsx",
        // Declarative Three.js scene components: meshes, materials, and
        // per-frame easing that jsdom cannot render. The logic that decides
        // what they show (phase, tier, quality, motion) is unit tested.
        "apps/game/src/vr/scene/**",
      ],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99,
      },
    },
  },
});
