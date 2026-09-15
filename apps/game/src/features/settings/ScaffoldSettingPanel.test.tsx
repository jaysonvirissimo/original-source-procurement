import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { memoryProgress } from "../../test/progressStorage";
import { samplePlayer } from "../persistence/persistence.test-helpers";
import type { ScaffoldSetting } from "../persistence/schema";
import { ScaffoldSettingPanel } from "./ScaffoldSettingPanel";

async function renderPanel(scaffold?: ScaffoldSetting) {
  const player = samplePlayer();
  const progress = memoryProgress(
    scaffold === undefined ? player : { ...player, settings: { scaffold } },
  );
  render(progress.wrap(<ScaffoldSettingPanel />));
  await screen.findByRole("heading", { name: "Teaching support" });
  return progress;
}

function radio(name: RegExp): HTMLInputElement {
  return screen.getByRole("radio", { name });
}

describe("ScaffoldSettingPanel", () => {
  it("starts on adaptive and explains each choice", async () => {
    await renderPanel();

    expect(radio(/^Adaptive/).checked).toBe(true);
    expect(radio(/^Full/).checked).toBe(false);
    expect(radio(/^Minimal/).checked).toBe(false);
    expect(
      screen.getByRole("group", { name: "Notes and diagrams" }).textContent,
    ).toContain("Scan, hints, and the manual still work.");
  });

  it("shows a saved setting and changes it", async () => {
    await renderPanel("full");
    expect(radio(/^Full/).checked).toBe(true);

    fireEvent.click(radio(/^Minimal/));

    expect(radio(/^Minimal/).checked).toBe(true);
    expect(radio(/^Full/).checked).toBe(false);
  });
});
