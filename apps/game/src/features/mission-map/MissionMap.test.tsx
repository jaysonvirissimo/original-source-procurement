import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { shippedCatalog } from "../curriculum/missionCatalog";
import {
  missionProgress,
  samplePlayer,
  skillEvidence,
  timestamp,
} from "../persistence/persistence.test-helpers";
import { emptyPlayerState, type PlayerState } from "../persistence/schema";
import { memoryProgress } from "../../test/progressStorage";
import { MissionMap } from "./MissionMap";

async function renderMap(player: PlayerState = emptyPlayerState()) {
  render(memoryProgress(player).wrap(<MissionMap />));
  return screen.findByRole("region", { name: "Mission map" });
}

function rowOf(map: HTMLElement, name: string): HTMLElement {
  const row = within(map).getByRole("link", { name }).closest("li");
  if (row === null) {
    throw new Error(`No row holds ${name}.`);
  }
  return row;
}

describe("MissionMap", () => {
  it("shows phase lanes, the field region, an empty live region, and the recommended mission on a fresh save", async () => {
    const map = await renderMap();

    for (const name of [
      "Phase · Translation",
      "Phase · Memory",
      "Phase · Types and layout",
    ]) {
      expect(within(map).getByRole("heading", { name })).toBeTruthy();
    }
    expect(
      within(within(map).getByRole("region", { name: "Live" })).getByText(
        "No missions yet.",
      ),
    ).toBeTruthy();
    expect(
      within(within(map).getByRole("region", { name: "Field" })).getByRole(
        "link",
        { name: "F01 FONT BUFFER" },
      ),
    ).toBeTruthy();
    expect(within(map).getByText("0 of 58 complete")).toBeTruthy();
    expect(within(map).getByRole("button", { name: "Map" })).toHaveProperty(
      "ariaPressed",
      "true",
    );
    expect(rowOf(map, "001 RETURN PATH").textContent).toContain("RECOMMENDED");
    const skipped = rowOf(map, "009 FIELD OFFSET");
    expect(skipped.textContent).toContain("SKIPS AHEAD");
    expect(skipped.textContent).toContain("Not yet introduced:");
    expect(
      within(skipped)
        .getByRole("link", { name: "009 FIELD OFFSET" })
        .getAttribute("href"),
    ).toBe("#/mission/009");
    expect(map.textContent).not.toContain("Resume:");
  });

  it("offers Resume and the next recommended mission from saved progress", async () => {
    const map = await renderMap(samplePlayer());

    expect(rowOf(map, "001 RETURN PATH").textContent).toContain("COMPLETE");
    expect(within(map).getByText("1 of 58 complete")).toBeTruthy();
    expect(
      within(map)
        .getByRole("link", { name: "ADD IMMEDIATE (003)" })
        .getAttribute("href"),
    ).toBe("#/mission/003");
    expect(
      within(map)
        .getByRole("link", { name: "ARGUMENT ZERO (002)" })
        .getAttribute("href"),
    ).toBe("#/mission/002");
  });

  it("leaves a ready mission that is not recommended unmarked", async () => {
    const player = samplePlayer();
    player.skills["ABI.ARGUMENT"] = {
      evidence: [
        {
          ...player.skills["ABI.RETURN"]?.evidence[0],
          id: "completion-2:ABI.ARGUMENT",
          completionId: "completion-2",
          skill: "ABI.ARGUMENT",
          missionId: "002",
          kind: "introduced",
          hintMaxStage: 0,
          solutionRevealed: false,
          completedAt: timestamp(20),
        },
      ],
    };
    const map = await renderMap(player);

    expect(rowOf(map, "004 SHIFT LEFT").textContent).toBe("004 SHIFT LEFT");
  });

  it("names a mission once when it is both resumed and recommended", async () => {
    const player = emptyPlayerState();
    player.missions["001"] = missionProgress({
      missionId: "001",
      sourceSavedAt: timestamp(4),
    });
    const map = await renderMap(player);

    expect(map.textContent).toContain("Resume:");
    expect(map.textContent).not.toContain("Recommended:");
  });

  it("says training is complete when every mission is", async () => {
    const player = emptyPlayerState();
    for (const { id } of shippedCatalog.missions) {
      player.missions[id] = missionProgress({
        missionId: id,
        completion: {
          count: 1,
          firstCompletedAt: timestamp(1),
          lastCompletedAt: timestamp(1),
          lastCompletionId: `completion-${id}`,
        },
      });
    }
    const map = await renderMap(player);

    expect(within(map).getByText("Training complete")).toBeTruthy();
    expect(within(map).getByText("58 of 58 complete")).toBeTruthy();
    expect(map.textContent).not.toContain("Practice:");
  });

  it("does not call training complete when a solution was revealed, and offers practice", async () => {
    const player = emptyPlayerState();
    for (const { id } of shippedCatalog.missions) {
      player.missions[id] = missionProgress({
        missionId: id,
        completion: {
          count: 1,
          firstCompletedAt: timestamp(1),
          lastCompletedAt: timestamp(1),
          lastCompletionId: `completion-${id}`,
        },
      });
    }
    player.skills["ABI.ARGUMENT"] = {
      evidence: [
        skillEvidence({
          id: "completion-F01:ABI.ARGUMENT",
          completionId: "completion-F01",
          skill: "ABI.ARGUMENT",
          missionId: "F01",
          kind: "real",
          hintMaxStage: 9,
          solutionRevealed: true,
        }),
      ],
    };
    const map = await renderMap(player);

    expect(within(map).queryByText("Training complete")).toBeNull();
    expect(
      within(map).getByText("All missions complete · 1 with solution revealed"),
    ).toBeTruthy();
    expect(
      within(map).getByRole("link", { name: "FONT BUFFER (F01)" }),
    ).toBeTruthy();
  });

  it("switches to a searchable list and back", async () => {
    const map = await renderMap();

    fireEvent.click(within(map).getByRole("button", { name: "List" }));
    const search = await within(map).findByRole("searchbox", {
      name: "Search missions",
    });
    expect(within(map).getByRole("button", { name: "List" })).toHaveProperty(
      "ariaPressed",
      "true",
    );
    expect(within(map).getByRole("status").textContent).toBe("58 missions");

    fireEvent.change(search, { target: { value: "field offset" } });
    expect(
      within(map)
        .getAllByRole("listitem")
        .map((row) => within(row).getByRole("link").textContent),
    ).toEqual(["009 FIELD OFFSET"]);
    expect(within(map).getByRole("status").textContent).toBe(
      "1 of 58 missions",
    );

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(within(map).getByText("No missions match “zzz”.")).toBeTruthy();

    fireEvent.click(within(map).getByRole("button", { name: "Map" }));
    expect(
      await within(map).findByRole("heading", { name: "Phase · Memory" }),
    ).toBeTruthy();
  });

  it("opens in the list view the player saved", async () => {
    const map = await renderMap({
      ...emptyPlayerState(),
      settings: { mapView: "list" },
    });

    expect(
      within(map).getByRole("searchbox", { name: "Search missions" }),
    ).toBeTruthy();
  });
});
