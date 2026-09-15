import { useId, type ReactElement } from "react";
import { usePlayerProgress } from "../persistence/progressContext";
import {
  GRAPHICS_SETTINGS,
  graphicsSetting,
  MOTION_SETTINGS,
  motionSetting,
  type GraphicsSetting,
  type MotionSetting,
} from "../persistence/schema";
import panel from "./SaveDataPanel.module.css";
import styles from "./ScaffoldSettingPanel.module.css";

const GRAPHICS: Readonly<
  Record<GraphicsSetting, { readonly label: string; readonly detail: string }>
> = {
  full: {
    label: "Full",
    detail: "Draws the 3D training chamber behind the workspace.",
  },
  simple: {
    label: "Simple",
    detail: "Keeps a flat grid and never starts 3D rendering.",
  },
};

const MOTION: Readonly<
  Record<MotionSetting, { readonly label: string; readonly detail: string }>
> = {
  system: {
    label: "System",
    detail: "Follows this device's reduced-motion preference.",
  },
  reduced: {
    label: "Reduced",
    detail: "No camera movement, drifting shapes, or animated transitions.",
  },
};

/** Chooses how the decorative background and motion are presented. */
export function GraphicsSettingPanel(): ReactElement {
  const { state, dispatch } = usePlayerProgress();
  const titleId = useId();
  const graphics = graphicsSetting(state.settings);
  const motion = motionSetting(state.settings);

  return (
    <section className={panel.panel} aria-labelledby={titleId}>
      <h2 className={panel.title} id={titleId}>
        Graphics and motion
      </h2>
      <p>Everything needed to play is shown in the panels either way.</p>
      <fieldset className={styles.choices}>
        <legend className={styles.legend}>Background</legend>
        {GRAPHICS_SETTINGS.map((setting) => (
          <label className={styles.choice} key={setting}>
            <input
              type="radio"
              name={`${titleId}-graphics`}
              value={setting}
              checked={graphics === setting}
              onChange={() => {
                dispatch({
                  type: "settings-changed",
                  settings: { ...state.settings, graphics: setting },
                });
              }}
            />
            <span>
              <strong>{GRAPHICS[setting].label}</strong>{" "}
              {GRAPHICS[setting].detail}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.choices}>
        <legend className={styles.legend}>Motion</legend>
        {MOTION_SETTINGS.map((setting) => (
          <label className={styles.choice} key={setting}>
            <input
              type="radio"
              name={`${titleId}-motion`}
              value={setting}
              checked={motion === setting}
              onChange={() => {
                dispatch({
                  type: "settings-changed",
                  settings: { ...state.settings, motion: setting },
                });
              }}
            />
            <span>
              <strong>{MOTION[setting].label}</strong> {MOTION[setting].detail}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
