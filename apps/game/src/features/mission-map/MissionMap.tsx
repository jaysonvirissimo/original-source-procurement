import type { Mission } from "@osp/mission-schema";
import { useMemo, type ReactElement } from "react";
import controls from "../../styles/controls.module.css";
import { useMissionCatalog } from "../curriculum/missionCatalog";
import { usePlayerProgress } from "../persistence/progressContext";
import {
  MAP_VIEW_SETTINGS,
  mapViewSetting,
  type MapViewSetting,
} from "../persistence/schema";
import { LaneMap } from "./LaneMap";
import { missionMapModel } from "./mapModel";
import styles from "./MissionMap.module.css";
import { MissionList } from "./MissionList";

const VIEW_LABELS: Readonly<Record<MapViewSetting, string>> = {
  map: "Map",
  list: "List",
};

// Shortcut links name the mission title first, so they never share an
// accessible name with the mission's own node.
function missionLink(mission: Mission): ReactElement {
  return (
    <a href={`#/mission/${encodeURIComponent(mission.id)}`}>
      {mission.title} ({mission.id})
    </a>
  );
}

/**
 * The home screen: where the player stands in training, what to play next,
 * and every mission, as phase lanes or a searchable list.
 */
export function MissionMap(): ReactElement {
  const catalog = useMissionCatalog();
  const { state, dispatch } = usePlayerProgress();
  const model = useMemo(
    () => missionMapModel(catalog, state),
    [catalog, state],
  );
  const skillNames = useMemo(
    () => new Map(catalog.skills.map((skill) => [skill.id, skill.name])),
    [catalog],
  );
  const view = mapViewSetting(state.settings);
  const { recommended, resume } = model;
  const phase = (recommended ?? resume)?.mission.phase;

  return (
    <section className={styles.map} aria-label="Mission map">
      <div className={styles.bar}>
        <h2 className={styles.title}>Mission map</h2>
        <p className={styles.readout}>
          {phase === undefined ? "Training complete" : `Phase · ${phase}`}
        </p>
        <p className={styles.readout}>
          {`${String(model.completed)} of ${String(model.total)} complete`}
        </p>
        <div className={styles.views} role="group" aria-label="Mission view">
          {MAP_VIEW_SETTINGS.map((setting) => (
            <button
              className={controls.button}
              key={setting}
              type="button"
              aria-pressed={view === setting}
              onClick={() => {
                dispatch({
                  type: "settings-changed",
                  settings: { ...state.settings, mapView: setting },
                });
              }}
            >
              {VIEW_LABELS[setting]}
            </button>
          ))}
        </div>
      </div>
      {recommended === undefined && resume === undefined ? null : (
        <p className={styles.next}>
          {resume === undefined ? null : (
            <span>Resume: {missionLink(resume.mission)}</span>
          )}
          {recommended === undefined ||
          recommended.mission.id === resume?.mission.id ? null : (
            <span>Recommended: {missionLink(recommended.mission)}</span>
          )}
        </p>
      )}
      {view === "map" ? (
        <LaneMap regions={model.regions} />
      ) : (
        <MissionList entries={model.entries} skillNames={skillNames} />
      )}
    </section>
  );
}
