import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryProgress } from "../../test/progressStorage";
import { samplePlayer } from "../persistence/persistence.test-helpers";
import { emptyPlayerState } from "../persistence/schema";
import { SaveDataPanel } from "./SaveDataPanel";

const createObjectURL = vi.fn(() => "blob:osp-save");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  // jsdom implements neither.
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

afterEach(() => {
  vi.restoreAllMocks();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

async function renderPanel(player = samplePlayer()) {
  const progress = memoryProgress(player);
  render(progress.wrap(<SaveDataPanel />));
  await screen.findByRole("heading", { name: "Save data" });
  return progress;
}

function button(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function chooseFile(file: File | undefined): void {
  fireEvent.change(screen.getByLabelText("Import save"), {
    target: { files: file === undefined ? [] : [file] },
  });
}

describe("SaveDataPanel", () => {
  it("downloads the current progress as a dated save file", async () => {
    await renderPanel();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    fireEvent.click(button("Export save"));

    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("osp-save-2026-09-13.json");
    expect(link.href).toBe("blob:osp-save");
    const [[blob]] = createObjectURL.mock.calls as unknown as [[Blob]];
    expect(JSON.parse(await blob.text())).toMatchObject({
      format: "osp-save",
      player: samplePlayer(),
    });
    expect(screen.getByText("Save exported.")).toBeTruthy();
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:osp-save");
    });
  });

  it("imports a chosen save after confirmation", async () => {
    const progress = await renderPanel(emptyPlayerState());
    const file = new File(
      [
        JSON.stringify({
          format: "osp-save",
          schemaVersion: 1,
          exportedAt: "2026-09-13T00:00:00.000Z",
          player: samplePlayer(),
        }),
      ],
      "backup.json",
      { type: "application/json" },
    );

    chooseFile(undefined);
    expect(screen.queryByText(/replaces all progress/)).toBeNull();

    chooseFile(file);
    expect(
      screen.getByText(
        "Importing backup.json replaces all progress in this browser.",
      ),
    ).toBeTruthy();
    fireEvent.click(button("Cancel"));
    expect(screen.queryByText(/replaces all progress/)).toBeNull();

    chooseFile(file);
    fireEvent.click(button("Replace progress"));

    expect(await screen.findByText("Save imported.")).toBeTruthy();
    expect(progress.backing.player).toEqual(samplePlayer());
  });

  it("explains an invalid import and keeps progress", async () => {
    const progress = await renderPanel();

    chooseFile(new File(["not json"], "notes.txt"));
    fireEvent.click(button("Replace progress"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "That file isn't valid JSON. Your current progress hasn't changed.",
    );
    expect(progress.backing.player).toEqual(samplePlayer());
  });

  it("resets progress after confirmation", async () => {
    const progress = await renderPanel();

    fireEvent.click(button("Reset progress"));
    expect(screen.getByText(/Export your save first/)).toBeTruthy();
    fireEvent.click(button("Cancel"));
    expect(progress.backing.player).toEqual(samplePlayer());

    fireEvent.click(button("Reset progress"));
    fireEvent.click(button("Reset progress"));

    expect(await screen.findByText("Progress reset.")).toBeTruthy();
    expect(progress.backing.player).toEqual(emptyPlayerState());
  });

  it("clears downloaded game data without touching progress", async () => {
    const progress = await renderPanel();
    await progress.storage.upstreamCache.put("a".repeat(64), "cached");

    fireEvent.click(button("Clear downloaded game data"));

    expect(
      await screen.findByText("Downloaded game data cleared."),
    ).toBeTruthy();
    expect(progress.backing.cache.size).toBe(0);
    expect(progress.backing.player).toEqual(samplePlayer());
  });

  it("reports a storage failure specifically", async () => {
    const progress = await renderPanel();
    vi.spyOn(progress.storage.upstreamCache, "clear").mockRejectedValue(
      new DOMException("closed", "InvalidStateError"),
    );

    fireEvent.click(button("Clear downloaded game data"));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "(InvalidStateError)",
    );
    expect(button("Export save")).toHaveProperty("disabled", false);
  });
});
