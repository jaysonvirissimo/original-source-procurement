import { useId, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import type { MapRegion } from "./mapModel";
import styles from "./MissionMap.module.css";
import { MissionNode } from "./MissionNode";

const REGION_DETAILS: Readonly<Record<MapRegion["kind"], string | undefined>> =
  {
    phase: undefined,
    field: "Solved functions recovered from the real game.",
    live: "Functions no one has matched yet.",
  };

/** Training phases as lanes, then the field and live regions. */
export function LaneMap({
  regions,
}: {
  readonly regions: readonly MapRegion[];
}): ReactElement {
  return (
    <div className={styles.lanes}>
      {regions.map((region) => (
        <Lane key={region.key} region={region} />
      ))}
    </div>
  );
}

function Lane({ region }: { readonly region: MapRegion }): ReactElement {
  const titleId = useId();
  const detail = REGION_DETAILS[region.kind];
  return (
    <section
      className={classNames(
        styles.lane,
        region.kind !== "phase" && styles.tierRegion,
      )}
      aria-labelledby={titleId}
    >
      <div className={styles.laneHeading}>
        <h3 className={styles.laneTitle} id={titleId}>
          {region.kind === "phase" ? `Phase · ${region.title}` : region.title}
        </h3>
        {detail === undefined ? null : (
          <p className={styles.laneDetail}>{detail}</p>
        )}
      </div>
      {region.entries.length === 0 ? (
        <p className={styles.empty}>No missions yet.</p>
      ) : (
        <ol className={styles.nodes}>
          {region.entries.map((entry) => (
            <MissionNode key={entry.mission.id} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  );
}
