import {
  shippedCatalog,
  type MissionCatalog,
} from "../features/curriculum/missionCatalog";
import { fieldMission } from "./fieldFixture";

/** The shipped curriculum plus the browser-test field mission, off the path. */
export async function fixtureCatalog(): Promise<MissionCatalog> {
  return {
    ...shippedCatalog,
    missions: [...shippedCatalog.missions, await fieldMission()],
  };
}
