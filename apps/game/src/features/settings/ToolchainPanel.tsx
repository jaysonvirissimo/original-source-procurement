import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import {
  describeOutcome,
  type OutcomeDescription,
} from "../compiler/describeOutcome";
import { useToolchain } from "../compiler/toolchainContext";
import type { ToolchainService } from "../compiler/types";
import { CHECK_SOURCE, checkInput } from "./toolchainCheck";
import styles from "./ToolchainPanel.module.css";

/**
 * Shows the toolchain's versions and compiles a short check source, so a
 * player can confirm the compiler works in this browser. The source never
 * leaves the page.
 */
export function ToolchainPanel(): ReactElement {
  const { state, start } = useToolchain();
  const titleId = useId();

  useEffect(() => {
    start();
  }, [start]);

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 className={styles.title} id={titleId}>
        Toolchain
      </h2>

      {state.status === "idle" || state.status === "starting" ? (
        <p className={styles.status}>Starting the compiler.</p>
      ) : null}

      {state.status === "failed" ? (
        <div className={styles.failure} role="alert">
          <p>The compiler did not start: {state.message}</p>
          <button className={styles.button} type="button" onClick={start}>
            Retry
          </button>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <ToolchainCheck service={state.service} />
      ) : null}
    </section>
  );
}

interface ToolchainCheckProps {
  readonly service: ToolchainService;
}

function ToolchainCheck({ service }: ToolchainCheckProps): ReactElement {
  const [source, setSource] = useState(CHECK_SOURCE);
  const [result, setResult] = useState<OutcomeDescription>();
  const [isRunning, setIsRunning] = useState(false);
  const running = useRef<AbortController | undefined>(undefined);
  const sourceId = useId();

  useEffect(
    () => () => {
      running.current?.abort();
    },
    [],
  );

  const runCheck = async () => {
    const controller = new AbortController();
    running.current = controller;
    setIsRunning(true);
    setResult(undefined);

    const outcome = await service.build(checkInput(source), controller.signal);

    running.current = undefined;
    setIsRunning(false);
    setResult(describeOutcome(outcome));
  };

  return (
    <>
      <dl className={styles.facts}>
        <dt>Compiler build</dt>
        <dd>
          <code>{service.info.psyqWasm.buildId}</code>
        </dd>
        <dt>Preprocessor build</dt>
        <dd>
          <code>{service.info.psyqWasm.preprocessorBuildId}</code>
        </dd>
        <dt>Assembler</dt>
        <dd>
          <code>psyq-asm {service.info.psyqAsmVersion}</code>
        </dd>
      </dl>

      <label className={styles.label} htmlFor={sourceId}>
        Check source
      </label>
      <textarea
        className={styles.source}
        id={sourceId}
        rows={4}
        spellCheck={false}
        value={source}
        onChange={(event) => {
          setSource(event.target.value);
        }}
      />

      <div className={styles.actions}>
        <button
          className={styles.button}
          type="button"
          disabled={isRunning}
          onClick={() => {
            void runCheck();
          }}
        >
          Run check
        </button>
        <button
          className={styles.button}
          type="button"
          disabled={!isRunning}
          onClick={() => {
            running.current?.abort();
          }}
        >
          Cancel
        </button>
      </div>

      <div className={styles.result} aria-live="polite">
        {isRunning ? <p className={styles.status}>Compiling.</p> : null}
        {result === undefined ? null : (
          <>
            <p className={styles[result.tone]}>{result.summary}</p>
            {result.diagnostics.length === 0 ? null : (
              <ul className={styles.diagnostics} aria-label="Diagnostics">
                {result.diagnostics.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )}
            {result.listing.length === 0 ? null : (
              <pre className={styles.listing} aria-label="Assembled words">
                {result.listing.join("\n")}
              </pre>
            )}
          </>
        )}
      </div>
    </>
  );
}
