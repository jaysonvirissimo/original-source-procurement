import { createContext, use, useCallback, useEffect, useRef } from "react";
import { usePlayerProgress } from "../persistence/progressContext";
import { audioSettings } from "../persistence/schema";
import {
  channelVolume,
  silentAudio,
  type AudioService,
  type SoundCue,
} from "./sounds";

export const AudioServiceContext = createContext<AudioService>(silentAudio);

/**
 * A stable function that plays a cue at the player's sound-effect volume.
 * A muted or zero-volume channel plays nothing.
 */
export function useSoundCue(): (cue: SoundCue) => void {
  const service = use(AudioServiceContext);
  const { state } = usePlayerProgress();
  const volume = channelVolume(audioSettings(state.settings), "sfx");
  // Read at play time, so a settings change never replays a cue.
  const latestVolume = useRef(volume);
  useEffect(() => {
    latestVolume.current = volume;
  }, [volume]);

  return useCallback(
    (cue: SoundCue) => {
      if (latestVolume.current > 0) {
        service.play(cue, latestVolume.current);
      }
    },
    [service],
  );
}
