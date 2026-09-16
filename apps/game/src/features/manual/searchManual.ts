import {
  MANUAL_SECTIONS,
  type ManualEntry,
  type ManualSection,
} from "@osp/mission-schema";

export interface ManualSectionGroup {
  readonly section: ManualSection;
  readonly entries: readonly ManualEntry[];
}

/**
 * Entries whose title or body contains every word of the query, ignoring
 * case: title matches first, then body matches, each in manual order. An
 * empty query matches nothing.
 */
export function searchManual(
  entries: readonly ManualEntry[],
  query: string,
): ManualEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const inTitle: ManualEntry[] = [];
  const inBody: ManualEntry[] = [];
  for (const entry of entries) {
    const title = entry.title.toLowerCase();
    const text = `${title}\n${entry.body.join("\n").toLowerCase()}`;
    if (!words.every((word) => text.includes(word))) {
      continue;
    }
    (words.some((word) => title.includes(word)) ? inTitle : inBody).push(entry);
  }
  return [...inTitle, ...inBody];
}

/** Entries grouped by section, in section order, skipping empty sections. */
export function groupBySection(
  entries: readonly ManualEntry[],
): ManualSectionGroup[] {
  return MANUAL_SECTIONS.flatMap((section) => {
    const inSection = entries.filter((entry) => entry.section === section);
    return inSection.length === 0 ? [] : [{ section, entries: inSection }];
  });
}
