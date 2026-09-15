import {
  hintStagePurpose,
  type Mission,
  type RemoteCReference,
} from "@osp/mission-schema";
import { useEffect, useId, useState, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import {
  UPSTREAM_CONTENT_MISMATCH,
  UPSTREAM_HINT_UNAVAILABLE,
} from "../upstream/messages";
import type { UpstreamOutcome } from "../upstream/types";
import { useUpstream } from "../upstream/upstreamContext";
import styles from "./OverlayPanel.module.css";

interface HintPanelProps {
  readonly mission: Pick<Mission, "hints" | "solution">;
  /** The highest stage revealed, or 0. */
  readonly stage: number;
  readonly onReveal: () => void;
  readonly onClose: () => void;
}

/**
 * The hint ladder, one stage at a time. A revealed solution, or revealed
 * upstream source, is read-only text; nothing inserts it into the editor.
 */
export function HintPanel({
  mission,
  stage,
  onReveal,
  onClose,
}: HintPanelProps): ReactElement {
  const titleId = useId();
  const revealed = mission.hints.filter((hint) => hint.stage <= stage);
  const next = mission.hints.find((hint) => hint.stage > stage);

  return (
    <section className={styles.overlay} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2 className={controls.label} id={titleId}>
          Hints
        </h2>
        <button className={controls.button} type="button" onClick={onClose}>
          Close
        </button>
      </header>
      {revealed.length === 0 ? (
        <p className={styles.dim}>
          Each hint gives away more than the one before it. Using hints never
          blocks completion.
        </p>
      ) : (
        <ol className={styles.list}>
          {revealed.map((hint) => (
            <li className={styles.item} key={hint.stage}>
              <p className={controls.label}>
                Stage {hint.stage} · {hintStagePurpose(hint.stage)}
              </p>
              {hint.verified === undefined ? null : (
                <p className={controls.label}>
                  {hint.verified ? "VERIFIED" : "HYPOTHESIS"}
                </p>
              )}
              <p>{hint.text}</p>
              {hint.highlight === undefined ? null : (
                <p className={styles.dim}>
                  Target rows marked HINT show where to look.
                </p>
              )}
              {hint.revealSolution === true ? (
                <pre className={styles.code} aria-label="Solution">
                  {mission.solution}
                </pre>
              ) : null}
              {hint.reveal === undefined ? null : (
                <UpstreamReveal reference={hint.reveal} />
              )}
            </li>
          ))}
        </ol>
      )}
      <button
        className={controls.button}
        type="button"
        disabled={next === undefined}
        onClick={onReveal}
      >
        {next === undefined
          ? "No more hints"
          : next.stage === 9
            ? "Reveal the solution"
            : "Reveal next hint"}
      </button>
    </section>
  );
}

/**
 * One upstream line span, loaded only once its hint is revealed. It is
 * shown read-only, with its path, and never offered for insertion.
 */
function UpstreamReveal({
  reference,
}: {
  readonly reference: RemoteCReference;
}): ReactElement {
  const upstream = useUpstream();
  const [request, setRequest] = useState(0);
  const [outcome, setOutcome] = useState<UpstreamOutcome<string> | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    void upstream.loadC(reference, controller.signal).then((loaded) => {
      if (!controller.signal.aborted) {
        setOutcome(loaded);
      }
    });
    return () => {
      controller.abort();
    };
  }, [upstream, reference, request]);

  const { lines } = reference;
  return (
    <>
      <p className={styles.dim}>
        <code>{reference.path}</code>
        {lines === undefined
          ? null
          : `, lines ${String(lines.start)}–${String(lines.end)}`}
      </p>
      {outcome === undefined ? (
        <p className={styles.dim} role="status">
          Loading the upstream source…
        </p>
      ) : outcome.kind === "loaded" ? (
        <pre className={styles.code} aria-label="Upstream source">
          {outcome.value}
        </pre>
      ) : (
        <div role="alert">
          <p>
            {outcome.kind === "content-mismatch"
              ? UPSTREAM_CONTENT_MISMATCH
              : UPSTREAM_HINT_UNAVAILABLE}
          </p>
          <button
            className={controls.button}
            type="button"
            onClick={() => {
              setOutcome(undefined);
              setRequest((count) => count + 1);
            }}
          >
            Retry
          </button>
        </div>
      )}
    </>
  );
}
