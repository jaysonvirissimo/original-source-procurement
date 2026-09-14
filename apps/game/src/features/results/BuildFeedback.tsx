import type { ReactElement } from "react";
import { formatDiagnostic } from "../compiler/describeOutcome";
import type {
  AssemblerDiagnostic,
  CompilerDiagnostic,
} from "../compiler/types";
import type {
  FailedBuildOutcome,
  MissionResult,
} from "../workspace/missionResult";
import styles from "./BuildFeedback.module.css";

interface BuildFeedbackProps {
  readonly result: Exclude<MissionResult, { kind: "matched" }>;
  readonly stale: boolean;
}

/**
 * Feedback for a build with nothing to compare. Compiler errors are ordinary
 * feedback; an assembler failure is a toolchain defect, not the player's C.
 */
export function BuildFeedback({
  result,
  stale,
}: BuildFeedbackProps): ReactElement {
  return (
    <div className={styles.feedback} aria-label="Build feedback" role="region">
      {stale ? (
        <p className={styles.stale}>
          STALE · The source changed after this build.
        </p>
      ) : null}
      {result.kind === "function-missing" ? (
        <FunctionMissing
          symbol={result.symbol}
          definedFunctions={result.definedFunctions}
        />
      ) : (
        <FailedBuild outcome={result.outcome} />
      )}
    </div>
  );
}

function FunctionMissing({
  symbol,
  definedFunctions,
}: {
  readonly symbol: string;
  readonly definedFunctions: readonly string[];
}): ReactElement {
  return (
    <>
      <p className={styles.warning}>
        The build defined no function named <code>{symbol}</code>.
      </p>
      {definedFunctions.length === 0 ? (
        <p>No functions were found.</p>
      ) : (
        <p>
          Functions found:{" "}
          {definedFunctions.map((name, index) => (
            <span key={name}>
              {index === 0 ? "" : ", "}
              <code>{name}</code>
            </span>
          ))}
        </p>
      )}
    </>
  );
}

function FailedBuild({
  outcome,
}: {
  readonly outcome: FailedBuildOutcome;
}): ReactElement {
  switch (outcome.kind) {
    case "compiler-failure":
      return (
        <>
          <p className={styles.error}>The compiler reported errors.</p>
          <Diagnostics diagnostics={outcome.diagnostics} />
        </>
      );
    case "assembler-failure":
      return (
        <>
          <p className={styles.error}>
            Toolchain error: the assembler rejected the compiler&apos;s output.
            This is a defect in the toolchain, not in your C.
          </p>
          <Diagnostics diagnostics={outcome.diagnostics} />
        </>
      );
    case "cancelled":
      return <p className={styles.neutral}>Compile cancelled.</p>;
    case "timeout":
      return (
        <p className={styles.warning}>
          The compile ran longer than {outcome.timeoutMs / 1000} seconds and was
          stopped.
        </p>
      );
    case "infrastructure-failure":
      return (
        <p className={styles.error}>
          The toolchain failed to run: {outcome.message}
        </p>
      );
  }
}

function Diagnostics({
  diagnostics,
}: {
  readonly diagnostics: readonly (CompilerDiagnostic | AssemblerDiagnostic)[];
}): ReactElement | null {
  if (diagnostics.length === 0) {
    return null;
  }
  return (
    <ul className={styles.diagnostics} aria-label="Diagnostics">
      {diagnostics.map((diagnostic, index) => (
        <li key={index}>{formatDiagnostic(diagnostic)}</li>
      ))}
    </ul>
  );
}
