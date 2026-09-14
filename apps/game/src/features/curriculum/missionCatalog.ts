import { manualEntries, missions, skills } from "@osp/curriculum";
import type { ManualEntry, Mission, Skill } from "@osp/mission-schema";
import { createContext, useContext } from "react";

/** The validated curriculum the game plays. */
export interface MissionCatalog {
  readonly missions: readonly Mission[];
  readonly skills: readonly Skill[];
  readonly manualEntries: readonly ManualEntry[];
}

export const shippedCatalog: MissionCatalog = {
  missions,
  skills,
  manualEntries,
};

export const MissionCatalogContext =
  createContext<MissionCatalog>(shippedCatalog);

export function useMissionCatalog(): MissionCatalog {
  return useContext(MissionCatalogContext);
}
