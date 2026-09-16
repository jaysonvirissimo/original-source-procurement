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
    if (entryId !== undefined) {
      document.getElementById(manualEntryElementId(entryId))?.focus();
    }
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
