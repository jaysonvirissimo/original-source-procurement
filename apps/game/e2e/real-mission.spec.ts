import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  FIELD_COMMITS,
  FIELD_HEADER,
  FIELD_MISSION_ID,
  FIELD_PATHS,
  FIELD_SOURCE,
  FIELD_STARTER,
  fieldTargetText,
} from "../src/test/fieldFixture.ts";
import { FIXTURE_BASE_URL } from "./fixture-server.ts";
import { watchPage, type PageWatch } from "./page-watch.ts";

// Every header, source, and word served here is OSP-authored fixture content
// from the fixtures build. No upstream response is recorded or replayed.

type Host = "raw" | "cdn";

/** What a content host does with a request. */
type Behavior = "serve" | "block" | "corrupt" | "missing";

interface UpstreamRoutes {
  readonly requests: string[];
  behave(host: Host, behavior: Behavior): void;
}

const TITLE = "FIXTURE PAIR";

const FILES: readonly {
  readonly repository: string;
  readonly commit: string;
  readonly path: string;
  readonly body: string;
}[] = [
  {
    repository: "FoxdieTeam/mgs_reversing",
    commit: FIELD_COMMITS.target,
    path: FIELD_PATHS.target,
    body: fieldTargetText(),
  },
  {
    repository: "FoxdieTeam/psyq_sdk",
    commit: FIELD_COMMITS.corpus,
    path: FIELD_PATHS.header,
    body: FIELD_HEADER,
  },
  {
    repository: "FoxdieTeam/mgs_reversing",
    commit: FIELD_COMMITS.corpus,
    path: FIELD_PATHS.source,
    body: FIELD_SOURCE,
  },
];

function hostOf(url: string): Host | undefined {
  const { hostname } = new URL(url);
  return hostname === "raw.githubusercontent.com"
    ? "raw"
    : hostname === "cdn.jsdelivr.net"
      ? "cdn"
      : undefined;
}

function bodyFor(url: string): string | undefined {
  return FILES.find(
    ({ repository, commit, path }) =>
      url ===
        `https://raw.githubusercontent.com/${repository}/${commit}/${path}` ||
      url === `https://cdn.jsdelivr.net/gh/${repository}@${commit}/${path}`,
  )?.body;
}

/**
 * Answers the two upstream hosts from fixture files. Registered after the
 * page watch, so it takes these hosts while every other external request
 * stays blocked.
 */
async function routeUpstream(page: Page): Promise<UpstreamRoutes> {
  const behaviors: Record<Host, Behavior> = { raw: "serve", cdn: "serve" };
  const requests: string[] = [];
  await page.route(
    /^https:\/\/(raw\.githubusercontent\.com|cdn\.jsdelivr\.net)\//,
    async (route) => {
      const url = route.request().url();
      requests.push(url);
      const host = hostOf(url);
      const body = bodyFor(url);
      const behavior = host === undefined ? "block" : behaviors[host];
      const headers = { "access-control-allow-origin": "*" };
      if (behavior === "block") {
        await route.abort("blockedbyclient");
      } else if (behavior === "missing" || body === undefined) {
        await route.fulfill({ status: 404, headers, body: "404: Not Found" });
      } else {
        await route.fulfill({
          status: 200,
          headers,
          body:
            behavior === "corrupt" ? body.replace(/0x[0-9A-F]/g, "0xF") : body,
        });
      }
    },
  );
  return {
    requests,
    behave: (host, behavior) => {
      behaviors[host] = behavior;
    },
  };
}

let watch: PageWatch;
let upstream: UpstreamRoutes;

test.skip(
  process.env.OSP_BASE_URL !== undefined,
  "Field missions are served from the local fixtures build.",
);
test.describe.configure({ timeout: 90_000 });
test.use({ baseURL: FIXTURE_BASE_URL, viewport: { width: 1280, height: 720 } });

test.beforeEach(async ({ page }) => {
  watch = await watchPage(page, FIXTURE_BASE_URL);
  upstream = await routeUpstream(page);
});

test.afterEach(() => {
  expect(watch.externalRequests).toEqual([]);
  expect(watch.nonGetRequests).toEqual([]);
  // Browsers log refused and missing upstream loads; nothing else may fail.
  expect(
    watch.consoleErrors.filter(
      (message) =>
        !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|Fetch API cannot load|NetworkError|Load failed|Cross-Origin Request Blocked/i.test(
          message,
        ),
    ),
  ).toEqual([]);
});

function compileButton(page: Page): Locator {
  return page.getByRole("button", { name: "Compile", exact: true });
}

function targetListing(page: Page): Locator {
  return page.getByRole("table", { name: "Target instructions" });
}

async function openField(page: Page): Promise<void> {
  await page.goto(`./#/mission/${FIELD_MISSION_ID}`);
  await expect(
    page.getByRole("heading", { level: 1, name: TITLE }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter" }).click();
}

async function setSource(page: Page, source: string): Promise<void> {
  await page.getByRole("textbox", { name: "C source" }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(source);
}

function requestsTo(host: Host, path: string): string[] {
  return upstream.requests.filter(
    (url) => hostOf(url) === host && url.endsWith(`/${path}`),
  );
}

test("a field mission loads from the raw host, shows provenance, and matches exactly", async ({
  page,
}) => {
  await page.goto(`./#/mission/${FIELD_MISSION_ID}`);
  const provenance = page.getByLabel("Provenance");
  await expect(provenance).toContainText("osp_pair_sum");
  await expect(provenance.getByRole("link")).toHaveAttribute(
    "href",
    `https://github.com/FoxdieTeam/mgs_reversing/blob/${FIELD_COMMITS.target}/${FIELD_PATHS.target}`,
  );
  await page.getByRole("button", { name: "Enter" }).click();

  await expect(targetListing(page)).toContainText("lw $v0,0x4($a0)");
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  expect(requestsTo("raw", FIELD_PATHS.target)).toHaveLength(1);
  expect(requestsTo("raw", FIELD_PATHS.header)).toHaveLength(1);
  expect(requestsTo("cdn", FIELD_PATHS.target)).toEqual([]);
  expect(requestsTo("raw", FIELD_PATHS.source)).toEqual([]);

  await setSource(
    page,
    FIELD_STARTER.replace("return 0;", "return pair->left + pair->right;"),
  );
  await compileButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Mission complete" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .getByRole("region", { name: "Mission complete" })
      .getByLabel("Provenance"),
  ).toBeVisible();
});

test("a blocked raw host falls back to jsDelivr for the target and SDK header", async ({
  page,
}) => {
  upstream.behave("raw", "block");
  await openField(page);

  await expect(targetListing(page)).toBeVisible({ timeout: 30_000 });
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  expect(requestsTo("cdn", FIELD_PATHS.target)).toHaveLength(1);
  expect(requestsTo("cdn", FIELD_PATHS.header)).toHaveLength(1);
});

test("content that fails its hash on the raw host loads from jsDelivr", async ({
  page,
}) => {
  upstream.behave("raw", "corrupt");
  await openField(page);

  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  expect(requestsTo("cdn", FIELD_PATHS.target)).toHaveLength(1);
});

test("with both hosts unreachable the mission says so, training still works, and Retry recovers", async ({
  page,
}) => {
  upstream.behave("raw", "block");
  upstream.behave("cdn", "missing");
  await openField(page);

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("couldn't reach it");
  await expect(alert).toContainText(FIELD_PATHS.target);
  await expect(compileButton(page)).toBeDisabled();

  await page.goto("./#/mission/003");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });

  await openField(page);
  await expect(page.getByRole("alert")).toBeVisible();
  upstream.behave("raw", "serve");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(targetListing(page)).toBeVisible();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
});

test("content that fails its hash on both hosts shows the mismatch state and is not cached", async ({
  page,
}) => {
  upstream.behave("raw", "corrupt");
  upstream.behave("cdn", "corrupt");
  await openField(page);

  await expect(page.getByRole("alert")).toContainText(
    "didn't match what it expected",
  );

  upstream.behave("raw", "serve");
  upstream.behave("cdn", "serve");
  const before = requestsTo("raw", FIELD_PATHS.target).length;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(targetListing(page)).toBeVisible();
  expect(requestsTo("raw", FIELD_PATHS.target)).toHaveLength(before + 1);
});

test("reopening a loaded mission uses the cache and makes no request", async ({
  page,
}) => {
  await openField(page);
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  const count = upstream.requests.length;

  // WebKit reports a cancelled module import if a reload interrupts loading.
  await page.waitForLoadState("networkidle");
  // The reload keeps the mission route, so navigating again would reload twice.
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: TITLE }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(targetListing(page)).toBeVisible();
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  expect(upstream.requests).toHaveLength(count);
});

test("the hint ladder loads source only at stage 9 and shows it read-only", async ({
  page,
}) => {
  await openField(page);
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Hint" }).click();
  const hints = page.getByRole("region", { name: "Hints" });
  const next = hints.getByRole("button", { name: /^Reveal/ });

  // Stage 1, then stage 5: the declaration from the already loaded header.
  await next.click();
  await next.click();
  await expect(hints.getByLabel("Upstream source").first()).toContainText(
    "typedef struct OspPair",
  );
  expect(requestsTo("raw", FIELD_PATHS.source)).toEqual([]);

  await next.click();
  const reveals = hints.getByLabel("Upstream source");
  await expect(reveals.last()).toContainText(
    "return pair->left + pair->right;",
  );
  expect(requestsTo("raw", FIELD_PATHS.source)).toHaveLength(1);
  await expect(hints.getByRole("button")).toHaveText([
    "Close",
    "No more hints",
  ]);
  await expect(reveals.last()).not.toHaveAttribute("contenteditable");
});

test("a completion with the revealed solution says so, practices again, and is marked on the map", async ({
  page,
}) => {
  await openField(page);
  await expect(compileButton(page)).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Hint" }).click();
  const hints = page.getByRole("region", { name: "Hints" });
  const next = hints.getByRole("button", { name: /^Reveal/ });
  for (let stage = 0; stage < 3; stage += 1) {
    await next.click();
  }
  await expect(hints.getByLabel("Upstream source").last()).toContainText(
    "return pair->left + pair->right;",
  );
  await hints.getByRole("button", { name: "Close" }).click();
  await expect(hints).toHaveCount(0);

  await setSource(
    page,
    FIELD_STARTER.replace("return 0;", "return pair->left + pair->right;"),
  );
  await compileButton(page).click();
  const complete = page.getByRole("region", { name: "Mission complete" });
  await expect(complete).toBeVisible({ timeout: 30_000 });
  await expect(complete).toContainText("Solution revealed");
  await expect(complete).toContainText("does not advance skills");

  await complete.getByRole("button", { name: "Practice again" }).click();
  await expect(complete).toHaveCount(0);
  const editor = page.getByRole("textbox", { name: "C source" });
  await expect(editor).toContainText("return 0;");
  await expect(editor).not.toContainText("pair->left");
  await page.getByRole("button", { name: "Hint" }).click();
  await expect(hints.getByLabel("Upstream source")).toHaveCount(0);

  await page.goto("./#/");
  await expect(page.getByRole("region", { name: "Mission map" })).toContainText(
    "SOLUTION REVEALED",
  );
});
