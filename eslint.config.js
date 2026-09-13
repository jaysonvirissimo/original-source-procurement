import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const REACT = ["react", "react/*", "react-dom", "react-dom/*"];

/**
 * Enforces package boundaries: lower-level packages must not reach up into
 * the game or into packages that sit beside or above them.
 */
function forbidImports(owner, group) {
  return {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group,
            message: `${owner} must not depend on this module. See "Package boundaries" in CONTRIBUTING.md.`,
          },
        ],
      },
    ],
  };
}

export default defineConfig(
  globalIgnores([
    "**/dist/",
    "**/coverage/",
    "**/test-results/",
    "**/playwright-report/",
    "**/blob-report/",
    "tmp/",
  ]),

  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },

  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  {
    files: [
      "*.config.ts",
      "apps/game/*.config.ts",
      "apps/game/build/**/*.ts",
      "apps/game/e2e/**/*.ts",
      "tools/**/*.ts",
    ],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["packages/mission-schema/**/*.ts"],
    rules: forbidImports("mission-schema", [...REACT, "psyq-asm", "@osp/*"]),
  },
  {
    files: ["packages/matching-core/**/*.ts"],
    rules: forbidImports("matching-core", [
      ...REACT,
      "@osp/game",
      "@osp/curriculum",
      "@osp/mgs-importer",
    ]),
  },
  {
    files: ["packages/curriculum/**/*.ts"],
    rules: forbidImports("curriculum", [
      ...REACT,
      "@osp/game",
      "@osp/matching-core",
      "@osp/mgs-importer",
    ]),
  },
  {
    files: ["tools/mgs-importer/**/*.ts"],
    rules: forbidImports("mgs-importer", [
      ...REACT,
      "@osp/game",
      "@osp/curriculum",
    ]),
  },
);
