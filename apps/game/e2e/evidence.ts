import { missions } from "@osp/curriculum";
import { expect, type Locator, type Page } from "@playwright/test";

/** The radio for one target word in a demonstration's evidence question. */
export function evidenceWord(page: Page, word: number): Locator {
  return page.getByRole("radio", {
    name: new RegExp(`^Word ${String(word)} ·`),
  });
}

/**
 * Selects the first word of a demonstration's evidence and acknowledges it,
 * once a current build allows it.
 */
export async function acknowledgeEvidence(
  page: Page,
  missionId: string,
): Promise<void> {
  const word = missions.find((mission) => mission.id === missionId)?.evidence
    ?.range.start;
  if (word === undefined) {
    throw new Error(`Mission ${missionId} asks for no evidence.`);
  }
  await evidenceWord(page, word).check();
  const acknowledge = page.getByRole("button", {
    name: "Acknowledge evidence",
  });
  await expect(acknowledge).toBeEnabled({ timeout: 30_000 });
  await acknowledge.click();
}
