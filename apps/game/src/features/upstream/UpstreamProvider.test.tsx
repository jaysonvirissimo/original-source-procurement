import { render, renderHook, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryProgress } from "../../test/progressStorage";
import { useUpstreamCache } from "../persistence/progressContext";
import type { UpstreamCacheStore } from "../persistence/types";
import { createBrowserUpstream } from "./networkUpstream";
import type { UpstreamService } from "./types";
import { offlineUpstream, useUpstream } from "./upstreamContext";
import { UpstreamProvider } from "./UpstreamProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UpstreamProvider", () => {
  it("builds the service over the loaded storage's cache", async () => {
    const progress = memoryProgress();
    const service: UpstreamService = { ...offlineUpstream };
    const createUpstream = vi.fn<
      (cache: UpstreamCacheStore) => UpstreamService
    >(() => service);
    let provided: UpstreamService | undefined;
    function Probe(): ReactElement {
      provided = useUpstream();
      return <p>ready</p>;
    }

    render(
      progress.wrap(
        <UpstreamProvider createUpstream={createUpstream}>
          <Probe />
        </UpstreamProvider>,
      ),
    );

    await screen.findByText("ready");
    expect(createUpstream).toHaveBeenCalledWith(progress.storage.upstreamCache);
    expect(provided).toBe(service);
  });

  it("requires a persistence provider for the cache", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useUpstreamCache())).toThrow(
      "useUpstreamCache must be used inside a PersistenceProvider.",
    );
  });
});

describe("createBrowserUpstream", () => {
  it("fetches through the browser fetch without credentials", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(new Response("", { status: 404 })),
    );
    vi.stubGlobal("fetch", fetch);
    const upstream = createBrowserUpstream(
      memoryProgress().storage.upstreamCache,
    );

    const outcome = await upstream.loadC({
      repository: "FoxdieTeam/mgs_reversing",
      commit: "3".repeat(40),
      path: "source/osp.h",
      sha256: "0".repeat(64),
    });

    expect(outcome).toMatchObject({ kind: "unavailable" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://raw.githubusercontent.com/"),
      expect.objectContaining({ credentials: "omit" }),
    );
  });
});
