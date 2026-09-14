import { expect, test, type Page } from "@playwright/test";
import { siteUrl, watchPage, type PageWatch } from "./page-watch.ts";

// Every C source in this file is OSP-authored.
const tiny = (addend: number) =>
  `int f(int a) { return a + ${String(addend)}; }\n`;

// About 0.8 MB of generated C, which takes over a second to compile.
const LARGE = Array.from(
  { length: 8000 },
  (_, index) =>
    `int osp_f${String(index)}(int a, int b) { int c = a * ${String(index)} + b; if (c > ${String(index)}) { c -= b << 2; } return c ^ ${String(index)}; }\n`,
).join("");

interface WorkerCounter {
  ospWorkersCreated: number;
}

let watch: PageWatch;

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page, baseURL }) => {
  watch = await watchPage(page, siteUrl(baseURL, "./"));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const counter = window as unknown as WorkerCounter;
    counter.ospWorkersCreated = 0;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        counter.ospWorkersCreated += 1;
      }
    };
  });
});

test.afterEach(() => {
  expect(watch.externalRequests).toEqual([]);
  expect(watch.nonGetRequests).toEqual([]);
  expect(watch.consoleErrors).toEqual([]);
});

async function openToolchain(page: Page): Promise<void> {
  await page.goto("./#/settings");
  await expect(page.getByText("Compiler build")).toBeVisible({
    timeout: 30_000,
  });
}

async function runCheck(page: Page, source: string): Promise<void> {
  // fill() takes about a minute for the large source, so set the value with
  // the native setter and dispatch the input event React listens for.
  await page.getByLabel("Check source").evaluate((element, value) => {
    const textarea = element as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, source);
  await page.getByRole("button", { name: "Run check" }).click();
}

async function expectAssembled(page: Page, addend: number): Promise<void> {
  const listing = page.getByLabel("Assembled words");
  await expect(listing).toContainText(
    `addiu $v0,$a0,0x${addend.toString(16).toUpperCase()}`,
    { timeout: 30_000 },
  );
  await expect(listing).toContainText("jr $ra");
  await expect(page.getByText("Compiled and assembled 2 words.")).toBeVisible();
}

test("tiny C compiles and assembles in the browser", async ({ page }) => {
  await openToolchain(page);
  await expect(page.getByText("sha256:e3cdde0d4dc69a95")).toBeVisible();
  await expect(page.getByText("sha256:12af84fbb68197fb")).toBeVisible();

  await runCheck(page, tiny(5));

  await expectAssembled(page, 5);
});

test("a syntax error shows compiler diagnostics and the panel keeps working", async ({
  page,
}) => {
  await openToolchain(page);

  await runCheck(page, "int f(int a) { return a + ; }\n");

  await expect(page.getByText("The compiler reported errors.")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("list", { name: "Diagnostics" })).toContainText(
    "error",
  );

  await runCheck(page, tiny(6));
  await expectAssembled(page, 6);
});

test("a cancelled compile is followed by a successful one", async ({
  page,
}) => {
  await openToolchain(page);

  await runCheck(page, LARGE);
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByText("Check cancelled.")).toBeVisible();

  await runCheck(page, tiny(7));
  await expectAssembled(page, 7);
});

test("ordinary compiles reuse one compiler worker", async ({ page }) => {
  await openToolchain(page);

  for (const addend of [9, 10, 11]) {
    await runCheck(page, tiny(addend));
    await expectAssembled(page, addend);
  }

  const created = await page.evaluate(
    () => (window as unknown as WorkerCounter).ospWorkersCreated,
  );
  expect(created).toBe(1);
});
