import type { ManualEntry } from "@osp/mission-schema";
import { useId, useState, type ReactElement, type ReactNode } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import prose from "../../styles/prose.module.css";
import styles from "./Manual.module.css";
import { ManualEntryView } from "./ManualEntryView";
import { groupBySection, searchManual } from "./searchManual";

type Scope = "mission" | "all";

interface ManualBrowserProps {
  readonly entries: readonly ManualEntry[];
  /**
   * What the open mission links to. With it the browser starts on "This
   * mission"; without it, it shows every entry.
   */
  readonly missionView?: ReactNode;
  /** Heading level of results and sections; entries in a section sit one below. */
  readonly level: 2 | 3;
}

/**
 * Searches and browses the manual. A search always covers every entry, so a
 * definition an earlier mission introduced stays reachable from any mission.
 */
export function ManualBrowser({
  entries,
  missionView,
  level,
}: ManualBrowserProps): ReactElement {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>(
    missionView === undefined ? "all" : "mission",
  );
  const searching = query.trim() !== "";
  const SectionHeading = level === 2 ? "h2" : "h3";

  let content: ReactNode;
  if (searching) {
    const found = searchManual(entries, query);
    content =
      found.length === 0 ? (
        <p className={classNames(prose.prose, prose.dim)}>
          No manual entry matches that search.
        </p>
      ) : (
        <ul className={styles.list} aria-label="Search results">
          {found.map((entry) => (
            <li key={entry.id}>
              <ManualEntryView entry={entry} level={level} />
            </li>
          ))}
        </ul>
      );
  } else if (scope === "mission") {
    content = missionView;
  } else {
    content = groupBySection(entries).map(({ section, entries: grouped }) => (
      <section className={styles.section} key={section}>
        <SectionHeading className={controls.label}>{section}</SectionHeading>
        <ul className={styles.list}>
          {grouped.map((entry) => (
            <li key={entry.id}>
              <ManualEntryView
                entry={entry}
                level={level === 2 ? 3 : 4}
                hideSection
              />
            </li>
          ))}
        </ul>
      </section>
    ));
  }

  return (
    <div className={styles.browser}>
      <div className={styles.search}>
        <label className={styles.searchLabel} htmlFor={searchId}>
          Search the manual
        </label>
        <input
          className={styles.searchInput}
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {missionView === undefined ? null : (
        <div className={styles.scopes} role="group" aria-label="Show">
          {(
            [
              ["mission", "This mission"],
              ["all", "All entries"],
            ] as const
          ).map(([value, label]) => (
            <button
              className={controls.button}
              type="button"
              key={value}
              aria-pressed={!searching && scope === value}
              onClick={() => {
                setScope(value);
                setQuery("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {content}
    </div>
  );
}
