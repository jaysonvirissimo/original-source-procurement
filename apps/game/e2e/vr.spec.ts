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

function chamber(page: Page): Locator {
  return page.locator("[data-vr-layer]");
}

async function openMission(
  page: Page,
  id: string,
  title: string,
): Promise<void> {
  await page.goto(`./#/mission/${id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
}

async function hasWebgl(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) !== null;
  });
}

async function chooseSetting(
  page: Page,
  group: "Background" | "Motion",
  choice: RegExp,
): Promise<void> {
  await page.goto("./#/settings");
  const panel = page.getByRole("region", { name: "Graphics and motion" });
  await expect(panel).toBeVisible();
  // Settings starts the compiler, and the page moves once it is ready.
  await expect(page.getByText("Compiler build")).toBeVisible({
    timeout: 30_000,
  });
  await panel
    .getByRole("group", { name: group })
    .getByRole("radio", {
      name: choice,
    })
    .check();
}

test("the chamber draws behind the workspace and never takes input", async ({
  page,
}) => {
  await page.goto("./");
  test.skip(
    !(await hasWebgl(page)),
    "No WebGL in this browser; the simple-graphics test covers play without it.",
  );
  await openMission(page, "003", "ADD IMMEDIATE");

  await expect(chamber(page)).toHaveAttribute("aria-hidden", "true");
  await expect(chamber(page)).toHaveAttribute("data-vr-tier", "training");
  const canvas = chamber(page).locator("canvas");
  await expect(canvas).toHaveCount(1, { timeout: 30_000 });
  for (const layer of [chamber(page), canvas]) {
    expect(
      await layer.evaluate(
        (element) => getComputedStyle(element).pointerEvents,
      ),
    ).toBe("none");
  }

  const editor = page.getByRole("textbox", { name: "C source" });
  await editor.click();
  await expect(editor).toBeFocused();
  expect(
    await editor.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.filter, style.transform];
    }),
  ).toEqual(["none", "none"]);

  await compileButton(page).click();
  await expect(page.getByRole("status")).not.toHaveText("NOT COMPILED", {
    timeout: 30_000,
  });
});

test("simple graphics never starts WebGL, and a mission still completes", async ({
  page,
}) => {
  await chooseSetting(page, "Background", /^Simple/);
  await openMission(page, "001", "RETURN PATH");

  await expect(chamber(page)).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);

  await compileButton(page).click();
  await acknowledgeEvidence(page, "001");
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("reduced motion, from the browser or the setting, keeps the chamber still", async ({
  page,
}) => {
  const webgl = await page.goto("./").then(() => hasWebgl(page));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  if (webgl) {
    await expect(chamber(page)).toHaveAttribute("data-vr-motion", "reduced");
    await expect(chamber(page)).toHaveAttribute("data-vr-frameloop", "demand");
  }

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("html")).not.toHaveAttribute("data-motion");

  await chooseSetting(page, "Motion", /^Reduced/);
  await page.goto("./#/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  if (webgl) {
    await expect(chamber(page)).toHaveAttribute("data-vr-frameloop", "demand");
  }
});

test("the workspace fits the minimum 1024×700 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  await openMission(page, "003", "ADD IMMEDIATE");

  for (const locator of [
    page.getByRole("textbox", { name: "C source" }),
    page.getByRole("table", { name: "Target instructions" }),
    compileButton(page),
  ]) {
    await expect(locator).toBeInViewport();
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("the workspace fits 1024×700 with a help panel open", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  await openMission(page, "003", "ADD IMMEDIATE");
  await page.getByRole("button", { name: "Hint" }).click();

  for (const locator of [
    page.getByRole("textbox", { name: "C source" }),
    page.getByRole("table", { name: "Target instructions" }),
    page.getByRole("region", { name: "Hints" }),
    compileButton(page),
  ]) {
    await expect(locator).toBeInViewport();
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
