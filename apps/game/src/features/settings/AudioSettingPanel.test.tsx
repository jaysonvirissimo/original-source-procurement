import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { memoryProgress } from "../../test/progressStorage";
import { samplePlayer } from "../persistence/persistence.test-helpers";
import type { Settings } from "../persistence/schema";
import { AudioSettingPanel } from "./AudioSettingPanel";

async function renderPanel(settings: Settings = {}) {
  const progress = memoryProgress({ ...samplePlayer(), settings });
  render(progress.wrap(<AudioSettingPanel />));
  await screen.findByRole("heading", { name: "Audio" });
  return progress;
}

function channel(name: string) {
  const group = within(screen.getByRole("group", { name }));
  return {
    volume: group.getByRole<HTMLInputElement>("slider", { name: "Volume" }),
    mute: group.getByRole<HTMLInputElement>("checkbox", { name: "Mute" }),
  };
}

describe("AudioSettingPanel", () => {
  it("starts on the default volumes, unmuted, and says sound is not needed", async () => {
    await renderPanel();

    expect(channel("Music").volume.value).toBe("60");
    expect(channel("Sound effects").volume.value).toBe("80");
    expect(channel("Music").mute.checked).toBe(false);
    expect(channel("Sound effects").mute.checked).toBe(false);
    expect(screen.getByText(/No mission needs sound/)).toBeTruthy();
  });

  it("changes music and sound effects independently", async () => {
    await renderPanel({
      audio: {
        music: { volume: 0.25, muted: false },
        sfx: { volume: 1, muted: true },
      },
    });
    expect(channel("Music").volume.value).toBe("25");
    expect(channel("Sound effects").mute.checked).toBe(true);

    fireEvent.click(channel("Music").mute);
    fireEvent.change(channel("Sound effects").volume, {
      target: { value: "40" },
    });

    expect(channel("Music").mute.checked).toBe(true);
    expect(channel("Music").volume.value).toBe("25");
    expect(channel("Sound effects").volume.value).toBe("40");
    expect(channel("Sound effects").mute.checked).toBe(true);
    expect(channel("Sound effects").volume.getAttribute("aria-valuetext")).toBe(
      "40%",
    );
  });
});
