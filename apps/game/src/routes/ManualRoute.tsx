import { useEffect, type ReactElement } from "react";
import { useMissionCatalog } from "../features/curriculum/missionCatalog";
import { ManualBrowser } from "../features/manual/ManualBrowser";
import { manualEntryElementId } from "../features/manual/manualEntryElementId";
import { RoutePanel } from "./RoutePanel";

interface ManualRouteProps {
  readonly entryId?: string | undefined;
}

/** The whole manual, searchable, with the requested entry focused. */
export function ManualRoute({ entryId }: ManualRouteProps): ReactElement {
  const { manualEntries } = useMissionCatalog();
  const known =
    entryId === undefined || manualEntries.some(({ id }) => id === entryId);

  useEffect(() => {
    if (entryId === undefined) {
      return;
    }
    const entry = document.getElementById(manualEntryElementId(entryId));
    if (entry === null) {
      return;
    }
    // Focusing scrolls, but the manual's fonts load with font-display: swap,
    // so the first layout uses fallback metrics. When the web fonts arrive
    // the text above the entry reflows and the scroll position no longer
    // points at it. Align again once the fonts have settled.
    entry.focus();
    let current = true;
    // Absent in jsdom, which loads no fonts and so never reflows.
    const { fonts } = document as Partial<Document>;
    void fonts?.ready.then(() => {
      if (current) {
        entry.scrollIntoView();
      }
    });
    return () => {
      current = false;
    };
  }, [entryId]);

  return (
    <RoutePanel
      title="Manual"
      detail={entryId}
      message={
        known
          ? "Concepts, orientation, and a glossary of the terms missions use. Search it, or browse every entry."
          : "No manual entry has that name. Search the manual, or browse every entry."
      }
    >
      <ManualBrowser entries={manualEntries} level={2} />
    </RoutePanel>
  );
}
