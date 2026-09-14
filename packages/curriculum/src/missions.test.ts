import { describe, expect, it } from "vitest";
import { missionDrafts } from "./missions/drafts.ts";
import { missions, withTarget } from "./missions.ts";

describe("missions", () => {
  it("attaches a generated inline target to every draft, in order", () => {
    expect(missions.map((mission) => mission.id)).toEqual(
      missionDrafts.map((draft) => draft.id),
    );
    expect(missions.every((mission) => mission.target.kind === "inline")).toBe(
      true,
    );
  });

  it("names the command that generates a missing target", () => {
    const [draft] = missionDrafts;
    if (draft === undefined) {
      throw new Error("The curriculum has no mission drafts.");
    }

    expect(() => withTarget(draft, {})).toThrow("pnpm curriculum:targets");
  });
});
