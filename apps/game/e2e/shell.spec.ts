import { expect, test } from "@playwright/test";
import { siteUrl, watchPage, type PageWatch } from "./page-watch.ts";

let watch: PageWatch;

test.beforeEach(async ({ page, baseURL }) => {
  watch = await watchPage(page, siteUrl(baseURL, "./"));
});

test.afterEach(() => {
  expect(watch.externalRequests).toEqual([]);
  expect(watch.nonGetRequests).toEqual([]);
  expect(watch.consoleErrors).toEqual([]);
});

test("the home route shows the OSP name", async ({ page }) => {
  await page.goto("./");

  await expect(page).toHaveTitle("OSP: Original Source Procurement");
  await expect(
    page.getByRole("heading", { level: 1, name: "OSP" }),
  ).toBeVisible();
  await expect(
    page.getByText("Original Source Procurement", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Mission map" })).toBeVisible();
});

// Settings starts the compiler worker. Reloading while the worker is still
// importing its modules makes WebKit log the cancelled imports as console
// errors, so the test waits until the route has settled on both loads.
for (const [hash, heading, settled] of [
  ["#/settings", "Settings", "Compiler build"],
  ["#/mission/001", "Mission", undefined],
] as const) {
  test(`refreshing ${hash} keeps the route`, async ({ page }) => {
    const title = page.getByRole("heading", { level: 1, name: heading });
    const expectSettled = async () => {
      await expect(title).toBeVisible();
      if (settled !== undefined) {
        await expect(page.getByText(settled)).toBeVisible({ timeout: 30_000 });
      }
    };

    await page.goto(`./${hash}`);
    await expectSettled();

    await page.reload();

    await expectSettled();
  });
}

test("in-page links navigate between hash routes", async ({ page }) => {
  await page.goto("./#/manual/MIPS.LOAD.WORD");
  await expect(
    page.getByRole("heading", { level: 1, name: "Manual" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Return to mission map" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "OSP" }),
  ).toBeVisible();
});

test("an unknown hash route shows the not-found state", async ({ page }) => {
  await page.goto("./#/nowhere");

  await expect(
    page.getByRole("heading", { level: 1, name: "Route not found" }),
  ).toBeVisible();
});

test("fonts load from the site itself", async ({ page }) => {
  await page.goto("./");

  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    const code = await document.fonts.load('14px "IBM Plex Mono"');
    const display = await document.fonts.load('14px "Barlow Condensed"');
    return { code: code.length, display: display.length };
  });

  expect(loaded.code).toBeGreaterThan(0);
  expect(loaded.display).toBeGreaterThan(0);
});

test("the build ships third-party notices", async ({ page, baseURL }) => {
  const response = await page.request.get(
    siteUrl(baseURL, "./THIRD_PARTY_NOTICES.txt"),
  );

  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).toMatch(/^react \d+\.\d+\.\d+$/m);
  expect(text).toMatch(/^@fontsource\/ibm-plex-mono \d+\.\d+\.\d+$/m);
  expect(text).toMatch(/^@fontsource\/barlow-condensed \d+\.\d+\.\d+$/m);
  expect(text).toContain("SIL OPEN FONT LICENSE");
  expect(text).toMatch(/^psyq-wasm 1\.0\.0$/m);
  expect(text).toMatch(/^psyq-asm 0\.2\.0$/m);
  expect(text).toContain("GNU GENERAL PUBLIC LICENSE");
});

test("the build publishes the compiler's corresponding source", async ({
  page,
  baseURL,
}) => {
  const vendor = "./vendor/psyq-wasm/1.0.0/";

  for (const file of [
    "psyq-wasm-1.0.0-corresponding-source.tar.gz",
    "PROVENANCE.md",
    "LICENSES/GPL-2.0-only.txt",
  ]) {
    const response = await page.request.head(siteUrl(baseURL, vendor + file));
    expect(response.status(), file).toBe(200);
  }
});
