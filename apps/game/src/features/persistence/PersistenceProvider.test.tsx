import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { useLayoutEffect, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../test/fakeToolchain";
import { saveDataError } from "./errors";
import {
  createMemoryStorage,
  memoryBacking,
  type MemoryBacking,
} from "./memoryPersistence";
import {
  attempts,
  missionProgress,
  samplePlayer,
  timestamp,
} from "./persistence.test-helpers";
import { PersistenceProvider } from "./PersistenceProvider";
import {
  usePlayerProgress,
  useSaveData,
  type PlayerProgressValue,
  type SaveDataValue,
} from "./progressContext";
import { SaveNotices } from "./SaveNotices";
import { emptyPlayerState, type PlayerState } from "./schema";
import type { BrowserStorage } from "./types";

let captured:
  | { readonly progress: PlayerProgressValue; readonly saveData: SaveDataValue }
  | undefined;

afterEach(() => {
  captured = undefined;
  vi.restoreAllMocks();
});

function Probe(): ReactElement {
  const progress = usePlayerProgress();
  const saveData = useSaveData();
  // A layout effect runs as the render commits, so the captured value is
  // current by the time a test can find the probe's text.
  useLayoutEffect(() => {
    captured = { progress, saveData };
  });
  return (
    <p>
      missions: {Object.keys(progress.state.missions).join(",")} ·{" "}
      {progress.saveStatus.kind}
    </p>
  );
}

function current() {
  if (captured === undefined) {
    throw new Error("The probe has not rendered.");
  }
  return captured;
}

function memory(player?: PlayerState) {
  const backing = memoryBacking(player);
  const storage = createMemoryStorage({ backing, now: () => timestamp(100) });
  return { backing, storage };
}

function renderProvider(
  openStorage: () => Promise<BrowserStorage>,
  clock: { now?: () => string; newId?: () => string } = {
    now: () => timestamp(100),
    newId: () => "record-id",
  },
) {
  return render(
    <PersistenceProvider openStorage={openStorage} {...clock}>
      <SaveNotices />
      <Probe />
    </PersistenceProvider>,
  );
}

function start(id: string) {
  act(() => {
    current().progress.dispatch({
      type: "mission-started",
      mission: { id, starterSource: "starter\n" },
      at: timestamp(1),
    });
  });
}

function missionIds(backing: MemoryBacking): string[] {
  return Object.keys(backing.player.missions);
}

describe("PersistenceProvider", () => {
  it("shows loading, then the loaded progress", async () => {
    const { storage } = memory(samplePlayer());
    renderProvider(() => Promise.resolve(storage));

    expect(screen.getByText("Loading save data.")).toBeTruthy();
    expect(await screen.findByText("missions: 001,003 · saved")).toBeTruthy();
    expect(current().progress.persistent).toBe(true);
  });

  it("saves each change", async () => {
    const { backing, storage } = memory();
    renderProvider(() => Promise.resolve(storage));
    await screen.findByText(/missions:/);

    start("003");

    await waitFor(() => {
      expect(missionIds(backing)).toEqual(["003"]);
    });
    expect(await screen.findByText("missions: 003 · saved")).toBeTruthy();
  });

  it("writes changes made during a save together, once it finishes", async () => {
    const { backing, storage } = memory();
    const pending = deferred<undefined>();
    const save = vi
      .spyOn(storage.persistence, "save")
      .mockImplementationOnce(() => pending.promise);
    renderProvider(() => Promise.resolve(storage));
    await screen.findByText(/missions:/);

    start("003");
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByText("missions: 003 · saving")).toBeTruthy();
    start("004");
    start("005");
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(2);
    });
    expect(Object.keys(save.mock.calls[1]?.[0].missions ?? {})).toEqual([
      "003",
      "004",
      "005",
    ]);
    await waitFor(() => {
      expect(missionIds(backing)).toEqual(["003", "004", "005"]);
    });
  });

  it("reports a failed write and writes the latest progress on retry", async () => {
    const { backing, storage } = memory();
    vi.spyOn(storage.persistence, "save")
      .mockRejectedValueOnce(saveDataError("quota"))
      .mockRejectedValueOnce(new DOMException("stopped", "AbortError"));
    renderProvider(() => Promise.resolve(storage));
    await screen.findByText(/missions:/);

    start("003");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "storage for OSP is full",
    );
    expect(screen.getByText("missions: 003 · failed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("(AbortError)");
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(missionIds(backing)).toEqual(["003"]);
  });

  it("prunes attempts once the state holding them is saved", async () => {
    const player = {
      ...emptyPlayerState(),
      missions: { "003": missionProgress({ attempts: attempts(51) }) },
    };
    const { backing, storage } = memory(player);
    renderProvider(() => Promise.resolve(storage));

    await waitFor(() => {
      expect(backing.player.missions["003"]?.attempts).toHaveLength(50);
    });
  });

  it("does not prune attempts whose save failed", async () => {
    const { backing, storage } = memory();
    vi.spyOn(storage.persistence, "save").mockRejectedValueOnce(
      saveDataError("quota"),
    );
    renderProvider(() => Promise.resolve(storage));
    await screen.findByText(/missions:/);

    act(() => {
      current().progress.dispatch({
        type: "state-replaced",
        state: {
          ...emptyPlayerState(),
          missions: { "003": missionProgress({ attempts: attempts(51) }) },
        },
      });
    });
    await screen.findByRole("alert");
    expect(current().progress.state.missions["003"]?.attempts).toHaveLength(51);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(backing.player.missions["003"]?.attempts).toHaveLength(50);
    });
  });

  it("offers retry when storage does not open", async () => {
    const { storage } = memory(samplePlayer());
    const openStorage = vi
      .fn<() => Promise<BrowserStorage>>()
      .mockRejectedValueOnce(saveDataError("unavailable"))
      .mockResolvedValueOnce(storage);
    renderProvider(openStorage);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "isn't letting OSP store data",
    );
    expect(
      screen.queryByRole("button", { name: "Reset save data" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("missions: 001,003 · saved")).toBeTruthy();
    expect(openStorage).toHaveBeenCalledTimes(2);
  });

  it("plays without saving when the player chooses to", async () => {
    renderProvider(() => Promise.reject(new Error("no storage here")), {});

    expect((await screen.findByRole("alert")).textContent).toContain(
      "isn't letting OSP store data",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Play without saving" }),
    );

    expect(
      await screen.findByText("Progress in this tab is not being saved."),
    ).toBeTruthy();
    expect(current().progress.persistent).toBe(false);
    start("001");
    expect(await screen.findByText("missions: 001 · saved")).toBeTruthy();
    expect(current().progress.now()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(current().progress.newId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("resets a save it cannot read, after confirmation", async () => {
    const { storage } = memory(samplePlayer());
    vi.spyOn(storage.persistence, "load").mockRejectedValueOnce(
      saveDataError("corrupt"),
    );
    const reset = vi.spyOn(storage.persistence, "reset");
    renderProvider(() => Promise.resolve(storage));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "couldn't read your save data",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset save data" }));
    expect(screen.getByText(/deletes all saved progress/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep save data" }));
    expect(reset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset save data" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(await screen.findByText("missions: · saved")).toBeTruthy();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reports a reset that fails", async () => {
    const { storage } = memory();
    vi.spyOn(storage.persistence, "load").mockRejectedValue(
      saveDataError("corrupt"),
    );
    vi.spyOn(storage.persistence, "reset").mockRejectedValue(
      new DOMException("closed", "InvalidStateError"),
    );
    renderProvider(() => Promise.resolve(storage));

    fireEvent.click(
      await screen.findByRole("button", { name: "Reset save data" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "(InvalidStateError)",
      );
    });
  });

  it("offers no reset for a save it must not change", async () => {
    const { storage } = memory();
    vi.spyOn(storage.persistence, "load").mockRejectedValue(
      saveDataError("too-new"),
    );
    renderProvider(() => Promise.resolve(storage));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "newer version of OSP",
    );
    expect(
      screen.queryByRole("button", { name: "Reset save data" }),
    ).toBeNull();
  });

  it("offers no reset when storage itself reports a corrupt save", async () => {
    renderProvider(() => Promise.reject(saveDataError("corrupt")));

    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Reset save data" }),
    ).toBeNull();
  });

  it("tells the player about records it skipped until dismissed", async () => {
    for (const [count, text] of [
      [3, "OSP skipped 3 saved records"],
      [1, "OSP skipped 1 saved record it"],
    ] as const) {
      const { storage } = memory();
      vi.spyOn(storage.persistence, "lastLoadReport").mockReturnValue({
        skippedRecords: count,
      });
      const { unmount } = renderProvider(() => Promise.resolve(storage));

      expect(await screen.findByText(new RegExp(text))).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(screen.queryByText(/OSP skipped/)).toBeNull();
      unmount();
    }
  });

  it("closes storage that finishes opening after the provider is gone", async () => {
    const { storage } = memory();
    const close = vi.spyOn(storage, "close");

    const opening = deferred<BrowserStorage>();
    renderProvider(() => opening.promise).unmount();
    await act(async () => {
      opening.resolve(storage);
      await opening.promise;
    });
    await waitFor(() => {
      expect(close).toHaveBeenCalledTimes(1);
    });

    vi.spyOn(storage.persistence, "load").mockRejectedValueOnce(
      saveDataError("corrupt"),
    );
    renderProvider(() => Promise.resolve(storage)).unmount();
    await waitFor(() => {
      expect(close).toHaveBeenCalledTimes(2);
    });

    const failing = deferred<BrowserStorage>();
    renderProvider(() => failing.promise).unmount();
    await act(async () => {
      failing.reject(saveDataError("unavailable"));
      await failing.promise.catch(() => undefined);
    });
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe("save data actions", () => {
  async function ready(player?: PlayerState) {
    const setup = memory(player);
    renderProvider(() => Promise.resolve(setup.storage));
    await screen.findByText(/missions:/);
    return setup;
  }

  it("exports the current progress, including changes not yet written", async () => {
    const { storage } = await ready();
    vi.spyOn(storage.persistence, "save").mockImplementation(
      () => new Promise<void>(() => undefined),
    );

    start("003");
    const file = JSON.parse(await current().saveData.exportSave().text()) as {
      player: PlayerState;
      exportedAt: string;
    };

    expect(Object.keys(file.player.missions)).toEqual(["003"]);
    expect(file.exportedAt).toBe(timestamp(100));
  });

  it("imports a save, replacing progress", async () => {
    const { backing, storage } = await ready();
    const exported = await createMemoryStorage({
      backing: memoryBacking(samplePlayer()),
    }).persistence.export();
    const imported = vi.spyOn(storage.persistence, "import");

    await act(() => current().saveData.importSave(exported));

    expect(await screen.findByText("missions: 001,003 · saved")).toBeTruthy();
    expect(imported).toHaveBeenCalledTimes(1);
    expect(backing.player).toEqual(samplePlayer());
  });

  it("rejects an invalid import and keeps progress", async () => {
    await ready(samplePlayer());

    const error: unknown = await current()
      .saveData.importSave(new Blob(["not json"]))
      .catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({ kind: "import-not-json" });
    expect(screen.getByText("missions: 001,003 · saved")).toBeTruthy();
  });

  it("waits for a save in progress before importing", async () => {
    const { storage } = await ready();
    const pending = deferred<undefined>();
    vi.spyOn(storage.persistence, "save").mockImplementationOnce(
      () => pending.promise,
    );
    const imported = vi.spyOn(storage.persistence, "import");
    const exported = await createMemoryStorage({
      backing: memoryBacking(samplePlayer()),
    }).persistence.export();

    start("004");
    let finished = false;
    const importing = current()
      .saveData.importSave(exported)
      .then(() => {
        finished = true;
      });
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(imported).not.toHaveBeenCalled();
    expect(finished).toBe(false);

    await act(async () => {
      pending.resolve(undefined);
      await importing;
    });
    expect(await screen.findByText("missions: 001,003 · saved")).toBeTruthy();
  });

  it("resets progress and downloaded data, or downloaded data alone", async () => {
    const { backing, storage } = await ready(samplePlayer());
    await storage.upstreamCache.put("a".repeat(64), "cached");

    await act(() => current().saveData.clearDownloadedData());
    expect(backing.cache.size).toBe(0);
    expect(screen.getByText("missions: 001,003 · saved")).toBeTruthy();

    await storage.upstreamCache.put("a".repeat(64), "cached");
    await act(() => current().saveData.resetProgress());

    expect(await screen.findByText("missions: · saved")).toBeTruthy();
    expect(backing.cache.size).toBe(0);
    expect(backing.player).toEqual(emptyPlayerState());
  });
});

describe("progress hooks", () => {
  it("require a PersistenceProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderHook(() => usePlayerProgress())).toThrow(
      "usePlayerProgress must be used inside a PersistenceProvider.",
    );
    expect(() => renderHook(() => useSaveData())).toThrow(
      "useSaveData must be used inside a PersistenceProvider.",
    );
  });
});
