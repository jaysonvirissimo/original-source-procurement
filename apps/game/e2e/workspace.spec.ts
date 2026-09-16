import { defaultPath, missions } from "@osp/curriculum";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { acknowledgeEvidence, evidenceWord } from "./evidence.ts";
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
  const completion = page.getByRole("region", { name: "Mission complete" });
  await expect(
    completion.getByText("EXACT MATCH", { exact: true }),
  ).toBeVisible();
  await expect(completion.getByText("YES", { exact: true })).toBeVisible();
  // Completion leaves the source and the comparison in view.
  for (const locator of [
    page.getByRole("textbox", { name: "C source" }),
    page.getByRole("table", { name: "Target and generated instructions" }),
    compileButton(page),
  ]) {
    await expect(locator).toBeInViewport();
  }
});

test("a demonstration completes once the evidence instruction is selected and acknowledged", async ({
  page,
}) => {
  await openMission(page, "001", "RETURN PATH");
  const acknowledge = page.getByRole("button", {
    name: "Acknowledge evidence",
  });
  await expect(acknowledge).toBeDisabled();
  await evidenceWord(page, 0).check();
  await expect(acknowledge).toBeDisabled();

  await compile(page);
  await expect(acknowledge).toBeEnabled({ timeout: 30_000 });
  await setSource(page, "int return_path(void)\n{\n    return 7;\n}\n");
  await expect(acknowledge).toBeDisabled();
  await expect(status(page)).toContainText("STALE");

  await compile(page);
  await expect(acknowledge).toBeEnabled({ timeout: 30_000 });
  // The jr is not the evidence: the panel points again and nothing completes.
  await acknowledge.click();
  const evidence = page.getByRole("group", { name: "EVIDENCE" });
  await expect(evidence.getByRole("status")).toContainText("Not that one.");
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toHaveCount(0);

  await acknowledgeEvidence(page, "001");
  await missionComplete(page);
});

test("a wrong prediction completes only after the revealed answer is chosen", async ({
  page,
}) => {
  await openMission(page, "002", "ARGUMENT ZERO");

  await page.getByRole("radio", { name: "$v0" }).check();
  await page.getByRole("button", { name: "Record prediction" }).click();
  await compile(page);

  const prediction = page.getByRole("region", { name: "Prediction" });
  const check = prediction.getByRole("button", { name: "Check answer" });
  await prediction.getByRole("radio", { name: "$s0" }).check();
  await expect(check).toBeEnabled({ timeout: 30_000 });
  await check.click();
  await expect(prediction.getByRole("status")).toHaveText(
    "Not $s0. Read the output again.",
  );
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toHaveCount(0);

  await prediction.getByRole("radio", { name: "$a0" }).check();
  await check.click();
  await missionComplete(page);
  // The correction stays in view with completion.
  await expect(prediction).toContainText("Answer: $a0.");
  await expect(
    page.getByText("First choice $v0; corrected to $a0."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toHaveCount(0);
});

test("a right prediction completes after one build", async ({ page }) => {
  await openMission(page, "002", "ARGUMENT ZERO");

  await page.getByRole("radio", { name: "$a0" }).check();
  await page.getByRole("button", { name: "Record prediction" }).click();
  await compile(page);

  await missionComplete(page);
  await expect(page.getByText("Correct: $a0")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check answer" })).toHaveCount(
    0,
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

test("hints climb from a weak hint to the solution, and completion still works", async ({
  page,
}) => {
  await openMission(page, "003", "ADD IMMEDIATE");

  // The unchanged starting source gets a plain explanation, not a fix.
  await compile(page);
  const starter = page.getByRole("note", { name: "About the starting source" });
  await expect(starter).toContainText(
    "This is the starting source, unchanged",
    {
      timeout: 30_000,
    },
  );
  const summary = page.getByLabel("Match summary");
  await expect(summary).toContainText("HINTSNone");

  await page.getByRole("button", { name: "Hint" }).click();
  const hints = page.getByRole("region", { name: "Hints" });
  await hints.getByRole("button", { name: "Reveal next hint" }).click();
  await expect(hints.getByText("Stage 1 · Skill")).toBeVisible();
  for (let stage = 0; stage < 3; stage += 1) {
    await hints.getByRole("button", { name: "Reveal next hint" }).click();
  }
  await expect(hints.getByLabel("Solution")).toHaveCount(0);
  await hints.getByRole("button", { name: "Reveal the solution" }).click();
  await expect(hints.getByText("Stage 9 · Solution")).toBeVisible();
  await expect(hints.getByLabel("Solution")).toContainText("return a + 5;");
  await expect(
    hints.getByRole("button", { name: "No more hints" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(summary).toContainText("HINTS5 of 5 · stage 9");

  await setSource(page, addImmediate(5));
  await compile(page);
  await missionComplete(page);
  await expect(
    page.getByRole("region", { name: "Mission complete" }),
  ).toContainText("HINTS5 of 5 · stage 9");
});

test("a mismatch opens on request with a hypothesis about its cause", async ({
  page,
}) => {
  await openMission(page, "011", "WRONG SIGN");
  await compile(page);

  const mismatches = page.getByRole("list", { name: "Mismatches" });
  const signedness = mismatches.getByRole("button", {
    name: "Load signedness",
  });
  await expect(signedness).toBeVisible({ timeout: 30_000 });
  await expect(mismatches.getByText("HYPOTHESIS")).toHaveCount(0);

  await signedness.click();
  await expect(signedness).toHaveAttribute("aria-expanded", "true");
  const hypotheses = mismatches.getByRole("list", { name: "Hypotheses" });
  await expect(hypotheses).toContainText("HYPOTHESIS");
  await expect(hypotheses).toContainText("plain char is unsigned");
  await expect(
    page
      .getByRole("table", { name: "Target and generated instructions" })
      .getByText("SELECTED"),
  ).not.toHaveCount(0);
});

test("a missing semicolon gets guidance beside the compiler's message", async ({
  page,
}) => {
  await openMission(page, "008", "STORE WORD");

  await setSource(page, "void store_word(int *p, int v)\n{\n    *p = v\n}\n");
  await compile(page);
  const diagnostics = page.getByRole("list", { name: "Diagnostics" });
  await expect(diagnostics).toContainText("parse error before", {
    timeout: 30_000,
  });
  await expect(diagnostics).toContainText("missing semicolon");
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
  await tab(page.getByRole("button", { name: "Review workspace" }));
  await page.keyboard.press("Enter");
  await expect(status(page)).toHaveText("EXACT MATCH");
});

test("a fresh session plays the training missions on the default path, then points to the field", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const fullPath = defaultPath.map((id) => {
    const mission = missions.find((entry) => entry.id === id);
    if (mission === undefined) {
      throw new Error(`The curriculum has no mission ${id}.`);
    }
    return mission;
  });
  // Field missions load from upstream, which this suite blocks; their own
  // spec serves them from fixtures.
  const path = fullPath.filter(
    (mission) => mission.source.kind === "synthetic",
  );
  const field = fullPath[path.length];

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
        await compile(page);
        await acknowledgeEvidence(page, mission.id);
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

    const next = path[position + 1] ?? field;
    if (next === undefined) {
      await expect(
        page.getByRole("link", { name: /Next mission/ }),
      ).toHaveCount(0);
    } else if (position === path.length - 1) {
      await expect(
        page.getByRole("link", {
          name: `Next mission · ${next.id} ${next.title}`,
        }),
      ).toBeVisible();
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
