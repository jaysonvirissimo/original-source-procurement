import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { acknowledgeEvidence } from "./evidence.ts";
import { siteUrl, watchPage, type PageWatch } from "./page-watch.ts";

// Every C source and save file in this file is OSP-authored.
const addImmediate = (addend: number) =>
  `int add_immediate(int a)\n{\n    return a + ${String(addend)};\n}\n`;

const CACHE_MARKER = "osp-authored downloaded data marker";

let watch: PageWatch;

test.describe.configure({ timeout: 120_000 });
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
  await page.keyboard.insertText(source);
}

async function compile(page: Page): Promise<void> {
  await expect(compileButton(page)).toBeEnabled();
  await compileButton(page).click();
}

async function openSettings(page: Page): Promise<Locator> {
  await page.goto("./#/settings");
  const panel = page.getByRole("region", { name: "Save data" });
  await expect(panel).toBeVisible();
  // Settings starts the compiler, and the toolchain panel grows once it is
  // ready, moving the centered page. Wait so clicks land where they aim.
  await expect(page.getByText("Compiler build")).toBeVisible({
    timeout: 30_000,
  });
  return panel;
}

function missionRow(page: Page, name: string): Locator {
  return page
    .getByRole("region", { name: "Mission map" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name }) });
}

/** Reads one record from OSP's database, once the app has created it. */
function storedRecord(
  page: Page,
  store: string,
  key: string,
): Promise<unknown> {
  return page.evaluate(
    ([storeName, recordKey]) =>
      new Promise((resolve, reject) => {
        const opening = indexedDB.open("osp");
        opening.onerror = () => {
          reject(new Error("The test could not open OSP's database."));
        };
        opening.onsuccess = () => {
          const db = opening.result;
          const request = db
            .transaction(storeName)
            .objectStore(storeName)
            .get(recordKey);
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
        };
      }),
    [store, key] as const,
  );
}

async function storedSource(page: Page, id: string): Promise<unknown> {
  const record = await storedRecord(page, "missions", id);
  return (record as { source?: unknown } | undefined)?.source;
}

function storedAttemptIds(page: Page, missionId: string): Promise<string[]> {
  return page.evaluate(
    (id) =>
      new Promise<string[]>((resolve, reject) => {
        const opening = indexedDB.open("osp");
        opening.onerror = () => {
          reject(new Error("The test could not open OSP's database."));
        };
        opening.onsuccess = () => {
          const db = opening.result;
          const request = db
            .transaction("attempts")
            .objectStore("attempts")
            .index("byMission")
            .getAll(id);
          request.onsuccess = () => {
            db.close();
            resolve(
              (request.result as { id: string }[]).map((attempt) => attempt.id),
            );
          };
        };
      }),
    missionId,
  );
}

function cacheSize(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const opening = indexedDB.open("osp");
        opening.onerror = () => {
          reject(new Error("The test could not open OSP's database."));
        };
        opening.onsuccess = () => {
          const db = opening.result;
          const request = db
            .transaction("upstreamCache")
            .objectStore("upstreamCache")
            .count();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
        };
      }),
  );
}

function seedCache(page: Page): Promise<void> {
  return page.evaluate(
    (marker) =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open("osp");
        opening.onerror = () => {
          reject(new Error("The test could not open OSP's database."));
        };
        opening.onsuccess = () => {
          const db = opening.result;
          const tx = db.transaction("upstreamCache", "readwrite");
          tx.objectStore("upstreamCache").put(marker, "a".repeat(64));
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
    CACHE_MARKER,
  );
}

async function exportSave(page: Page): Promise<string> {
  const panel = await openSettings(page);
  const downloading = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Export save" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(
    /^osp-save-\d{4}-\d{2}-\d{2}\.json$/,
  );
  await expect(panel.getByText("Save exported.")).toBeVisible();
  return readFile(await download.path(), "utf8");
}

async function importSave(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<Locator> {
  const panel = await openSettings(page);
  await panel.getByLabel("Import save").setInputFiles(file);
  await expect(panel.getByText(/replaces all progress/)).toBeVisible();
  await panel.getByRole("button", { name: "Replace progress" }).click();
  return panel;
}

function jsonFile(name: string, value: unknown) {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  };
}

test("reloading keeps edited source and mission progress", async ({ page }) => {
  await openMission(page, "001", "RETURN PATH");
  await compile(page);
  await acknowledgeEvidence(page, "001");
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toBeVisible();

  await openMission(page, "003", "ADD IMMEDIATE");
  await setSource(page, addImmediate(7));
  await expect.poll(() => storedSource(page, "003")).toBe(addImmediate(7));
  await expect(page.getByText("SAVED", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("textbox", { name: "C source" })).toContainText(
    "return a + 7;",
  );
  // Leaving while the compiler worker imports its modules makes WebKit log
  // the cancelled imports as console errors.
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });

  await page.goto("./");
  await expect(missionRow(page, "001 RETURN PATH")).toContainText("COMPLETE");
  await expect(missionRow(page, "003 ADD IMMEDIATE")).toContainText(
    "IN PROGRESS",
  );
});

test("a reopened mission says its saved work and attempts were restored", async ({
  page,
}) => {
  await openMission(page, "003", "ADD IMMEDIATE");
  await setSource(page, addImmediate(4));
  await compile(page);
  await expect(page.getByRole("status")).toHaveText("NOT AN EXACT MATCH", {
    timeout: 30_000,
  });
  await expect.poll(() => storedAttemptIds(page, "003")).toHaveLength(1);

  await page.reload();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  const notice = page.getByText(
    "Saved work restored · 1 earlier attempt in History",
  );
  await expect(notice).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("NOT COMPILED");
  await expect(page.getByText("ATTEMPT 00 THIS VISIT")).toBeVisible();
  for (const locator of [
    notice,
    page.getByRole("table", { name: "Target instructions" }),
    compileButton(page),
  ]) {
    await expect(locator).toBeInViewport();
  }

  await page.getByRole("button", { name: "History" }).click();
  await expect(
    page.getByRole("region", { name: "History" }).getByRole("listitem"),
  ).toContainText("No hints");

  await setSource(page, addImmediate(5));
  await expect(page.getByText(/Saved work restored/)).toHaveCount(0);
});

test("export, reset, and import restore progress, and exports leave out downloaded data", async ({
  page,
}) => {
  await openMission(page, "003", "ADD IMMEDIATE");
  await setSource(page, addImmediate(4));
  await compile(page);
  await expect(page.getByRole("status")).toHaveText("NOT AN EXACT MATCH", {
    timeout: 30_000,
  });
  await expect.poll(() => storedSource(page, "003")).toBe(addImmediate(4));
  await expect.poll(() => storedAttemptIds(page, "003")).toHaveLength(1);
  await seedCache(page);

  const text = await exportSave(page);
  expect(text).not.toContain(CACHE_MARKER);
  const file = JSON.parse(text) as {
    player: {
      missions: Record<
        string,
        { source: string; attempts: { source: string }[] }
      >;
    };
  };
  expect(file.player.missions["003"]?.source).toBe(addImmediate(4));
  expect(file.player.missions["003"]?.attempts.map((a) => a.source)).toEqual([
    addImmediate(4),
  ]);

  const panel = await openSettings(page);
  await panel.getByRole("button", { name: "Reset progress" }).click();
  await panel.getByRole("button", { name: "Reset progress" }).click();
  await expect(panel.getByText("Progress reset.")).toBeVisible();
  expect(await cacheSize(page)).toBe(0);
  await page.goto("./");
  await expect(missionRow(page, "003 ADD IMMEDIATE")).not.toContainText(
    "IN PROGRESS",
  );

  const imported = await importSave(page, jsonFile("osp-save.json", file));
  await expect(imported.getByText("Save imported.")).toBeVisible();

  await openMission(page, "003", "ADD IMMEDIATE");
  await expect(page.getByRole("textbox", { name: "C source" })).toContainText(
    "return a + 4;",
  );
  await page.getByRole("button", { name: "History" }).click();
  await expect(
    page.getByRole("region", { name: "History" }).getByRole("listitem"),
  ).toHaveCount(1);
});

test("invalid imports explain themselves and leave progress unchanged", async ({
  page,
}) => {
  await openMission(page, "003", "ADD IMMEDIATE");
  await setSource(page, addImmediate(6));
  await expect.poll(() => storedSource(page, "003")).toBe(addImmediate(6));
  const valid = JSON.parse(await exportSave(page)) as {
    player: { missions: Record<string, Record<string, unknown>> };
  };
  const damaged = {
    ...valid,
    player: {
      ...valid.player,
      missions: { "003": { ...valid.player.missions["003"], source: 7 } },
    },
  };

  for (const [file, message] of [
    [
      {
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("notes"),
      },
      "That file isn't valid JSON.",
    ],
    [
      jsonFile("other.json", { format: "other" }),
      "That file isn't an OSP save.",
    ],
    [
      jsonFile("damaged.json", damaged),
      "That save file is damaged at player.missions.003.source.",
    ],
  ] as const) {
    const panel = await importSave(page, file);
    await expect(panel.getByRole("alert")).toContainText(message);
    await expect(panel.getByRole("alert")).toContainText(
      "Your current progress hasn't changed.",
    );
  }

  await page.reload();
  await expect(page.getByRole("region", { name: "Save data" })).toBeVisible();
  expect(await storedSource(page, "003")).toBe(addImmediate(6));
});

test("when the browser refuses storage, the player can play without saving", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException("Storage is disabled.", "SecurityError");
    };
  });
  await page.goto("./");

  await expect(page.getByRole("alert")).toContainText(
    "isn't letting OSP store data",
  );
  await page.getByRole("button", { name: "Play without saving" }).click();
  await expect(
    page.getByText("Progress in this tab is not being saved."),
  ).toBeVisible();

  await page
    .getByRole("region", { name: "Mission map" })
    .getByRole("link", { name: "001 RETURN PATH" })
    .click();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByText("NOT SAVED", { exact: true })).toBeVisible();
  await compile(page);
  await acknowledgeEvidence(page, "001");
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toBeVisible();
});

test("a full store reports the failure and saves again on retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    type Put = (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) => IDBRequest<IDBValidKey>;
    const put = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, "put")
      ?.value as Put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args) {
      if (
        (globalThis as { ospStorageFull?: boolean }).ospStorageFull === true
      ) {
        throw new DOMException("The quota was exceeded.", "QuotaExceededError");
      }
      return put.apply(this, args);
    };
  });
  await openMission(page, "003", "ADD IMMEDIATE");
  // Entering saves the mission; only later writes fail.
  await expect.poll(() => storedSource(page, "003")).not.toBeUndefined();
  await page.evaluate(() => {
    (globalThis as { ospStorageFull?: boolean }).ospStorageFull = true;
  });

  await setSource(page, addImmediate(8));
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "storage for OSP is full" });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("NOT SAVED", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    (globalThis as { ospStorageFull?: boolean }).ospStorageFull = false;
  });
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(alert).toHaveCount(0);
  await expect.poll(() => storedSource(page, "003")).toBe(addImmediate(8));
  await expect(page.getByText("SAVED", { exact: true })).toBeVisible();
});

test("history keeps the newest 50 attempts and every pinned one", async ({
  page,
}) => {
  const timestamp = (seconds: number) =>
    new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)).toISOString();
  const attempt = (id: string, createdAt: string, pinned: boolean) => ({
    id,
    missionId: "003",
    createdAt,
    source: addImmediate(3),
    exact: false,
    score: 0.5,
    mismatchSummary: {
      exact: false,
      equalWords: 1,
      targetWords: 2,
      byKind: { IMMEDIATE: 1 },
    },
    compilerBuildId: "osp-e2e",
    preprocessorBuildId: "osp-e2e",
    psyqAsmVersion: "0.2.0",
    aspsxVersion: "2.77",
    pinned,
  });
  const save = {
    format: "osp-save",
    schemaVersion: 1,
    exportedAt: timestamp(0),
    player: {
      schemaVersion: 1,
      corpusVersion: "training",
      missions: {
        "003": {
          missionId: "003",
          source: addImmediate(3),
          sourceSavedAt: timestamp(0),
          hintMaxStage: 0,
          predictions: [],
          attempts: [
            attempt("pinned-oldest", timestamp(-60), true),
            ...Array.from({ length: 50 }, (_, index) =>
              attempt(`unpinned-${String(index)}`, timestamp(index), false),
            ),
          ],
        },
      },
      skills: {},
      settings: {},
    },
  };

  await page.goto("./");
  await expect(page.getByRole("region", { name: "Mission map" })).toBeVisible();
  const panel = await importSave(page, jsonFile("history.json", save));
  await expect(panel.getByText("Save imported.")).toBeVisible();

  await openMission(page, "003", "ADD IMMEDIATE");
  await setSource(page, addImmediate(4));
  await compile(page);
  await expect(page.getByRole("status")).toHaveText("NOT AN EXACT MATCH", {
    timeout: 30_000,
  });

  await expect.poll(() => storedAttemptIds(page, "003")).toHaveLength(51);
  const ids = await storedAttemptIds(page, "003");
  expect(ids).toContain("pinned-oldest");
  expect(ids).not.toContain("unpinned-0");
  expect(ids).toContain("unpinned-1");

  await page.getByRole("button", { name: "History" }).click();
  await expect(
    page.getByRole("region", { name: "History" }).getByRole("listitem"),
  ).toHaveCount(51);
});
