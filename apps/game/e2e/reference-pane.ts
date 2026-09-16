import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Checks that every row of the target listing can be read while `panel` is
 * open: each row, scrolled into view inside the listing, is the topmost
 * element at the centre of its instruction cell, and the pane stays open.
 */
export async function expectListingUncovered(
  page: Page,
  panel: Locator,
): Promise<void> {
  const listing = page.getByRole("table", { name: "Target instructions" });
  await expect(listing).toBeVisible();
  const rows = listing.locator("tbody tr");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  const paneBox = await panel.boundingBox();
  const assemblyBox = await page
    .getByRole("region", { name: "Assembly" })
    .boundingBox();
  if (paneBox === null || assemblyBox === null) {
    throw new Error("The pane and the listing are both on screen.");
  }
  expect(assemblyBox.x + assemblyBox.width).toBeLessThanOrEqual(paneBox.x);

  for (let index = 0; index < count; index += 1) {
    const cell = rows.nth(index).locator("td").nth(1);
    await cell.scrollIntoViewIfNeeded();
    const topmost = await cell.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.left + Math.min(box.width / 2, 40),
        box.top + box.height / 2,
      );
      return hit !== null && element.contains(hit);
    });
    expect(topmost, `target row ${String(index)} is uncovered`).toBe(true);
  }
  await expect(panel).toBeVisible();
}
