import { syntheticMission } from "@osp/mission-schema/testing";
import { describe, expect, it } from "vitest";
import { nextMission, orderedMissions } from "./missionCatalog";

const missions = ["b", "off", "a", "c"].map((id) => syntheticMission({ id }));
const catalog = { missions, defaultPath: ["a", "b", "c", "missing"] };

describe("orderedMissions", () => {
  it("lists path missions in path order, then the rest", () => {
    expect(orderedMissions(catalog).map((mission) => mission.id)).toEqual([
      "a",
      "b",
      "c",
      "off",
    ]);
  });
});

describe("nextMission", () => {
  it("finds the next mission on the path", () => {
    expect(nextMission(catalog, "a")?.id).toBe("b");
  });

  it("returns nothing at the end of the path, off it, or for an unknown next ID", () => {
    expect(nextMission(catalog, "missing")).toBeUndefined();
    expect(nextMission(catalog, "off")).toBeUndefined();
    expect(nextMission(catalog, "c")).toBeUndefined();
  });
});
