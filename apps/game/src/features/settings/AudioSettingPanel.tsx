import { useId, type ReactElement } from "react";
import { usePlayerProgress } from "../persistence/progressContext";
import {
  audioSettings,
  type AudioChannel,
  type AudioSettings,
} from "../persistence/schema";
import panel from "./SaveDataPanel.module.css";
import styles from "./ScaffoldSettingPanel.module.css";

const CHANNELS: readonly {
  readonly key: keyof AudioSettings;
  readonly label: string;
}[] = [
  { key: "music", label: "Music" },
  { key: "sfx", label: "Sound effects" },
];

/** Sets music and sound-effect volume and mute independently. */
export function AudioSettingPanel(): ReactElement {
  const { state, dispatch } = usePlayerProgress();
  const titleId = useId();
  const audio = audioSettings(state.settings);

  const change = (key: keyof AudioSettings, channel: AudioChannel) => {
    dispatch({
      type: "settings-changed",
      settings: { ...state.settings, audio: { ...audio, [key]: channel } },
    });
  };

  return (
    <section className={panel.panel} aria-labelledby={titleId}>
      <h2 className={panel.title} id={titleId}>
        Audio
      </h2>
      <p>No mission needs sound. This build of OSP plays none yet.</p>
      {CHANNELS.map(({ key, label }) => (
        <fieldset className={styles.choices} key={key}>
          <legend className={styles.legend}>{label}</legend>
          <label className={styles.choice}>
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(audio[key].volume * 100)}
              aria-valuetext={`${String(Math.round(audio[key].volume * 100))}%`}
              onChange={(event) => {
                change(key, {
                  ...audio[key],
                  volume: Number(event.currentTarget.value) / 100,
                });
              }}
            />
          </label>
          <label className={styles.choice}>
            <input
              type="checkbox"
              checked={audio[key].muted}
              onChange={(event) => {
                change(key, {
                  ...audio[key],
                  muted: event.currentTarget.checked,
                });
              }}
            />
            <span>Mute</span>
          </label>
        </fieldset>
      ))}
    </section>
  );
}
