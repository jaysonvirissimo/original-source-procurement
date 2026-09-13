import { expect, test, type Page } from "@playwright/test";

interface PageWatch {
  readonly consoleErrors: string[];
  readonly externalRequests: string[];
}

/**
 * Records console errors and blocks every request that leaves the site's
 * origin, so the shell must work with no CDN or other external host.
 */
async function watchPage(page: Page, baseURL: string): Promise<PageWatch> {
  const origin = new URL(baseURL).origin;
  const watch: PageWatch = { consoleErrors: [], externalRequests: [] };

  page.on("console", (message) => {
    if (message.type() === "error") {
      watch.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    watch.consoleErrors.push(error.message);
  });

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (new URL(url).origin === origin) {
      await route.continue();
      return;
    }
    watch.externalRequests.push(url);
    await route.abort("blockedbyclient");
  });

  return watch;
}

function siteUrl(baseURL: string | undefined, path: string): string {
  if (baseURL === undefined) {
    throw new Error("Browser tests need a baseURL.");
  }
  return new URL(path, baseURL).href;
}

let watch: PageWatch;

test.beforeEach(async ({ page, baseURL }) => {
  watch = await watchPage(page, siteUrl(baseURL, "./"));
});

test.afterEach(() => {
  expect(watch.externalRequests).toEqual([]);
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

for (const [hash, heading] of [
  ["#/settings", "Settings"],
  ["#/mission/001", "Mission"],
] as const) {
  test(`refreshing ${hash} keeps the route`, async ({ page }) => {
    await page.goto(`./${hash}`);
    const title = page.getByRole("heading", { level: 1, name: heading });
    await expect(title).toBeVisible();

    await page.reload();

    await expect(title).toBeVisible();
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
});
