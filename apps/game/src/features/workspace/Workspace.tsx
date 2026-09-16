import { sha256Hex } from "@osp/curriculum/hash";
import { teachingHypotheses, wordFacts } from "@osp/matching-core";
import type { Mission } from "@osp/mission-schema";
import {
  useCallback,
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
import { useSoundCue } from "../audio/audioContext";
import { buildCue } from "../audio/sounds";
import { Briefing } from "../briefing/Briefing";
import { targetListing } from "../compiler/targetListing";
import { useToolchain } from "../compiler/toolchainContext";
import type { CompilerDiagnostic } from "../compiler/types";
import { nextMission, useMissionCatalog } from "../curriculum/missionCatalog";
import { missingSkills } from "../mission-map/mapModel";
import {
  manualLinks,
  missionAnnotations,
  shownAnnotations,
} from "../diff/annotations";
import { DiffPanel } from "../diff/DiffPanel";
import { TargetListing } from "../diff/TargetListing";
import { CEditor } from "../editor/CEditor";
import {
  usePlayerProgress,
  type SaveStatus,
} from "../persistence/progressContext";
import {
  scaffoldSetting,
  type Attempt,
  type MissionProgress,
} from "../persistence/schema";
import { attemptFrom } from "../progress/attempts";
import { completionMode } from "../progress/completionMode";
import { completionEvidence } from "../progress/evidence";
import { presentationFor, selectScaffold } from "../progress/scaffold";
import {
  completionSkillChanges,
  skillStateOf,
  type SkillState,
} from "../progress/skillState";
import { BuildFeedback } from "../results/BuildFeedback";
import { MatchSummary } from "../results/MatchSummary";
import { MissionComplete } from "../results/MissionComplete";
import { missionProvenance } from "../field/provenance";
import { MemoryLayer } from "../scan/MemoryLayer";
import scan from "../scan/Scan.module.css";
import { ScanPanel } from "../scan/ScanPanel";
import {
  UPSTREAM_CONTENT_MISMATCH,
  UPSTREAM_UNAVAILABLE,
} from "../upstream/messages";
import { useUpstream } from "../upstream/upstreamContext";
import { missionTier, phaseFrom } from "../../vr/presentation";
import { usePublishPresentation } from "../../vr/presentationContext";
import { canAcknowledge, canCorrectPrediction } from "./completion";
import { EvidencePanel } from "./EvidencePanel";
import { HintPanel } from "./HintPanel";
import { HistoryPanel } from "./HistoryPanel";
import { ManualPanel } from "./ManualPanel";
import { matchStatus } from "./matchStatus";
import { loadMissionContext } from "./missionContext";
import {
  missionMatchTarget,
  missionResultFrom,
  type BuildRequest,
} from "./missionResult";
import { PredictionPanel } from "./PredictionPanel";
import { SplitHandle } from "./SplitHandle";
import { starterExplanation } from "./starterExplanation";
import { useSourceAutosave } from "./useSourceAutosave";
import styles from "./Workspace.module.css";
import {
  completionState,
  hintUsage,
  initialWorkspaceState,
  isStale,
  workspaceReducer,
  type Overlay,
} from "./workspaceReducer";

const NO_DIAGNOSTICS: readonly CompilerDiagnostic[] = [];
const NO_ATTEMPTS: readonly Attempt[] = [];

interface WorkspaceProps {
  readonly mission: Mission;
  /** Progress saved before this workspace opened. */
  readonly saved?: MissionProgress | undefined;
}

/**
 * Plays one mission: briefing, editing, compiling, comparing, and
 * completion. Mission state lives in the workspace reducer; this component
 * runs the asynchronous work, dispatches its results, and records progress.
 */
export function Workspace({ mission, saved }: WorkspaceProps): ReactElement {
  const catalog = useMissionCatalog();
  const upstream = useUpstream();
  const { state: toolchain, start } = useToolchain();
  const progress = usePlayerProgress();
  const { dispatch: record, now, newId } = progress;
  const [state, dispatch] = useReducer(
    workspaceReducer,
    { mission, saved },
    (initial) => initialWorkspaceState(initial.mission, initial.saved),
  );
  usePublishPresentation(
    phaseFrom({
      compiling: state.compiling !== undefined,
      result: state.result,
      previousScore: state.previousScore,
    }),
    missionTier(mission.kind),
  );
  const playCue = useSoundCue();
  useEffect(() => {
    if (state.result !== undefined) {
      playCue(buildCue(state.result));
    }
  }, [state.result, playCue]);
  useEffect(() => {
    if (state.completed) {
      playCue("mission-complete");
    }
  }, [state.completed, playCue]);
  // Completions from this visit share it; a later visit records new ones.
  const [sessionId] = useState(newId);
  const [resolveRequest, setResolveRequest] = useState(0);
  const buildCounter = useRef(0);
  const running = useRef<AbortController | undefined>(undefined);

  const { entered, source, context, result, hintStage, completed } = state;
  // An inline target is known before its context resolves; an upstream
  // target only once it has loaded.
  const inlineTarget = useMemo(() => missionMatchTarget(mission), [mission]);
  const target = context.kind === "ready" ? context.target : inlineTarget;
  const listing = useMemo(
    () => (target === undefined ? [] : targetListing(target.words)),
    [target],
  );
  const facts = useMemo(
    () => (target === undefined ? undefined : wordFacts(target.words)),
    [target],
  );
  // Help is chosen once per visit, so evidence recorded when the mission
  // completes does not take notes away while the player is still looking.
  const [{ plan, skillStates }] = useState(() => {
    const states = new Map(
      [
        ...new Set([
          ...mission.requires,
          ...mission.teaches,
          ...mission.practices,
        ]),
      ].map((skill): [string, SkillState] => [
        skill,
        skillStateOf(progress.state.skills, skill),
      ]),
    );
    return {
      skillStates: states,
      plan: selectScaffold(
        mission,
        (skill) => states.get(skill) ?? "NEW",
        scaffoldSetting(progress.state.settings),
      ),
    };
  });
  const annotations = useMemo(() => missionAnnotations(mission), [mission]);
  const shown = useMemo(
    () => shownAnnotations(annotations, plan),
    [annotations, plan],
  );
  // The manual keeps every linked entry, whatever the notes show.
  const linkedEntries = useMemo(() => manualLinks(annotations), [annotations]);
  const { example } = mission;
  // A diagram tied to a skill fades with it, like that skill's notes.
  const showDiagram = presentationFor(
    (example?.skill === undefined
      ? undefined
      : plan.skills.get(example.skill)) ?? plan.layout,
    plan.automaticTeaching,
  ).diagrams;
  const skillNames = useMemo(
    () => new Map(catalog.skills.map((skill) => [skill.id, skill.name])),
    [catalog],
  );
  const missionRef = useMemo(
    () => ({ id: mission.id, starterSource: mission.starterSource }),
    [mission],
  );

  const hypotheses = useMemo(
    () => (result?.kind === "matched" ? teachingHypotheses(result.result) : []),
    [result],
  );

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
    const controller = new AbortController();
    void loadMissionContext(mission, upstream, controller.signal).then(
      (outcome) => {
        dispatch({ type: "context-resolved", outcome });
      },
    );
    return () => {
      controller.abort();
    };
  }, [mission, upstream, resolveRequest]);

  useEffect(
    () => () => {
      running.current?.abort();
    },
    [],
  );

  const saveSource = useCallback(
    (next: string) => {
      record({
        type: "source-saved",
        mission: missionRef,
        source: next,
        at: now(),
      });
    },
    [record, missionRef, now],
  );
  useSourceAutosave(entered ? source : undefined, saveSource);

  useEffect(() => {
    if (hintStage > 0) {
      record({
        type: "hint-stage-saved",
        mission: missionRef,
        stage: hintStage,
        at: now(),
      });
    }
  }, [hintStage, record, missionRef, now]);

  const predictionChoice = state.actions.prediction?.choice;
  const { completedBuildId } = state;
  const completionId = `${sessionId}:${String(completedBuildId)}`;
  useEffect(() => {
    if (!completed) {
      return;
    }
    const at = now();
    const facts = { completionId, hintStage, completedAt: at };
    const evidence = completionEvidence(
      mission,
      predictionChoice === undefined ? facts : { ...facts, predictionChoice },
    );
    const event = {
      type: "mission-completed",
      mission: missionRef,
      completionId,
      at,
      skills: evidence.skills,
    } as const;
    // A repeated completion ID is ignored, so later hint changes add nothing.
    record(
      evidence.prediction === undefined
        ? event
        : { ...event, prediction: evidence.prediction },
    );
  }, [
    completed,
    completionId,
    hintStage,
    predictionChoice,
    mission,
    missionRef,
    record,
    now,
  ]);

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
    playCue("compile");
    const outcome = await toolchain.service.build(
      { ...context.input, source },
      controller.signal,
    );
    running.current = undefined;
    const missionResult = missionResultFrom(
      request,
      outcome,
      mission.symbol,
      context.target,
    );
    dispatch({ type: "build-resolved", result: missionResult });
    // Only a comparison is an attempt; failed builds have nothing to compare.
    if (missionResult.kind === "matched") {
      record({
        type: "attempt-recorded",
        mission: missionRef,
        attempt: attemptFrom({
          id: newId(),
          missionId: mission.id,
          createdAt: now(),
          source,
          match: missionResult.result,
          info: toolchain.service.info,
          aspsxVersion: context.input.aspsxVersion,
          hintStage,
        }),
      });
    }
  };

  const setOverlay = (overlay: Overlay) => {
    dispatch({ type: "overlay-changed", overlay });
  };

  const toggleOverlay = (overlay: Overlay) => {
    setOverlay(state.overlay === overlay ? "none" : overlay);
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
        skillStates={skillStates}
        missing={missingSkills(mission, catalog, progress.state.skills)}
        plan={plan}
        terms={(mission.terms ?? []).flatMap((id) =>
          catalog.manualEntries.filter((entry) => entry.id === id),
        )}
        orientation={catalog.defaultPath[0] === mission.id}
        onEnter={() => {
          dispatch({ type: "entered" });
          record({ type: "mission-started", mission: missionRef, at: now() });
        }}
      />
    );
  }

  // Completion shows above the workspace rather than replacing it, so the
  // comparison and any prediction correction stay in view.
  const showCompletion = completed && !state.reviewing;
  const stale = isStale(state);
  const canCompile =
    toolchain.status === "ready" &&
    context.kind === "ready" &&
    state.compiling === undefined;
  const highlight = mission.hints.findLast(
    (hint) => hint.stage <= state.hintStage && hint.highlight !== undefined,
  )?.highlight;
  const { prediction } = state.actions;
  const predictionOutcome =
    mission.prediction === undefined || prediction === undefined
      ? undefined
      : {
          chosen: mission.prediction.choices[prediction.choice] ?? "",
          answer: mission.prediction.choices[mission.prediction.answer] ?? "",
          correct: prediction.choice === mission.prediction.answer,
        };

  const renderAssembly = (): ReactElement => {
    switch (context.kind) {
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
        if (target === undefined) {
          return (
            <p className={styles.notice} role="status">
              Loading the target from upstream.
            </p>
          );
        }
        return (
          <>
            {result?.kind === "matched" ? (
              <>
                <MatchSummary result={result.result} hints={hintUsage(state)} />
                {stale || source !== mission.starterSource ? null : (
                  <div
                    className={styles.notice}
                    aria-label="About the starting source"
                    role="note"
                  >
                    {starterExplanation(result.result).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                )}
                <DiffPanel
                  result={result.result}
                  stale={stale}
                  highlight={highlight}
                  annotations={shown}
                  hypotheses={hypotheses}
                />
              </>
            ) : (
              <TargetListing
                lines={listing}
                highlight={highlight}
                annotations={shown}
              />
            )}
            {showDiagram && example !== undefined && facts !== undefined ? (
              <section className={scan.inline} aria-label="Machine diagram">
                <h3 className={controls.label}>MEMORY</h3>
                <MemoryLayer example={example} facts={facts} />
              </section>
            ) : null}
          </>
        );
    }
  };

  return (
    <div
      className={classNames(
        styles.workspace,
        showCompletion && styles.completing,
      )}
      data-tier={missionTier(mission.kind)}
      onKeyDown={onKeyDown}
    >
      <header className={styles.header}>
        <p className={controls.label}>OSP {mission.id}</p>
        <h1 className={styles.title}>{mission.title}</h1>
        <p className={styles.objective}>{mission.briefing.objective}</p>
        <p className={styles.status} role="status">
          {matchStatus(state, stale)}
        </p>
        <a className={styles.mapLink} href="#/">
          Mission map
        </a>
      </header>

      {showCompletion ? (
        <MissionComplete
          exact={result?.kind === "matched" && result.result.exact}
          attempts={state.attempts}
          hints={hintUsage(state)}
          mode={completionMode(
            Object.values(progress.state.skills).flatMap(({ evidence }) =>
              evidence.filter((event) => event.completionId === completionId),
            ),
          )}
          prediction={predictionOutcome}
          skillChanges={completionSkillChanges(
            progress.state.skills,
            completionId,
          )}
          skillNames={skillNames}
          next={nextMission(catalog, mission.id)}
          provenance={missionProvenance(mission)}
          onReview={() => {
            dispatch({ type: "review-requested" });
          }}
          onPractice={() => {
            record({
              type: "practice-started",
              mission: missionRef,
              at: now(),
            });
            dispatch({ type: "practice-started" });
          }}
        />
      ) : null}

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
            replacement={state.replacement}
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
                correction={state.actions.correction}
                correctionMiss={state.correctionMiss}
                canCorrect={canCorrectPrediction(completionState(state))}
                onCorrect={(choice) => {
                  dispatch({ type: "prediction-corrected", choice });
                }}
              />
            )}
            {mission.evidence === undefined || completed ? null : (
              <EvidencePanel
                prompt={mission.evidence}
                lines={listing}
                canAcknowledge={canAcknowledge(completionState(state))}
                miss={state.evidenceMiss?.word}
                onAcknowledge={(word) => {
                  dispatch({ type: "evidence-acknowledged", word });
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

      {state.overlay === "scan" ? (
        <ScanPanel
          annotations={annotations}
          facts={facts}
          example={example}
          onClose={() => {
            setOverlay("none");
          }}
        />
      ) : null}
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
          linkedEntries={linkedEntries}
          onClose={() => {
            setOverlay("none");
          }}
        />
      ) : null}
      {state.overlay === "history" ? (
        <HistoryPanel
          attempts={
            progress.state.missions[mission.id]?.attempts ?? NO_ATTEMPTS
          }
          onPin={(attemptId, pinned) => {
            record({
              type: "attempt-pinned",
              missionId: mission.id,
              attemptId,
              pinned,
            });
          }}
          onRestore={(attempt) => {
            dispatch({ type: "attempt-restored", source: attempt.source });
            setOverlay("none");
          }}
          onClear={() => {
            record({ type: "history-cleared", missionId: mission.id });
          }}
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
        <button
          className={controls.button}
          type="button"
          aria-pressed={state.overlay === "scan"}
          onClick={() => {
            toggleOverlay("scan");
          }}
        >
          Scan
        </button>
        <button
          className={controls.button}
          type="button"
          aria-pressed={state.overlay === "hint"}
          onClick={() => {
            toggleOverlay("hint");
          }}
        >
          Hint
        </button>
        <button
          className={controls.button}
          type="button"
          aria-pressed={state.overlay === "manual"}
          onClick={() => {
            toggleOverlay("manual");
          }}
        >
          Manual
        </button>
        <button
          className={controls.button}
          type="button"
          aria-pressed={state.overlay === "history"}
          onClick={() => {
            toggleOverlay("history");
          }}
        >
          History
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
        <p className={styles.saved}>
          {saveLabel(progress.saveStatus, progress.persistent)}
        </p>
      </footer>
    </div>
  );
}

function saveLabel(status: SaveStatus, persistent: boolean): string {
  if (!persistent || status.kind === "failed") {
    return "NOT SAVED";
  }
  return status.kind === "saving" ? "SAVING" : "SAVED";
}
