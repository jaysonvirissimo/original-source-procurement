import { useCallback, useEffect, useRef, useState } from "react";
import type { CompilationInput, ToolchainService } from "../compiler/types";
import { runOffsetProbe, type ProbeOutcome } from "./offsetProbe";

export type OffsetTableState =
  | { readonly kind: "measuring" }
  | Exclude<ProbeOutcome, { readonly kind: "cancelled" }>;

interface OffsetProbeOptions {
  /** The session's toolchain, once it is ready. */
  readonly service: ToolchainService | undefined;
  /** The mission's resolved input, once it is ready. */
  readonly input: CompilationInput | undefined;
  readonly starterSource: string;
  /** The mission's context types; no table without them. */
  readonly typeNames: readonly string[] | undefined;
  /** True while the player's own build runs; the probe waits for it. */
  readonly paused: boolean;
}

interface OffsetProbe {
  /** Undefined when the mission names no context types. */
  readonly state: OffsetTableState | undefined;
  /**
   * Stops a running probe at once, so the player's build goes first. The
   * probe starts again afterwards, queued behind that build.
   */
  readonly cancel: () => void;
}

/**
 * Measures the mission's context types once its input resolves. The result
 * is component state for this input only: it is never recorded, persisted,
 * exported, or cached. A cancelled probe starts again when the player's
 * build finishes.
 */
export function useOffsetProbe({
  service,
  input,
  starterSource,
  typeNames,
  paused,
}: OffsetProbeOptions): OffsetProbe {
  const [result, setResult] = useState<{
    readonly input: CompilationInput;
    readonly outcome: OffsetTableState;
  }>();
  const running = useRef<AbortController | undefined>(undefined);
  // Bumped by cancel, so a stopped probe starts again even when the
  // player's build finishes before `paused` is ever rendered as true.
  const [attempt, setAttempt] = useState(0);
  const measured = result !== undefined && result.input === input;

  useEffect(() => {
    if (
      typeNames === undefined ||
      service === undefined ||
      input === undefined ||
      paused ||
      measured
    ) {
      return;
    }
    const controller = new AbortController();
    running.current = controller;
    void runOffsetProbe(
      service,
      input,
      starterSource,
      typeNames,
      controller.signal,
    ).then((outcome) => {
      if (!controller.signal.aborted && outcome.kind !== "cancelled") {
        setResult({ input, outcome });
      }
    });
    return () => {
      controller.abort();
    };
  }, [service, input, starterSource, typeNames, paused, measured, attempt]);

  const cancel = useCallback(() => {
    running.current?.abort();
    setAttempt((count) => count + 1);
  }, []);

  return {
    state:
      typeNames === undefined
        ? undefined
        : measured
          ? result.outcome
          : { kind: "measuring" },
    cancel,
  };
}
