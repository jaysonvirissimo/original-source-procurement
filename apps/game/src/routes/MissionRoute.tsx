import type { ReactElement } from "react";
import { useMissionCatalog } from "../features/curriculum/missionCatalog";
import { Workspace } from "../features/workspace/Workspace";
import { RoutePanel } from "./RoutePanel";

interface MissionRouteProps {
  readonly missionId: string;
}

export function MissionRoute({ missionId }: MissionRouteProps): ReactElement {
  const { missions } = useMissionCatalog();
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
  // A new mission starts a new workspace.
  return <Workspace key={mission.id} mission={mission} />;
}
