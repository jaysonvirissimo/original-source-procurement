import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { memoryProgress } from "../../test/progressStorage";
import { samplePlayer } from "../persistence/persistence.test-helpers";
import type { Settings } from "../persistence/schema";
import { AudioServiceContext, useSoundCue } from "./audioContext";

function Player() {
  const play = useSoundCue();
  return (
    <button
      type="button"
      onClick={() => {
        play("confirm");
      }}
    >
      Confirm
    </button>
  );
}

async function renderPlayer(settings: Settings) {
  const service = { play: vi.fn() };
  const progress = memoryProgress({ ...samplePlayer(), settings });
  render(
    <AudioServiceContext value={service}>
      {progress.wrap(<Player />)}
    </AudioServiceContext>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  return service;
}

describe("useSoundCue", () => {
  it("plays at the default sound-effect volume", async () => {
    const service = await renderPlayer({});
    expect(service.play).toHaveBeenCalledWith("confirm", 0.8);
  });

  it("plays nothing when sound effects are muted or silent, whatever the music", async () => {
    const muted = await renderPlayer({
      audio: {
        music: { volume: 1, muted: false },
        sfx: { volume: 1, muted: true },
      },
    });
    expect(muted.play).not.toHaveBeenCalled();
  });

  it("plays nothing at zero volume", async () => {
    const silent = await renderPlayer({
      audio: {
        music: { volume: 1, muted: false },
        sfx: { volume: 0, muted: false },
      },
    });
    expect(silent.play).not.toHaveBeenCalled();
  });
});
