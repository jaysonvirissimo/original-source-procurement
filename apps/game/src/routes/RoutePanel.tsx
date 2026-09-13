import type { ReactElement } from "react";
import styles from "./RoutePanel.module.css";

interface RoutePanelProps {
  readonly title: string;
  readonly message: string;
  readonly detail?: string;
}

export function RoutePanel({
  title,
  message,
  detail,
}: RoutePanelProps): ReactElement {
  return (
    <section className={styles.panel}>
      <p className={styles.label}>OSP</p>
      <h1 className={styles.title}>{title}</h1>
      {detail === undefined ? null : (
        <p>
          <code className={styles.detail}>{detail}</code>
        </p>
      )}
      <p className={styles.message}>{message}</p>
      <a className={styles.link} href="#/">
        Return to mission map
      </a>
    </section>
  );
}
