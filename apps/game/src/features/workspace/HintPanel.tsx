import type { Mission, RemoteCReference } from "@osp/mission-schema";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import prose from "../../styles/prose.module.css";
import {
  UPSTREAM_CONTENT_MISMATCH,
  UPSTREAM_HINT_UNAVAILABLE,
} from "../upstream/messages";
import type { UpstreamOutcome } from "../upstream/types";
import { UpstreamErrorState } from "../upstream/UpstreamErrorState";
import { useUpstream } from "../upstream/upstreamContext";
import { hintLabel, revealsSolution } from "./hintLabel";
import styles from "./ReferencePane.module.css";

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
  const newest = useRef<HTMLParagraphElement>(null);
  const openedAt = useRef(stage);

  // The reveal button can end up disabled, which drops focus to the page, so
  // focus follows the newly revealed stage instead.
  useEffect(() => {
    if (stage > openedAt.current) {
      newest.current?.focus();
    }
  }, [stage]);

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h2
          className={classNames(controls.label, styles.heading)}
          id={titleId}
          tabIndex={-1}
        >
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
          {revealed.map((hint, index) => (
            <li className={styles.item} key={hint.stage}>
              <p
                className={classNames(controls.label, styles.heading)}
                ref={index === revealed.length - 1 ? newest : undefined}
                tabIndex={-1}
              >
                {hintLabel(mission.hints, hint)}
              </p>
              {hint.verified === undefined ? null : (
                <p className={controls.label}>
                  {hint.verified ? "VERIFIED" : "HYPOTHESIS"}
                </p>
              )}
              <p className={prose.prose}>{hint.text}</p>
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
      {revealsSolution(next) ? (
        <p className={prose.prose}>
          The next step reveals the solution. Hints never block completion, but
          a completion that uses a revealed solution does not advance skills.
        </p>
      ) : null}
      <button
        className={controls.button}
        type="button"
        disabled={next === undefined}
        onClick={onReveal}
      >
        {next === undefined
          ? "No more hints"
          : revealsSolution(next)
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
        <UpstreamErrorState
          message={
            outcome.kind === "content-mismatch"
              ? UPSTREAM_CONTENT_MISMATCH
              : UPSTREAM_HINT_UNAVAILABLE
          }
          onRetry={() => {
            setOutcome(undefined);
            setRequest((count) => count + 1);
          }}
        />
      )}
    </>
  );
}
