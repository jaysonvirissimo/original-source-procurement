import { useId, useMemo, useState, type ReactElement } from "react";
import { searchEntries, type MissionEntry } from "./mapModel";
import styles from "./MissionMap.module.css";
import { MissionNode } from "./MissionNode";

interface MissionListProps {
  readonly entries: readonly MissionEntry[];
  readonly skillNames: ReadonlyMap<string, string>;
}

/** Every mission in recommended order, filtered by a search. */
export function MissionList({
  entries,
  skillNames,
}: MissionListProps): ReactElement {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const shown = useMemo(
    () => searchEntries(entries, query, skillNames),
    [entries, query, skillNames],
  );
  const total = String(entries.length);

  return (
    <div className={styles.list}>
      <div className={styles.search}>
        <label className={styles.searchLabel} htmlFor={searchId}>
          Search missions
        </label>
        <input
          className={styles.searchInput}
          id={searchId}
          type="search"
          value={query}
          placeholder="ID, title, phase, or skill"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <p className={styles.count} role="status">
          {shown.length === entries.length
            ? `${total} missions`
            : `${String(shown.length)} of ${total} missions`}
        </p>
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>No missions match “{query.trim()}”.</p>
      ) : (
        <ol className={styles.rows}>
          {shown.map((entry) => (
            <MissionNode key={entry.mission.id} entry={entry} />
          ))}
        </ol>
      )}
    </div>
  );
}
