import type { Page } from "@playwright/test";

export interface PageWatch {
  readonly consoleErrors: string[];
  readonly externalRequests: string[];
  /** Requests that could carry a body, such as player source. */
  readonly nonGetRequests: string[];
}

/**
 * Records console errors and blocks every request that leaves the site's
 * origin, so the page must work with no CDN, backend, or other external
 * host. Also records any request other than GET.
 */
export async function watchPage(
  page: Page,
  baseURL: string,
): Promise<PageWatch> {
  const origin = new URL(baseURL).origin;
  const watch: PageWatch = {
    consoleErrors: [],
    externalRequests: [],
    nonGetRequests: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      watch.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    watch.consoleErrors.push(error.message);
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() !== "GET") {
      watch.nonGetRequests.push(`${request.method()} ${url}`);
    }
    if (new URL(url).origin === origin) {
      await route.continue();
      return;
    }
    watch.externalRequests.push(url);
    await route.abort("blockedbyclient");
  });

  return watch;
}

export function siteUrl(baseURL: string | undefined, path: string): string {
  if (baseURL === undefined) {
    throw new Error("Browser tests need a baseURL.");
  }
  return new URL(path, baseURL).href;
}
