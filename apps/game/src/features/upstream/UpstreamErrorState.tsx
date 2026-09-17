import type { ReactElement } from "react";
import controls from "../../styles/controls.module.css";

interface UpstreamErrorStateProps {
  /** The specific, friendly message for what could not be loaded. */
  readonly message: string;
  /** The upstream path that failed, when the surrounding view doesn't show it. */
  readonly path?: string | undefined;
  readonly onRetry: () => void;
  readonly className?: string | undefined;
}

/** Upstream content that could not be loaded, with a way to try again. */
export function UpstreamErrorState({
  message,
  path,
  onRetry,
  className,
}: UpstreamErrorStateProps): ReactElement {
  return (
    <div className={className} role="alert">
      <p>{message}</p>
      {path === undefined ? null : (
        <p>
          <code>{path}</code>
        </p>
      )}
      <button className={controls.button} type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
