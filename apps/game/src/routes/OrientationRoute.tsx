import type { ReactElement } from "react";
import { classNames } from "../styles/classNames";
import controls from "../styles/controls.module.css";
import { useMissionCatalog } from "../features/curriculum/missionCatalog";
import { ManualEntryView } from "../features/manual/ManualEntryView";
import styles from "./OrientationRoute.module.css";
import { RoutePanel } from "./RoutePanel";

/**
 * What OSP asks the player to do, and the vocabulary the first mission uses,
 * read in order before it. Nothing here is required or recorded.
 */
export function OrientationRoute(): ReactElement {
  const catalog = useMissionCatalog();
  const entries = catalog.manualEntries.filter(
    ({ section }) => section === "ORIENTATION" || section === "TOOLS",
  );
  const first = catalog.missions.find(
    ({ id }) => id === catalog.defaultPath[0],
  );

  return (
    <RoutePanel
      title="Orientation"
      message="What OSP asks you to do, and the words the first missions use. Nothing here is required, and reading it records no progress. It stays in the manual."
    >
      <ol className={styles.steps}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <ManualEntryView entry={entry} level={2} hideSection />
          </li>
        ))}
      </ol>
      <nav className={styles.actions} aria-label="After orientation">
        {first === undefined ? null : (
          <a
            className={classNames(controls.button, controls.primary)}
            href={`#/mission/${encodeURIComponent(first.id)}`}
          >
            Start mission {first.id}: {first.title}
          </a>
        )}
        <a className={controls.button} href="#/manual">
          Open the manual
        </a>
      </nav>
    </RoutePanel>
  );
}
