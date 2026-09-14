import type { ReactElement } from "react";
import {
  orderedMissions,
  useMissionCatalog,
} from "../features/curriculum/missionCatalog";
import { usePlayerProgress } from "../features/persistence/progressContext";
import { missionStatus } from "../features/progress/progressReducer";
import styles from "./HomeRoute.module.css";

const STATUS_LABELS = {
  "in-progress": "IN PROGRESS",
  complete: "COMPLETE",
} as const;

export function HomeRoute(): ReactElement {
  const missions = orderedMissions(useMissionCatalog());
  const { state } = usePlayerProgress();

  return (
    <div className={styles.home}>
      <header className={styles.heading}>
        <p className={styles.label}>OSP TRAINING</p>
        <h1 className={styles.mark}>OSP</h1>
        <p className={styles.name}>Original Source Procurement</p>
      </header>
      <section className={styles.map} aria-label="Mission map">
        <h2 className={styles.mapLabel}>Mission map</h2>
        <ol className={styles.missions}>
          {missions.map((mission) => {
            const status = missionStatus(state.missions[mission.id]);
            return (
              <li className={styles.row} key={mission.id}>
                <a
                  className={styles.mission}
                  href={`#/mission/${encodeURIComponent(mission.id)}`}
                >
                  <span className={styles.missionId}>{mission.id}</span>{" "}
                  {mission.title}
                </a>
                {status === "new" ? null : (
                  <span
                    className={
                      status === "complete" ? styles.complete : styles.started
                    }
                  >
                    {STATUS_LABELS[status]}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
