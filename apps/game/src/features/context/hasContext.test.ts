import { missions } from "@osp/curriculum";
import { describe, expect, it } from "vitest";
import { hasContext } from "./hasContext";

describe("hasContext", () => {
  it("offers Context to shipped missions with headers or context types", () => {
    expect(
      missions.filter((mission) => hasContext(mission)).map(({ id }) => id),
    ).toEqual(["012B", "012D", "F01"]);
  });
});
