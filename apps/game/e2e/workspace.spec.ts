import { defaultPath, missions } from "@osp/curriculum";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { siteUrl, watchPage, type PageWatch } from "./page-watch.ts";

// Every C source in this file is OSP-authored.
const addImmediate = (addend: number) =>
  `int add_immediate(int a)\n{\n    return a + ${String(addend)};\n}\n`;

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

function status(page: Page): Locator {
  return page.getByRole("status");
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

async function setSource(page: Page, source: string): Promise<void> {
  await page.getByRole("textbox", { name: "C source" }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  if (source !== "") {
    await page.keyboard.insertText(source);
  }
}

async function compile(page: Page): Promise<void> {
  await expect(compileButton(page)).toBeEnabled();
  await compileButton(page).click();
}

async function missionComplete(page: Page): Promise<Locator> {
  const heading = page.getByRole("heading", { name: "Mission complete" });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  return heading;
}

test("a training mission goes from a classified mismatch to an exact match", async ({
  page,
}) => {
  await openMission(page, "003", "ADD IMMEDIATE");
  await expect(
    page.getByRole("table", { name: "Target instructions" }),
  ).toContainText("addiu $v0,$a0,0x5");

  await setSource(page, addImmediate(4));
  await compile(page);
  await expect(status(page)).toHaveText("NOT AN EXACT MATCH", {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("table", { name: "Target and generated instructions" }),
  ).toContainText("addiu $v0,$a0,0x4");
  await expect(page.getByRole("list", { name: "Mismatches" })).toContainText(
    "Immediate",
  );

  await setSource(page, addImmediate(5));
  await expect(status(page)).toHaveText("NOT AN EXACT MATCH · STALE");
  await page.keyboard.press("ControlOrMeta+Enter");

  await missionComplete(page);
  await expect(page.getByText("EXACT MATCH", { exact: true })).toBeVisible();
});

test("a demonstration completes after a build and an acknowledgement", async ({
  page,
}) => {
  await openMission(page, "001", "RETURN PATH");
  const acknowledge = page.getByRole("button", {
    name: "Acknowledge evidence",
  });
  await expect(acknowledge).toBeDisabled();

  await compile(page);
  await expect(acknowledge).toBeEnabled({ timeout: 30_000 });
  await setSource(page, "int return_path(void)\n{\n    return 7;\n}\n");
  await expect(acknowledge).toBeDisabled();
  await expect(status(page)).toContainText("STALE");

  await compile(page);
  await expect(acknowledge).toBeEnabled({ timeout: 30_000 });
  await acknowledge.click();
  await missionComplete(page);
});

test("a prediction mission completes after a wrong prediction and one build", async ({
  page,
}) => {
  await openMission(page, "002", "ARGUMENT ZERO");

  await page.getByRole("radio", { name: "$v0" }).check();
  await page.getByRole("button", { name: "Record prediction" }).click();
  await compile(page);

  await missionComplete(page);
  await page.getByRole("button", { name: "Return to workspace" }).click();
  await expect(page.getByRole("region", { name: "Prediction" })).toContainText(
    "Answer: $a0.",
  );
});

test("compiler errors and missing functions stay in the workspace and complete nothing", async ({
  page,
}) => {
  await openMission(page, "003", "ADD IMMEDIATE");

  await setSource(page, "int add_immediate(int a)\n{\n    return a + ;\n}\n");
  await compile(page);
  await expect(page.getByRole("list", { name: "Diagnostics" })).toContainText(
    "parse error",
    { timeout: 30_000 },
  );
  await expect(status(page)).toHaveText("BUILD FAILED");

  await setSource(page, "");
  await compile(page);
  await expect(page.getByText("No functions were found.")).toBeVisible({
    timeout: 30_000,
  });
  await expect(status(page)).toHaveText("FUNCTION MISSING");

  await setSource(page, "int add_five(int a) { return a + 5; }\n");
  await compile(page);
  const feedback = page.getByRole("region", { name: "Build feedback" });
  await expect(feedback).toContainText("add_five", { timeout: 30_000 });
  await expect(feedback).toContainText("add_immediate");
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toHaveCount(0);

  await setSource(page, addImmediate(5));
  await compile(page);
  await missionComplete(page);
});

test("the primary flow works from the keyboard alone", async ({
  page,
  browserName,
}) => {
  // Focus only moves forward, so it never leaves the page for browser UI.
  const tab = (target: Locator) => tabTo(page, target, browserName);
  await page.goto("./#/mission/003");
  await expect(
    page.getByRole("heading", { level: 1, name: "ADD IMMEDIATE" }),
  ).toBeVisible();

  await tab(page.getByRole("button", { name: "Enter" }));
  await page.keyboard.press("Enter");
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });

  await tab(page.getByRole("textbox", { name: "C source" }));
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(addImmediate(5));

  await tab(page.getByRole("button", { name: "Hint" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Hints" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Hints" })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Enter");

  const heading = await missionComplete(page);
  await expect(heading).toBeFocused();
  await tab(page.getByRole("button", { name: "Return to workspace" }));
  await page.keyboard.press("Enter");
  await expect(status(page)).toHaveText("EXACT MATCH");
});

test("a fresh session plays the default path from the mission map to the last mission", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const path = defaultPath.map((id) => {
    const mission = missions.find((entry) => entry.id === id);
    if (mission === undefined) {
      throw new Error(`The curriculum has no mission ${id}.`);
    }
    return mission;
  });

  await page.goto("./");
  const [first] = path;
  if (first === undefined) {
    throw new Error("The default path is empty.");
  }
  await page
    .getByRole("region", { name: "Mission map" })
    .getByRole("link", { name: `${first.id} ${first.title}` })
    .click();

  for (const [position, mission] of path.entries()) {
    await expect(
      page.getByRole("heading", { level: 1, name: mission.title }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });

    switch (mission.completion) {
      case "acknowledge-evidence": {
        const acknowledge = page.getByRole("button", {
          name: "Acknowledge evidence",
        });
        await compile(page);
        await expect(acknowledge).toBeEnabled({ timeout: 30_000 });
        await acknowledge.click();
        break;
      }
      case "prediction-recorded": {
        const answer = mission.prediction?.choices[mission.prediction.answer];
        if (answer === undefined) {
          throw new Error(`Mission ${mission.id} has no prediction answer.`);
        }
        await page.getByRole("radio", { name: answer }).check();
        await page.getByRole("button", { name: "Record prediction" }).click();
        await compile(page);
        break;
      }
      case "exact":
        await setSource(page, mission.solution ?? "");
        await compile(page);
        break;
    }
    await missionComplete(page);

    const next = path[position + 1];
    if (next === undefined) {
      await expect(
        page.getByRole("link", { name: /Next mission/ }),
      ).toHaveCount(0);
    } else {
      await page
        .getByRole("link", { name: `Next mission · ${next.id} ${next.title}` })
        .click();
    }
  }
});

test("the workspace fits a 1280×720 viewport", async ({ page }) => {
  await openMission(page, "003", "ADD IMMEDIATE");

  for (const locator of [
    page.getByRole("textbox", { name: "C source" }),
    page.getByRole("table", { name: "Target instructions" }),
    compileButton(page),
    page.getByText("ATTEMPT 00"),
  ]) {
    await expect(locator).toBeInViewport();
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

/**
 * Moves focus forward until `target` has it. WebKit on macOS moves Tab
 * between text fields only; Alt+Tab reaches every control, as Option-Tab
 * does for players with default settings.
 */
async function tabTo(
  page: Page,
  target: Locator,
  browserName: string,
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
  await expect(target).toBeFocused();
}
