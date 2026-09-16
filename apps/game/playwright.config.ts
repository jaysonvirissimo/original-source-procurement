import { defineConfig, devices } from "@playwright/test";
import { FIXTURE_BASE_URL, FIXTURE_PORT } from "./e2e/fixture-server.ts";

const PORT = 4173;
const LOCAL_BASE_URL = `http://127.0.0.1:${String(PORT)}/original-source-procurement/`;

// Set OSP_BASE_URL to run the same suite against a deployed site instead of
// the local sub-path server.
const deployedBaseUrl = process.env.OSP_BASE_URL;
const isCi = process.env.CI !== undefined;

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  use: {
    baseURL: deployedBaseUrl ?? LOCAL_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  ...(deployedBaseUrl === undefined
    ? {
        webServer: [
          {
            command: "node e2e/serve-subpath.ts",
            url: LOCAL_BASE_URL,
            env: { PORT: String(PORT) },
            reuseExistingServer: !isCi,
          },
          {
            command:
              "vite build --mode fixtures --outDir dist-fixtures --logLevel warn && node e2e/serve-subpath.ts",
            url: FIXTURE_BASE_URL,
            env: { PORT: String(FIXTURE_PORT), OSP_DIST: "dist-fixtures" },
            reuseExistingServer: !isCi,
            timeout: 240_000,
          },
        ],
      }
    : {}),
});
