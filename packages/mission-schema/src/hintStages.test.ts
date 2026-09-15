import { describe, expect, it } from "vitest";
import { HINT_STAGE_PURPOSES, hintStagePurpose } from "./hint.ts";

describe("hint stage purposes", () => {
  it("names all nine stages, from the skill to the solution", () => {
    expect(HINT_STAGE_PURPOSES).toHaveLength(9);
    expect(hintStagePurpose(1)).toBe("Skill");
    expect(hintStagePurpose(5)).toBe("Type or declaration");
    expect(hintStagePurpose(9)).toBe("Solution");
  });

  it("names no stage outside 1 to 9", () => {
    expect(hintStagePurpose(0)).toBe("");
    expect(hintStagePurpose(10)).toBe("");
  });
});
