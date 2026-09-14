import { defaultPath, manualEntries, missions, skills } from "@osp/curriculum";
import type { ManualEntry, Mission, Skill } from "@osp/mission-schema";
import { createContext, useContext } from "react";

/** The validated curriculum the game plays. */
export interface MissionCatalog {
  readonly missions: readonly Mission[];
  readonly skills: readonly Skill[];
  readonly manualEntries: readonly ManualEntry[];
  /** Recommended mission order, by ID. */
  readonly defaultPath: readonly string[];
}

export const shippedCatalog: MissionCatalog = {
  missions,
  skills,
  manualEntries,
  defaultPath,
};

/** Missions on the recommended path in its order, then every other mission. */
export function orderedMissions(
  catalog: Pick<MissionCatalog, "missions" | "defaultPath">,
): Mission[] {
  const onPath = catalog.defaultPath.flatMap((id) =>
    catalog.missions.filter((mission) => mission.id === id),
  );
  const offPath = catalog.missions.filter(
    (mission) => !catalog.defaultPath.includes(mission.id),
  );
  return [...onPath, ...offPath];
}

/** The mission after this one on the recommended path. */
export function nextMission(
  catalog: Pick<MissionCatalog, "missions" | "defaultPath">,
  missionId: string,
): Mission | undefined {
  const position = catalog.defaultPath.indexOf(missionId);
  if (position === -1) {
    return undefined;
  }
  const nextId = catalog.defaultPath[position + 1];
  return catalog.missions.find((mission) => mission.id === nextId);
}

export const MissionCatalogContext =
  createContext<MissionCatalog>(shippedCatalog);

export function useMissionCatalog(): MissionCatalog {
  return useContext(MissionCatalogContext);
}
