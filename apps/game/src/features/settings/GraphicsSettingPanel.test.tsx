import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { memoryProgress } from "../../test/progressStorage";
import { samplePlayer } from "../persistence/persistence.test-helpers";
import type { Settings } from "../persistence/schema";
import { GraphicsSettingPanel } from "./GraphicsSettingPanel";

async function renderPanel(settings: Settings = {}) {
  const player = samplePlayer();
  const progress = memoryProgress({ ...player, settings });
  render(progress.wrap(<GraphicsSettingPanel />));
  await screen.findByRole("heading", { name: "Graphics and motion" });
  return progress;
}

function radio(group: string, name: RegExp): HTMLInputElement {
  return within(screen.getByRole("group", { name: group })).getByRole("radio", {
    name,
  });
}

describe("GraphicsSettingPanel", () => {
  it("starts on full graphics and system motion", async () => {
    await renderPanel();

    expect(radio("Background", /^Full/).checked).toBe(true);
    expect(radio("Background", /^Simple/).checked).toBe(false);
    expect(radio("Motion", /^System/).checked).toBe(true);
    expect(radio("Motion", /^Reduced/).checked).toBe(false);
  });

  it("shows saved settings and changes each independently", async () => {
    await renderPanel({ graphics: "simple", scaffold: "minimal" });
    expect(radio("Background", /^Simple/).checked).toBe(true);

    fireEvent.click(radio("Motion", /^Reduced/));
    expect(radio("Motion", /^Reduced/).checked).toBe(true);
    expect(radio("Background", /^Simple/).checked).toBe(true);

    fireEvent.click(radio("Background", /^Full/));
    expect(radio("Background", /^Full/).checked).toBe(true);
    expect(radio("Motion", /^Reduced/).checked).toBe(true);
  });
});
