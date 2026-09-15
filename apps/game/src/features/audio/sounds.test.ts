import { describe, expect, it } from "vitest";
import type { MissionResult } from "../workspace/missionResult";
import { buildCue, channelVolume, silentAudio, SOUND_CUES } from "./sounds";

const request = { missionId: "001", buildId: 1, sourceSha256: "a" };

describe("buildCue", () => {
  it.each([
    [{ kind: "matched", request, result: { exact: true } }, "exact-match"],
    [{ kind: "matched", request, result: { exact: false } }, "mismatch-update"],
    [{ kind: "function-missing", request }, "mismatch-update"],
    [{ kind: "build-failed", request }, "compiler-error"],
  ])("plays %o as %s", (result, cue) => {
    expect(buildCue(result as MissionResult)).toBe(cue);
    expect(SOUND_CUES).toContain(cue);
  });
});

describe("channelVolume", () => {
  const settings = {
    music: { volume: 0.3, muted: true },
    sfx: { volume: 0.7, muted: false },
  };

  it("is silent for a muted channel and the set volume otherwise", () => {
    expect(channelVolume(settings, "music")).toBe(0);
    expect(channelVolume(settings, "sfx")).toBe(0.7);
  });
});

describe("silentAudio", () => {
  it("plays nothing and never throws", () => {
    expect(() => {
      silentAudio.play("mission-complete", 1);
    }).not.toThrow();
  });
});
