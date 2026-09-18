import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const REACT = ["react", "react/*", "react-dom", "react-dom/*"];
const TOOLCHAIN = ["psyq-wasm", "psyq-wasm/*", "psyq-asm", "psyq-asm/*"];
const STORAGE = ["indexedDB", "localStorage", "sessionStorage"];
const NETWORK = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"];

/**
 * Forbids reaching the named globals both bare and as members of `window`,
 * `globalThis`, or `self`, which `no-restricted-globals` alone lets through.
 */
function forbidGlobals(names, message) {
  return {
    "no-restricted-globals": [
      "error",
      ...names.map((name) => ({ name, message })),
    ],
    "no-restricted-syntax": [
      "error",
      {
        selector: `MemberExpression[object.name=/^(window|globalThis|self)$/][property.name=/^(${names.join("|")})$/]`,
        message,
      },
    ],
  };
}

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
    "**/dist-fixtures/",
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
      "apps/game/src/**/*.node.test.ts",
      "tools/**/*.ts",
    ],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: ["apps/game/src/features/compiler/**"],
    rules: forbidImports("Game code outside the toolchain service", TOOLCHAIN),
  },

  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    rules: forbidImports("Shipped game code", ["@osp/mgs-importer"]),
  },

  {
    // Test fixtures and fakes stay out of the shipped module graph. main.tsx
    // loads the fixture catalog behind a build-mode check for browser tests.
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: [
      "apps/game/src/main.tsx",
      "apps/game/src/test/**",
      "apps/game/src/**/*.test.{ts,tsx}",
      "apps/game/src/**/*.test-helpers.ts",
    ],
    rules: forbidImports("Shipped game code", ["**/test/**"]),
  },

  {
    files: ["apps/game/src/**/*.{ts,tsx}"],
    ignores: ["apps/game/src/features/persistence/**"],
    rules: forbidGlobals(
      STORAGE,
      'Browser storage is reached only through features/persistence. See "Package boundaries" in CONTRIBUTING.md.',
    ),
  },

  {
    // Build scripts and browser tests run in Node; they drive the game, they
    // do not render it.
    files: ["apps/game/build/**/*.ts", "apps/game/e2e/**/*.ts"],
    rules: forbidImports("Build scripts and browser tests", REACT),
  },

  {
    files: ["packages/mission-schema/**/*.ts"],
    rules: forbidImports("mission-schema", [...REACT, ...TOOLCHAIN, "@osp/*"]),
  },
  {
    files: ["packages/matching-core/**/*.ts"],
    rules: {
      ...forbidImports("matching-core", [
        ...REACT,
        "psyq-wasm",
        "psyq-wasm/*",
        "@osp/game",
        "@osp/curriculum",
        "@osp/mgs-importer",
      ]),
      ...forbidGlobals(
        [...STORAGE, ...NETWORK],
        'matching-core stays free of browser storage and the network. See "Package boundaries" in CONTRIBUTING.md.',
      ),
    },
  },
  {
    files: ["packages/curriculum/**/*.ts"],
    rules: forbidImports("curriculum", [
      ...REACT,
      ...TOOLCHAIN,
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
