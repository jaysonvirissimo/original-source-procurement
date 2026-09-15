import type { AudioChannel, AudioSettings } from "../persistence/schema";
import type { MissionResult } from "../workspace/missionResult";

/** Every sound the game may play. No mission needs any of them. */
export const SOUND_CUES = [
  "move-select",
  "confirm",
  "compile",
  "compiler-error",
  "mismatch-update",
  "exact-match",
  "mission-complete",
] as const;
export type SoundCue = (typeof SOUND_CUES)[number];

/** Plays cues. OSP ships a silent one until original sounds exist. */
export interface AudioService {
  /** `volume` is between 0 and 1, and above 0. */
  play(cue: SoundCue, volume: number): void;
}

export const silentAudio: AudioService = {
  play: () => undefined,
};

/** The cue for a finished build. */
export function buildCue(result: MissionResult): SoundCue {
  switch (result.kind) {
    case "matched":
      return result.result.exact ? "exact-match" : "mismatch-update";
    case "function-missing":
      return "mismatch-update";
    case "build-failed":
      return "compiler-error";
  }
}

/** A channel's playing volume: 0 when muted. */
export function channelVolume(
  settings: AudioSettings,
  channel: keyof AudioSettings,
): number {
  const { volume, muted }: AudioChannel = settings[channel];
  return muted ? 0 : volume;
}
