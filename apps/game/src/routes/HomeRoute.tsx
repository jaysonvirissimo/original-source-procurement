import type { ReactElement } from "react";
import styles from "./HomeRoute.module.css";

export function HomeRoute(): ReactElement {
  return (
    <div className={styles.home}>
      <header className={styles.heading}>
        <p className={styles.label}>OSP TRAINING</p>
        <h1 className={styles.mark}>OSP</h1>
        <p className={styles.name}>Original Source Procurement</p>
      </header>
      <section className={styles.map} aria-label="Mission map">
        <h2 className={styles.mapLabel}>Mission map</h2>
        <p className={styles.mapText}>Training program in preparation.</p>
      </section>
    </div>
  );
}
