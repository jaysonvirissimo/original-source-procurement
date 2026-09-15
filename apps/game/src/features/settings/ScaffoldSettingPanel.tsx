import { useId, type ReactElement } from "react";
import { usePlayerProgress } from "../persistence/progressContext";
import {
  SCAFFOLD_SETTINGS,
  scaffoldSetting,
  type ScaffoldSetting,
} from "../persistence/schema";
import panel from "./SaveDataPanel.module.css";
import styles from "./ScaffoldSettingPanel.module.css";

const CHOICES: Readonly<
  Record<ScaffoldSetting, { readonly label: string; readonly detail: string }>
> = {
  adaptive: {
    label: "Adaptive",
    detail:
      "Notes and diagrams fade for each skill as you practice it. Scan shows them again.",
  },
  full: {
    label: "Full",
    detail: "Every mission shows all the notes and diagrams it has.",
  },
  minimal: {
    label: "Minimal",
    detail:
      "No notes or diagrams appear on their own. Scan, hints, and the manual still work.",
  },
};

/** Chooses how much teaching help missions show without being asked. */
export function ScaffoldSettingPanel(): ReactElement {
  const { state, dispatch } = usePlayerProgress();
  const titleId = useId();
  const current = scaffoldSetting(state.settings);

  return (
    <section className={panel.panel} aria-labelledby={titleId}>
      <h2 className={panel.title} id={titleId}>
        Teaching support
      </h2>
      <fieldset className={styles.choices}>
        <legend className={styles.legend}>Notes and diagrams</legend>
        {SCAFFOLD_SETTINGS.map((setting) => (
          <label className={styles.choice} key={setting}>
            <input
              type="radio"
              name={titleId}
              value={setting}
              checked={current === setting}
              onChange={() => {
                dispatch({
                  type: "settings-changed",
                  settings: { ...state.settings, scaffold: setting },
                });
              }}
            />
            <span>
              <strong>{CHOICES[setting].label}</strong>{" "}
              {CHOICES[setting].detail}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
