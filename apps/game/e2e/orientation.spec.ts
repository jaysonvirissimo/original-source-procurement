import { expect, test, type Locator, type Page } from "@playwright/test";
import { acknowledgeEvidence } from "./evidence.ts";
import { siteUrl, watchPage, type PageWatch } from "./page-watch.ts";

let watch: PageWatch;

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 1280, height: 720 } });

test.beforeEach(async ({ page, baseURL }) => {
  watch = await watchPage(page, siteUrl(baseURL, "./"));
});

test.afterEach(() => {
  expect(watch.externalRequests).toEqual([]);
  expect(watch.nonGetRequests).toEqual([]);
  expect(watch.consoleErrors).toEqual([]);
});

function compileButton(page: Page): Locator {
  return page.getByRole("button", { name: "Compile", exact: true });
}

/** Moves focus forward until `target` has it. WebKit on macOS tabs to controls with Alt+Tab. */
async function tabTo(
  page: Page,
  browserName: string,
  target: Locator,
): Promise<void> {
  const key = browserName === "webkit" ? "Alt+Tab" : "Tab";
  for (let presses = 0; presses < 40; presses += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press(key);
  }
  throw new Error("Focus never reached the target.");
}

test("a fresh save offers the orientation, which leads to mission 001 from the keyboard", async ({
  page,
  browserName,
}) => {
  await page.goto("./");
  const start = page.getByRole("region", { name: "Start here" });
  await expect(start).toBeVisible();

  const read = start.getByRole("link", { name: "Read the orientation" });
  await tabTo(page, browserName, read);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: "Orientation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Hexadecimal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Workspace tools" }),
  ).toBeVisible();

  const begin = page.getByRole("link", {
    name: "Start mission 001: RETURN PATH",
  });
  await tabTo(page, browserName, begin);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: "RETURN PATH" }),
  ).toBeVisible();
});

test("skipping the orientation never blocks mission 001, whose briefing defines its terms", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("region", { name: "Mission map" })
    .getByRole("link", { name: "001 RETURN PATH", exact: true })
    .click();

  await expect(
    page.getByRole("link", { name: "Read the orientation" }),
  ).toHaveAttribute("href", "#/orientation");
  const terms = page.getByRole("list", { name: "Terms" });
  await terms.getByText("delay slot", { exact: true }).click();
  await expect(terms).toContainText(
    "The instruction right after a jump or branch.",
  );

  await page.getByRole("button", { name: "Enter" }).click();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  await compileButton(page).click();
  await acknowledgeEvidence(page, "001");
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("./");
  await expect(page.getByRole("region", { name: "Start here" })).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Reference" })
    .getByRole("link", { name: "Orientation" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Orientation" }),
  ).toBeVisible();
});

test("a later mission's manual finds a glossary entry by search", async ({
  page,
}) => {
  await page.goto("./#/mission/006");
  await page.getByRole("button", { name: "Enter" }).click();
  await page.getByRole("button", { name: "Manual" }).click();

  const manual = page.getByRole("region", { name: "Manual" });
  await manual
    .getByRole("searchbox", { name: "Search the manual" })
    .fill("hexadecimal");
  await expect(
    manual
      .getByRole("list", { name: "Search results" })
      .getByRole("heading", { name: "hexadecimal (0x)" }),
  ).toBeVisible();

  await manual.getByRole("button", { name: "All entries" }).click();
  await expect(
    manual.getByRole("heading", { name: "GLOSSARY", exact: true }),
  ).toBeVisible();
});

test("a manual address opens the whole manual at its entry", async ({
  page,
}) => {
  await page.goto("./#/manual/glossary.register");

  await expect(
    page.getByRole("heading", { level: 1, name: "Manual" }),
  ).toBeVisible();
  await expect(page.locator('[id="manual-glossary.register"]')).toBeFocused();
  await expect(
    page.locator('[id="manual-glossary.register"]'),
  ).toBeInViewport();
});
