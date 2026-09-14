import { describe, expect, it } from "vitest";
import { realMission } from "@osp/mission-schema/testing";
import { offlineUpstream } from "./upstreamContext";

describe("offlineUpstream", () => {
  it("reports every load unavailable without attempting a host", async () => {
    const mission = realMission();
    if (mission.target.kind !== "remote") {
      throw new Error("The real mission fixture has a remote target.");
    }

    await expect(offlineUpstream.loadTarget(mission.target)).resolves.toEqual({
      kind: "unavailable",
      attempts: [],
    });
    await expect(
      offlineUpstream.loadC({
        repository: "FoxdieTeam/mgs_reversing",
        commit: mission.target.commit,
        path: "source/a.h",
        sha256: mission.target.wordsSha256,
      }),
    ).resolves.toEqual({ kind: "unavailable", attempts: [] });
    await expect(offlineUpstream.clearCache()).resolves.toBeUndefined();
  });
});
