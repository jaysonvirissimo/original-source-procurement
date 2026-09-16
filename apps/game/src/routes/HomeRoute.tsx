import { useId, type ReactElement } from "react";
import { MissionMap } from "../features/mission-map/MissionMap";
import { usePlayerProgress } from "../features/persistence/progressContext";
import { classNames } from "../styles/classNames";
import controls from "../styles/controls.module.css";
import styles from "./HomeRoute.module.css";

export function HomeRoute(): ReactElement {
  const startId = useId();
  const { state } = usePlayerProgress();
  // A save that has never opened a mission gets the orientation up front.
  const fresh = Object.keys(state.missions).length === 0;
  return (
    <div className={styles.home}>
      <header className={styles.heading}>
        <p className={styles.label}>OSP TRAINING</p>
        <h1 className={styles.mark}>OSP</h1>
        <p className={styles.name}>Original Source Procurement</p>
      </header>
      {fresh ? (
        <section className={styles.start} aria-labelledby={startId}>
          <h2 className={controls.label} id={startId}>
            Start here
          </h2>
          <p className={styles.startText}>
            New to C or assembly? The orientation explains what OSP asks you to
            do and the words mission 001 uses. It is optional: every mission
            below is open now.
          </p>
          <a
            className={classNames(controls.button, controls.primary)}
            href="#/orientation"
          >
            Read the orientation
          </a>
        </section>
      ) : (
        <nav className={styles.reference} aria-label="Reference">
          <a href="#/orientation">Orientation</a>
          <a href="#/manual">Manual</a>
        </nav>
      )}
      <MissionMap />
    </div>
  );
}
