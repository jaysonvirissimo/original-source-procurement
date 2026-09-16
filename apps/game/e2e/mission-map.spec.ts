import { expect, test, type Locator, type Page } from "@playwright/test";
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

function missionMap(page: Page): Locator {
  return page.getByRole("region", { name: "Mission map" });
}

function row(page: Page, name: string): Locator {
  return missionMap(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
}

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
  for (let presses = 0; presses < 30; presses += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press(key);
  }
  throw new Error("Focus never reached the target.");
}

test("a fresh save recommends the first mission and marks missions that skip ahead", async ({
  page,
}) => {
  await page.goto("./");

  await expect(row(page, "001 RETURN PATH")).toContainText("RECOMMENDED");
  await expect(row(page, "009 FIELD OFFSET")).toContainText("SKIPS AHEAD");
  await expect(row(page, "009 FIELD OFFSET")).toContainText(
    "Not yet introduced:",
  );
  await expect(
    missionMap(page).getByRole("region", { name: "Live" }),
  ).toContainText("No missions yet.");
  await expect(
    missionMap(page)
      .getByRole("region", { name: "Field" })
      .getByRole("link", { name: "F01 FONT BUFFER" }),
  ).toBeVisible();
  await expect(missionMap(page)).toContainText("0 of 13 complete");
});

test("skipping ahead warns on the briefing and still enters the mission", async ({
  page,
}) => {
  await page.goto("./");
  await row(page, "009 FIELD OFFSET").getByRole("link").click();

  await expect(
    page.getByRole("heading", { level: 1, name: "FIELD OFFSET" }),
  ).toBeVisible();
  await expect(page.getByText(/^Not yet introduced: /u)).toBeVisible();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
});

test("list mode finds a mission by search and stays chosen after a reload", async ({
  page,
}) => {
  await page.goto("./");
  await missionMap(page).getByRole("button", { name: "List" }).click();
  const search = missionMap(page).getByRole("searchbox", {
    name: "Search missions",
  });

  await search.fill("field offset");
  await expect(missionMap(page).getByRole("listitem")).toHaveCount(1);
  await expect(row(page, "009 FIELD OFFSET")).toBeVisible();
  await expect(missionMap(page).getByRole("status")).toHaveText(
    "1 of 13 missions",
  );

  // The setting saves in the background, so reload until it has.
  await expect(async () => {
    await page.reload();
    await expect(search).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(
    missionMap(page).getByRole("button", { name: "List" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("completing a mission moves the recommendation, and a started mission can be resumed", async ({
  page,
}) => {
  await page.goto("./#/mission/001");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  await compileButton(page).click();
  const acknowledge = page.getByRole("button", {
    name: "Acknowledge evidence",
  });
  await expect(acknowledge).toBeEnabled({ timeout: 30_000 });
  await acknowledge.click();
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toBeVisible();

  await page.goto("./#/mission/003");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(compileButton(page)).toBeVisible();

  await page.goto("./");
  await expect(row(page, "001 RETURN PATH")).toContainText("COMPLETE");
  await expect(row(page, "002 ARGUMENT ZERO")).toContainText("RECOMMENDED");
  await expect(row(page, "003 ADD IMMEDIATE")).toContainText("IN PROGRESS");
  await missionMap(page)
    .getByRole("link", { name: "ADD IMMEDIATE (003)" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "ADD IMMEDIATE" }),
  ).toBeVisible();
});

test("the map and list work from the keyboard", async ({
  page,
  browserName,
}) => {
  await page.goto("./");
  const list = missionMap(page).getByRole("button", { name: "List" });
  await list.focus();
  await page.keyboard.press("Enter");
  await expect(list).toHaveAttribute("aria-pressed", "true");

  const search = missionMap(page).getByRole("searchbox", {
    name: "Search missions",
  });
  await tabTo(page, browserName, search);
  await page.keyboard.type("return");
  const link = row(page, "001 RETURN PATH").getByRole("link");
  await tabTo(page, browserName, link);
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { level: 1, name: "RETURN PATH" }),
  ).toBeVisible();
});

test("the map is fully usable with simple graphics", async ({ page }) => {
  await page.goto("./#/settings");
  const panel = page.getByRole("region", { name: "Graphics and motion" });
  await expect(panel).toBeVisible();
  await expect(page.getByText("Compiler build")).toBeVisible({
    timeout: 30_000,
  });
  await panel
    .getByRole("group", { name: "Background" })
    .getByRole("radio", { name: /Simple/u })
    .check();

  await page.goto("./");
  await expect(page.locator("[data-vr-layer] canvas")).toHaveCount(0);
  await expect(row(page, "001 RETURN PATH")).toContainText("RECOMMENDED");
  await row(page, "001 RETURN PATH").getByRole("link").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "RETURN PATH" }),
  ).toBeVisible();
});
