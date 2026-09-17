import { useId, type ReactElement, type ReactNode } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import prose from "../../styles/prose.module.css";
import {
  UPSTREAM_CONTENT_MISMATCH,
  UPSTREAM_CONTEXT_UNAVAILABLE,
} from "../upstream/messages";
import { UpstreamErrorState } from "../upstream/UpstreamErrorState";
import styles from "../workspace/ReferencePane.module.css";
import type { ContextState } from "../workspace/workspaceReducer";
import { includeOrder } from "./includeOrder";
import contextStyles from "./ContextPanel.module.css";

interface ContextPanelProps {
  readonly context: ContextState;
  readonly starterSource: string;
  readonly onRetry: () => void;
  readonly onClose: () => void;
  /** Shown after the headers, such as the field-offset table. */
  readonly children?: ReactNode;
}

/**
 * The mission's headers, exactly as the compiler receives them. It reads the
 * context the workspace already resolved: it fetches nothing, records no hint
 * use, looks the same at every scaffold level, and offers nothing that
 * inserts a header into the editor.
 */
export function ContextPanel({
  context,
  starterSource,
  onRetry,
  onClose,
  children,
}: ContextPanelProps): ReactElement {
  const titleId = useId();

  const renderHeaders = (): ReactElement => {
    switch (context.kind) {
      case "resolving":
        return (
          <p className={styles.dim} role="status">
            Loading mission context.
          </p>
        );
      case "unavailable":
      case "content-mismatch":
        return (
          <UpstreamErrorState
            message={
              context.kind === "unavailable"
                ? UPSTREAM_CONTEXT_UNAVAILABLE
                : UPSTREAM_CONTENT_MISMATCH
            }
            path={context.path}
            onRetry={onRetry}
          />
        );
      case "ready": {
        const { headers, cppFlags } = context.input;
        const keys = includeOrder(starterSource, headers, cppFlags);
        if (keys.length === 0) {
          return (
            <p className={classNames(prose.prose, styles.dim)}>
              This mission has no headers. Its types are declared in the
              starting source.
            </p>
          );
        }
        return (
          <ul
            className={classNames(styles.list, contextStyles.headers)}
            aria-label="Headers"
          >
            {keys.map((key, index) => (
              <li key={key}>
                <details open={index === 0}>
                  <summary>
                    <code>{key}</code>
                  </summary>
                  <pre className={styles.code} aria-label={key}>
                    {headers[key]}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        );
      }
    }
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2
          className={classNames(controls.label, styles.heading)}
          id={titleId}
          tabIndex={-1}
        >
          Context
        </h2>
        <button className={controls.button} type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <p className={prose.prose}>
        The declarations your source can use, exactly as the compiler receives
        them, listed in the order the includes reach them. Reading them costs
        nothing and is not recorded as a hint.
      </p>
      {renderHeaders()}
      {children}
    </section>
  );
}
