import { createContext, useContext } from "react";
import type { ProgressEvent } from "../progress/progressReducer";
import type { SaveDataError } from "./errors";
import type { PlayerState } from "./schema";

export type SaveStatus =
  | { readonly kind: "saved" }
  | { readonly kind: "saving" }
  | { readonly kind: "failed"; readonly error: SaveDataError };

export interface PlayerProgressValue {
  readonly state: PlayerState;
  readonly saveStatus: SaveStatus;
  /** False when the player chose to play without saving. */
  readonly persistent: boolean;
  /** Stored records the load skipped, until the player dismisses the notice. */
  readonly skippedRecords: number;
  readonly dispatch: (event: ProgressEvent) => void;
  /** Writes the latest progress again after a failed save. */
  readonly retrySave: () => void;
  readonly dismissSkipped: () => void;
  /** The current time as an ISO timestamp. */
  readonly now: () => string;
  /** A new unique record ID. */
  readonly newId: () => string;
}

export interface SaveDataValue {
  /** The current progress as a save file, including changes not yet written. */
  readonly exportSave: () => Blob;
  /** Rejects with a `SaveDataError`, changing nothing, when the file is not a valid save. */
  readonly importSave: (file: Blob) => Promise<void>;
  /** Clears progress and downloaded game data. */
  readonly resetProgress: () => Promise<void>;
  readonly clearDownloadedData: () => Promise<void>;
}

export const PlayerProgressContext = createContext<
  PlayerProgressValue | undefined
>(undefined);

export const SaveDataContext = createContext<SaveDataValue | undefined>(
  undefined,
);

export function usePlayerProgress(): PlayerProgressValue {
  const value = useContext(PlayerProgressContext);
  if (value === undefined) {
    throw new Error(
      "usePlayerProgress must be used inside a PersistenceProvider.",
    );
  }
  return value;
}

export function useSaveData(): SaveDataValue {
  const value = useContext(SaveDataContext);
  if (value === undefined) {
    throw new Error("useSaveData must be used inside a PersistenceProvider.");
  }
  return value;
}
