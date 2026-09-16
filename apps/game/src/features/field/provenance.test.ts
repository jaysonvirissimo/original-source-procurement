import type { Mission } from "@osp/mission-schema";
import { realMission, syntheticMission } from "@osp/mission-schema/testing";
import { describe, expect, it } from "vitest";
import { missionProvenance } from "./provenance";

describe("missionProvenance", () => {
  it("describes a real mission and links its pinned target file", () => {
    const mission = realMission();
    const target = mission.target;
    if (target.kind !== "remote") {
      throw new Error("The real mission fixture has a remote target.");
    }

    expect(missionProvenance(mission)).toEqual({
      repository: "FoxdieTeam/mgs_reversing",
      overlay: "sample",
      symbol: "sample_function",
      address: undefined,
      target: {
        path: target.path,
        commit: target.commit,
        url: `https://github.com/FoxdieTeam/mgs_reversing/blob/${target.commit}/${target.path}`,
      },
    });
  });

  it("pads the address to eight hexadecimal digits", () => {
    const base = realMission();
    const mission = realMission({
      source: { ...base.source, address: 0x1f0 } as Mission["source"],
    });

    expect(missionProvenance(mission)?.address).toBe("0x000001F0");
  });

  it("has none for a synthetic mission", () => {
    expect(missionProvenance(syntheticMission())).toBeUndefined();
  });
});
