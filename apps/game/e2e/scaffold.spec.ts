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
}

async function scanMemory(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Scan" }).click();
  const scan = page.getByRole("region", { name: "Scan" });
  await scan.getByRole("radio", { name: "Memory" }).check();
  return scan;
}

test("a first exposure shows notes and a memory diagram without being asked", async ({
  page,
}) => {
  await openMission(page, "006", "LOAD WORD");

  await expect(page.getByRole("list", { name: "Annotations" })).toBeVisible();
  const diagram = page.getByRole("region", { name: "Machine diagram" });
  await expect(
    diagram.getByRole("table", { name: "Memory: int at p" }),
  ).toContainText("0x1000");
  await expect(diagram).toContainText("Word 0 loads 4 bytes into $v0");
});

test("the minimal setting removes automatic notes and keeps Scan, hints, and the manual", async ({
  page,
}) => {
  await page.goto("./#/settings");
  const support = page.getByRole("region", { name: "Teaching support" });
  await expect(support).toBeVisible();
  // Settings starts the compiler, and the page moves once it is ready.
  await expect(page.getByText("Compiler build")).toBeVisible({
    timeout: 30_000,
  });
  await support.getByRole("radio", { name: /^Minimal/ }).check();

  await page.goto("./#/mission/006");
  await expect(
    page.getByText("Minimal: notes appear only through Scan."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("button", { name: "Scan" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Annotations" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Machine diagram" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hint" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Manual" })).toBeVisible();

  const scan = await scanMemory(page);
  await expect(
    scan.getByRole("table", { name: "Memory: int at p" }),
  ).toContainText("42");
});

test("an independent mission shows no notes but keeps their manual entries and diagrams on request", async ({
  page,
}) => {
  await openMission(page, "012", "QUALIFICATION 01");

  await expect(page.getByRole("list", { name: "Annotations" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Machine diagram" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Manual" }).click();
  await expect(
    page
      .getByRole("region", { name: "Manual" })
      .getByRole("heading", { name: "Assembler-inserted nops" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const scan = await scanMemory(page);
  await expect(
    scan.getByRole("table", { name: "Memory: struct Holder" }),
  ).toContainText("the address of struct Inner");
});
