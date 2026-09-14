import type { ReactElement } from "react";
import { useMissionCatalog } from "../features/curriculum/missionCatalog";
import { usePlayerProgress } from "../features/persistence/progressContext";
import { Workspace } from "../features/workspace/Workspace";
import { RoutePanel } from "./RoutePanel";

interface MissionRouteProps {
  readonly missionId: string;
}

export function MissionRoute({ missionId }: MissionRouteProps): ReactElement {
  const { missions } = useMissionCatalog();
  const { state } = usePlayerProgress();
  const mission = missions.find((entry) => entry.id === missionId);

  if (mission === undefined) {
    return (
      <RoutePanel
        title="Mission not found"
        detail={missionId}
        message="No mission in the training program has this ID."
      />
    );
  }
  // A new mission starts a new workspace from its saved progress.
  return (
    <Workspace
      key={mission.id}
      mission={mission}
      saved={state.missions[mission.id]}
    />
  );
}
