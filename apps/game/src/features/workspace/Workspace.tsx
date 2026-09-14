import { sha256Hex } from "@osp/curriculum/hash";
import type { Mission } from "@osp/mission-schema";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import { Briefing } from "../briefing/Briefing";
import { createMissionContextResolver } from "../compiler/missionContextResolver";
import { targetListing } from "../compiler/targetListing";
import { useToolchain } from "../compiler/toolchainContext";
import type { CompilerDiagnostic } from "../compiler/types";
import { useMissionCatalog } from "../curriculum/missionCatalog";
import { DiffPanel } from "../diff/DiffPanel";
import { TargetListing } from "../diff/TargetListing";
import { CEditor } from "../editor/CEditor";
import { BuildFeedback } from "../results/BuildFeedback";
import { MatchSummary } from "../results/MatchSummary";
import { MissionComplete } from "../results/MissionComplete";
import { useUpstream } from "../upstream/upstreamContext";
import { canAcknowledge } from "./completion";
import { HintPanel } from "./HintPanel";
import { ManualPanel } from "./ManualPanel";
import { matchStatus } from "./matchStatus";
import {
  missionMatchTarget,
  missionResultFrom,
  type BuildRequest,
} from "./missionResult";
import { PredictionPanel } from "./PredictionPanel";
import { SplitHandle } from "./SplitHandle";
import styles from "./Workspace.module.css";
import {
  completionState,
  hintsUsed,
  initialWorkspaceState,
  isStale,
  workspaceReducer,
  type Overlay,
} from "./workspaceReducer";

const NO_DIAGNOSTICS: readonly CompilerDiagnostic[] = [];

const UPSTREAM_UNAVAILABLE =
  "Field missions load their targets from the mgs_reversing project on GitHub, and OSP couldn't reach it. Training missions still work. Check your connection and try again.";
const UPSTREAM_CONTENT_MISMATCH =
  "The game data OSP downloaded for this mission didn't match what it expected, so it wasn't used. Try again later.";

interface WorkspaceProps {
  readonly mission: Mission;
}

/**
 * Plays one mission: briefing, editing, compiling, comparing, and
 * completion. Mission state lives in the workspace reducer; this component
 * runs the asynchronous work and dispatches its results.
 */
export function Workspace({ mission }: WorkspaceProps): ReactElement {
  const catalog = useMissionCatalog();
  const upstream = useUpstream();
  const { state: toolchain, start } = useToolchain();
  const [state, dispatch] = useReducer(
    workspaceReducer,
    mission,
    initialWorkspaceState,
  );
  const [resolveRequest, setResolveRequest] = useState(0);
  const buildCounter = useRef(0);
  const running = useRef<AbortController | undefined>(undefined);

  const target = useMemo(() => missionMatchTarget(mission), [mission]);
  const listing = useMemo(
    () => (target === undefined ? [] : targetListing(target.words)),
    [target],
  );
  const skillNames = useMemo(
    () => new Map(catalog.skills.map((skill) => [skill.id, skill.name])),
    [catalog],
  );

  const { entered, source, context, result } = state;
  const unsupported = context.kind === "unsupported-target";

  // The briefing does not need the compiler, so it starts on entry.
  useEffect(() => {
    if (entered) {
      start();
    }
  }, [entered, start]);

  useEffect(() => {
    void sha256Hex(source).then((sha256) => {
      dispatch({ type: "source-hashed", source, sha256 });
    });
  }, [source]);

  useEffect(() => {
    if (unsupported) {
      return;
    }
    const controller = new AbortController();
    void createMissionContextResolver(upstream)
      .resolve(mission, mission.starterSource, controller.signal)
      .then((outcome) => {
        dispatch({ type: "context-resolved", outcome });
      });
    return () => {
      controller.abort();
    };
  }, [mission, upstream, unsupported, resolveRequest]);

  useEffect(
    () => () => {
      running.current?.abort();
    },
    [],
  );

  const diagnostics = useMemo(
    () =>
      result?.kind === "build-failed" &&
      result.outcome.kind === "compiler-failure"
        ? result.outcome.diagnostics
        : NO_DIAGNOSTICS,
    [result],
  );

  const compile = async (): Promise<void> => {
    if (
      toolchain.status !== "ready" ||
      context.kind !== "ready" ||
      target === undefined ||
      running.current !== undefined
    ) {
      return;
    }
    const controller = new AbortController();
    running.current = controller;
    const request: BuildRequest = {
      missionId: mission.id,
      buildId: (buildCounter.current += 1),
      sourceSha256: await sha256Hex(source),
    };
    dispatch({ type: "compile-started", request });
    const outcome = await toolchain.service.build(
      { ...context.input, source },
      controller.signal,
    );
    running.current = undefined;
    dispatch({
      type: "build-resolved",
      result: missionResultFrom(request, outcome, mission.symbol, target),
    });
  };

  const setOverlay = (overlay: Overlay) => {
    dispatch({ type: "overlay-changed", overlay });
  };

  const retryContext = () => {
    dispatch({ type: "context-requested" });
    setResolveRequest((count) => count + 1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === "Escape" && state.overlay !== "none") {
      event.preventDefault();
      setOverlay("none");
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void compile();
    }
  };

  if (!entered) {
    return (
      <Briefing
        mission={mission}
        skillNames={skillNames}
        onEnter={() => {
          dispatch({ type: "entered" });
        }}
      />
    );
  }

  if (state.completed && !state.reviewing) {
    return (
      <MissionComplete
        mission={mission}
        exact={result?.kind === "matched" && result.result.exact}
        attempts={state.attempts}
        hints={hintsUsed(state)}
        skillNames={skillNames}
        onReview={() => {
          dispatch({ type: "review-requested" });
        }}
      />
    );
  }

  const stale = isStale(state);
  const canCompile =
    toolchain.status === "ready" &&
    context.kind === "ready" &&
    state.compiling === undefined;
  const highlight = mission.hints.findLast(
    (hint) => hint.stage <= state.hintStage && hint.highlight !== undefined,
  )?.highlight;
  const { prediction } = state.actions;

  const renderAssembly = (): ReactElement => {
    switch (context.kind) {
      case "unsupported-target":
        return (
          <p className={styles.alert} role="alert">
            This mission loads its target from upstream, which this build of OSP
            cannot do yet. Training missions still work.
          </p>
        );
      case "unavailable":
      case "content-mismatch":
        return (
          <div className={styles.alert} role="alert">
            <p>
              {context.kind === "unavailable"
                ? UPSTREAM_UNAVAILABLE
                : UPSTREAM_CONTENT_MISMATCH}
            </p>
            <p>
              <code>{context.path}</code>
            </p>
            <button
              className={controls.button}
              type="button"
              onClick={retryContext}
            >
              Retry
            </button>
          </div>
        );
      case "resolving":
      case "ready":
        return result?.kind === "matched" ? (
          <>
            <MatchSummary result={result.result} />
            <DiffPanel
              result={result.result}
              stale={stale}
              highlight={highlight}
            />
          </>
        ) : (
          <TargetListing lines={listing} highlight={highlight} />
        );
    }
  };

  return (
    <div className={styles.workspace} onKeyDown={onKeyDown}>
      <header className={styles.header}>
        <p className={controls.label}>OSP {mission.id}</p>
        <h1 className={styles.title}>{mission.title}</h1>
        <p className={styles.objective}>{mission.briefing.objective}</p>
        <p className={styles.status} role="status">
          {matchStatus(state, stale)}
        </p>
      </header>

      <div
        className={styles.split}
        style={{
          gridTemplateColumns: `minmax(0, ${String(state.split)}fr) auto minmax(0, ${String(1 - state.split)}fr)`,
        }}
      >
        <section className={styles.pane} aria-label="Your C">
          <h2 className={controls.label}>YOUR C</h2>
          <CEditor
            initialSource={source}
            label="C source"
            filename={mission.compiler.filename}
            diagnostics={diagnostics}
            onChange={(next) => {
              dispatch({ type: "edited", source: next });
            }}
            onCompile={() => {
              void compile();
            }}
          />
          <div className={styles.below}>
            {mission.prediction === undefined ? null : (
              <PredictionPanel
                prompt={mission.prediction}
                recorded={prediction}
                revealed={
                  prediction !== undefined &&
                  result?.kind === "matched" &&
                  result.request.buildId >= prediction.nextBuildId
                }
                onRecord={(choice) => {
                  dispatch({ type: "prediction-recorded", choice });
                }}
              />
            )}
            {result === undefined || result.kind === "matched" ? null : (
              <BuildFeedback result={result} stale={stale} />
            )}
          </div>
        </section>

        <SplitHandle
          value={state.split}
          onChange={(split) => {
            dispatch({ type: "split-resized", split });
          }}
        />

        <section
          className={classNames(styles.pane, styles.assembly)}
          aria-label="Assembly"
        >
          <h2 className={controls.label}>TARGET / GENERATED</h2>
          {renderAssembly()}
        </section>
      </div>

      {state.overlay === "hint" ? (
        <HintPanel
          mission={mission}
          stage={state.hintStage}
          onReveal={() => {
            dispatch({ type: "hint-revealed" });
          }}
          onClose={() => {
            setOverlay("none");
          }}
        />
      ) : null}
      {state.overlay === "manual" ? (
        <ManualPanel
          mission={mission}
          catalog={catalog}
          onClose={() => {
            setOverlay("none");
          }}
        />
      ) : null}

      <footer className={styles.controls}>
        <button
          className={classNames(controls.button, controls.primary)}
          type="button"
          disabled={!canCompile}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          onClick={() => {
            void compile();
          }}
        >
          {state.compiling === undefined ? "Compile" : "Compiling"}
        </button>
        <button
          className={controls.button}
          type="button"
          disabled={state.compiling === undefined}
          onClick={() => {
            running.current?.abort();
          }}
        >
          Cancel
        </button>
        {mission.completion === "acknowledge-evidence" ? (
          <button
            className={controls.button}
            type="button"
            disabled={!canAcknowledge(completionState(state))}
            onClick={() => {
              dispatch({ type: "evidence-acknowledged" });
            }}
          >
            Acknowledge evidence
          </button>
        ) : null}
        <button
          className={controls.button}
          type="button"
          aria-pressed={state.overlay === "hint"}
          onClick={() => {
            setOverlay(state.overlay === "hint" ? "none" : "hint");
          }}
        >
          Hint
        </button>
        <button
          className={controls.button}
          type="button"
          aria-pressed={state.overlay === "manual"}
          onClick={() => {
            setOverlay(state.overlay === "manual" ? "none" : "manual");
          }}
        >
          Manual
        </button>
        {toolchain.status === "failed" ? (
          <div className={styles.alert} role="alert">
            <p>The compiler did not start: {toolchain.message}</p>
            <button className={controls.button} type="button" onClick={start}>
              Retry
            </button>
          </div>
        ) : toolchain.status === "ready" ? (
          context.kind === "resolving" ? (
            <p className={styles.notice}>Loading mission context.</p>
          ) : null
        ) : (
          <p className={styles.notice}>Starting the compiler.</p>
        )}
        <p className={styles.attempt}>
          ATTEMPT {String(state.attempts).padStart(2, "0")}
        </p>
      </footer>
    </div>
  );
}
