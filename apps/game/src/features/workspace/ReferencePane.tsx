import {
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import styles from "./ReferencePane.module.css";

interface ReferencePaneProps {
  /** Which panel is showing; focus moves to its heading when this changes. */
  readonly panel: string;
  readonly children: ReactNode;
}

/**
 * The docked column that holds one help panel beside the listing. Opening a
 * panel moves focus to its heading, so keyboard and screen reader users land
 * in it.
 */
export function ReferencePane({
  panel,
  children,
}: ReferencePaneProps): ReactElement {
  const pane = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    pane.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [panel]);

  return (
    <div className={styles.pane} ref={pane} data-panel={panel}>
      {children}
    </div>
  );
}
