import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { classNames } from "../../styles/classNames";
import controls from "../../styles/controls.module.css";
import { pruneAttempts } from "../progress/attempts";
import { progressReducer } from "../progress/progressReducer";
import { storageError, type SaveDataError } from "./errors";
import { createMemoryStorage } from "./memoryPersistence";
import styles from "./PersistenceProvider.module.css";
import {
  PlayerProgressContext,
  SaveDataContext,
  type PlayerProgressValue,
  type SaveDataValue,
} from "./progressContext";
import { readSaveFile, saveFileBlob, saveFileFrom } from "./saveFile";
import { emptyPlayerState, type PlayerState } from "./schema";
import type { BrowserStorage } from "./types";

const defaultNow = () => new Date().toISOString();
const defaultNewId = () => crypto.randomUUID();

interface PersistenceProviderProps {
  readonly openStorage: () => Promise<BrowserStorage>;
  readonly now?: () => string;
  readonly newId?: () => string;
  readonly children: ReactNode;
}

type Boot =
  | { readonly kind: "loading" }
  | {
      readonly kind: "failed";
      readonly error: SaveDataError;
      /** Present when storage opened but its contents could not be loaded. */
      readonly storage: BrowserStorage | undefined;
    }
  | {
      readonly kind: "ready";
      readonly storage: BrowserStorage;
      readonly initial: PlayerState;
      readonly skipped: number;
      readonly persistent: boolean;
    };

/**
 * Loads player progress before anything that shows it renders, then saves
 * every change. When storage fails to open, the player can retry or play
 * without saving.
 */
export function PersistenceProvider({
  openStorage,
  now = defaultNow,
  newId = defaultNewId,
  children,
}: PersistenceProviderProps): ReactElement {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const [openRequest, setOpenRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let opened: BrowserStorage | undefined;
    const start = async () => {
      try {
        opened = await openStorage();
        const initial = await opened.persistence.load();
        if (cancelled) {
          opened.close();
          return;
        }
        setBoot({
          kind: "ready",
          storage: opened,
          initial,
          skipped: opened.persistence.lastLoadReport().skippedRecords,
          persistent: true,
        });
      } catch (error) {
        if (cancelled) {
          opened?.close();
          return;
        }
        setBoot({
          kind: "failed",
          error: storageError(error, "open"),
          storage: opened,
        });
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, [openStorage, openRequest]);

  const retry = () => {
    setBoot({ kind: "loading" });
    setOpenRequest((count) => count + 1);
  };

  switch (boot.kind) {
    case "loading":
      return <p className={styles.loading}>Loading save data.</p>;
    case "failed": {
      const { error, storage } = boot;
      return (
        <SaveDataFailure
          error={error}
          onRetry={retry}
          onPlayWithoutSaving={() => {
            setBoot({
              kind: "ready",
              storage: createMemoryStorage({ now }),
              initial: emptyPlayerState(),
              skipped: 0,
              persistent: false,
            });
          }}
          onReset={
            error.kind === "corrupt" && storage !== undefined
              ? async () => {
                  try {
                    await storage.persistence.reset();
                    retry();
                  } catch (resetError) {
                    setBoot({
                      kind: "failed",
                      error: storageError(resetError, "write"),
                      storage,
                    });
                  }
                }
              : undefined
          }
        />
      );
    }
    case "ready":
      return (
        <ProgressSession
          storage={boot.storage}
          initial={boot.initial}
          skipped={boot.skipped}
          persistent={boot.persistent}
          now={now}
          newId={newId}
        >
          {children}
        </ProgressSession>
      );
  }
}

interface SaveDataFailureProps {
  readonly error: SaveDataError;
  readonly onRetry: () => void;
  readonly onPlayWithoutSaving: () => void;
  /** Offered only for a save that cannot be read. */
  readonly onReset: (() => Promise<void>) | undefined;
}

function SaveDataFailure({
  error,
  onRetry,
  onPlayWithoutSaving,
  onReset,
}: SaveDataFailureProps): ReactElement {
  const titleId = useId();
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <p className={styles.label}>OSP</p>
      <h1 className={styles.title} id={titleId}>
        Save data
      </h1>
      <p className={styles.alertMessage} role="alert">
        {error.message}
      </p>
      <div className={styles.actions}>
        <button
          className={classNames(controls.button, controls.primary)}
          type="button"
          onClick={onRetry}
        >
          Retry
        </button>
        <button
          className={controls.button}
          type="button"
          onClick={onPlayWithoutSaving}
        >
          Play without saving
        </button>
      </div>
      {onReset === undefined ? null : <ResetSaveData onReset={onReset} />}
    </section>
  );
}

function ResetSaveData({
  onReset,
}: {
  readonly onReset: () => Promise<void>;
}): ReactElement {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className={styles.actions}>
        <button
          className={controls.button}
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
        >
          Reset save data
        </button>
      </div>
    );
  }
  return (
    <div className={styles.actions}>
      <p className={styles.message}>
        Reset save data? This deletes all saved progress and downloaded game
        data.
      </p>
      <button
        className={controls.button}
        type="button"
        onClick={() => {
          setConfirming(false);
          void onReset();
        }}
      >
        Reset
      </button>
      <button
        className={controls.button}
        type="button"
        onClick={() => {
          setConfirming(false);
        }}
      >
        Keep save data
      </button>
    </div>
  );
}

interface ProgressSessionProps {
  readonly storage: BrowserStorage;
  readonly initial: PlayerState;
  readonly skipped: number;
  readonly persistent: boolean;
  readonly now: () => string;
  readonly newId: () => string;
  readonly children: ReactNode;
}

function ProgressSession({
  storage,
  initial,
  skipped,
  persistent,
  now,
  newId,
  children,
}: ProgressSessionProps): ReactElement {
  const [state, dispatch] = useReducer(progressReducer, initial);
  // The newest state storage has accepted.
  const [saved, setSaved] = useState(initial);
  const [failure, setFailure] = useState<SaveDataError | undefined>(undefined);
  const [saveRequest, setSaveRequest] = useState(0);
  const [skippedRecords, setSkippedRecords] = useState(skipped);
  const inFlight = useRef<Promise<void> | undefined>(undefined);

  // One save at a time. Changes made during a save are written together once
  // it finishes, because accepting that save changes `saved`.
  useEffect(() => {
    if (state === saved || inFlight.current !== undefined) {
      return;
    }
    const target = state;
    inFlight.current = storage.persistence.save(target).then(
      () => {
        inFlight.current = undefined;
        setFailure(undefined);
        setSaved(target);
      },
      (error: unknown) => {
        inFlight.current = undefined;
        setFailure(storageError(error, "write"));
      },
    );
  }, [state, saved, storage, saveRequest]);

  // Attempts are pruned only once the save that added them has succeeded.
  useEffect(() => {
    for (const [missionId, mission] of Object.entries(saved.missions)) {
      if (pruneAttempts(mission.attempts) !== mission.attempts) {
        dispatch({ type: "attempts-pruned", missionId });
      }
    }
  }, [saved]);

  const progress = useMemo<PlayerProgressValue>(
    () => ({
      state,
      saveStatus:
        failure !== undefined
          ? { kind: "failed", error: failure }
          : state === saved
            ? { kind: "saved" }
            : { kind: "saving" },
      persistent,
      skippedRecords,
      dispatch,
      retrySave: () => {
        setSaveRequest((count) => count + 1);
      },
      dismissSkipped: () => {
        setSkippedRecords(0);
      },
      now,
      newId,
    }),
    [state, saved, failure, persistent, skippedRecords, now, newId],
  );

  const saveData = useMemo<SaveDataValue>(() => {
    const settle = async () => {
      while (inFlight.current !== undefined) {
        await inFlight.current;
      }
    };
    const replace = (player: PlayerState) => {
      setFailure(undefined);
      setSaved(player);
      dispatch({ type: "state-replaced", state: player });
    };
    return {
      exportSave: () => saveFileBlob(saveFileFrom(state, now())),
      importSave: async (file) => {
        const data = await readSaveFile(file);
        await settle();
        replace(await storage.persistence.import(data));
      },
      resetProgress: async () => {
        await settle();
        await storage.persistence.reset();
        replace(emptyPlayerState());
      },
      clearDownloadedData: () => storage.upstreamCache.clear(),
    };
  }, [state, storage, now]);

  return (
    <PlayerProgressContext value={progress}>
      <SaveDataContext value={saveData}>{children}</SaveDataContext>
    </PlayerProgressContext>
  );
}
