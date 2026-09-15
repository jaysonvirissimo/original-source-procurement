import type { ReactElement } from "react";
import { MissionMap } from "../features/mission-map/MissionMap";
import styles from "./HomeRoute.module.css";

export function HomeRoute(): ReactElement {
  return (
    <div className={styles.home}>
      <header className={styles.heading}>
        <p className={styles.label}>OSP TRAINING</p>
        <h1 className={styles.mark}>OSP</h1>
        <p className={styles.name}>Original Source Procurement</p>
      </header>
      <MissionMap />
    </div>
  );
}
