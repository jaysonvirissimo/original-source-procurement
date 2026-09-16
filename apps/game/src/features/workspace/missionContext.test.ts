import { realMission } from "@osp/mission-schema/testing";
import { describe, expect, it, vi } from "vitest";
import type { UpstreamService } from "../upstream/types";
import { offlineUpstream } from "../upstream/upstreamContext";
import { loadMissionContext } from "./missionContext";
import { shippedMission } from "./workspace.test-helpers";

const WORDS = [0x03e00008, 0x00000000];

function upstream(overrides: Partial<UpstreamService>): UpstreamService {
  return {
    ...offlineUpstream,
    loadTarget: () =>
      Promise.resolve({ kind: "loaded", value: WORDS, source: "cache" }),
    loadC: () =>
      Promise.resolve({ kind: "loaded", value: "\n", source: "cache" }),
    ...overrides,
  };
}

describe("loadMissionContext", () => {
  it("compares an inline target with its relocations, without loading anything", async () => {
    const mission = shippedMission("003");
    const loadTarget = vi.fn<UpstreamService["loadTarget"]>();

    const outcome = await loadMissionContext(mission, upstream({ loadTarget }));

    expect(outcome).toMatchObject({
      kind: "ready",
      target: { kind: "unlinked" },
    });
    expect(loadTarget).not.toHaveBeenCalled();
  });

  it("compares upstream words under relocation masks only", async () => {
    const outcome = await loadMissionContext(realMission(), upstream({}));

    expect(outcome).toMatchObject({
      kind: "ready",
      input: { headers: { "psyq/include/sample.h": "\n" } },
      target: { kind: "linked", words: WORDS },
    });
  });

  it("reports a failed target by its path before a failed header", async () => {
    const mission = realMission();
    const outcome = await loadMissionContext(
      mission,
      upstream({
        loadTarget: () =>
          Promise.resolve({ kind: "content-mismatch", attempts: [] }),
        loadC: () => Promise.resolve({ kind: "unavailable", attempts: [] }),
      }),
    );

    expect(outcome).toEqual({
      kind: "content-mismatch",
      path: mission.target.kind === "remote" ? mission.target.path : "",
    });
  });

  it("reports a failed header once the target loads", async () => {
    await expect(
      loadMissionContext(
        realMission(),
        upstream({
          loadC: () => Promise.resolve({ kind: "unavailable", attempts: [] }),
        }),
      ),
    ).resolves.toEqual({ kind: "unavailable", path: "psyq/include/sample.h" });
  });

  it("is cancelled when either load is cancelled", async () => {
    await expect(
      loadMissionContext(
        realMission(),
        upstream({ loadTarget: () => Promise.resolve({ kind: "cancelled" }) }),
      ),
    ).resolves.toEqual({ kind: "cancelled" });
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadMissionContext(realMission(), upstream({}), controller.signal),
    ).resolves.toEqual({ kind: "cancelled" });
  });
});
