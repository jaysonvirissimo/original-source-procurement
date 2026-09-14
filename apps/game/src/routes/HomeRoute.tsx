import type { ReactElement } from "react";
import { useMissionCatalog } from "../features/curriculum/missionCatalog";
import styles from "./HomeRoute.module.css";

export function HomeRoute(): ReactElement {
  const { missions } = useMissionCatalog();

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
          {missions.map((mission) => (
            <li key={mission.id}>
              <a
                className={styles.mission}
                href={`#/mission/${encodeURIComponent(mission.id)}`}
              >
                <span className={styles.missionId}>{mission.id}</span>{" "}
                {mission.title}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
