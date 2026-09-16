import { describe, expect, it } from "vitest";
import { deletionsByName, newestDeletion } from "./history.ts";

const LOG = [
  { commit: "c3", paths: ["asm/libgv/GV_VecDir2_80016EF8.s"] },
  { commit: "c2", paths: ["asm/old/GV_VecDir2_80016EF8.s", "notes.txt"] },
  { commit: "c1", paths: ["asm/libgv/GV_Other.s"] },
];

describe("deletionsByName", () => {
  it("keys deletions by file name, newest first", () => {
    const byName = deletionsByName(LOG);
    expect(byName.get("GV_VecDir2_80016EF8.s")).toEqual([
      { commit: "c3", path: "asm/libgv/GV_VecDir2_80016EF8.s" },
      { commit: "c2", path: "asm/old/GV_VecDir2_80016EF8.s" },
    ]);
  });

  it("ignores deletions of files that are not assembly", () => {
    expect(deletionsByName(LOG).has("notes.txt")).toBe(false);
  });

  it("reads an empty log", () => {
    expect(deletionsByName([]).size).toBe(0);
  });
});

describe("newestDeletion", () => {
  const byName = deletionsByName(LOG);

  it("takes the newest deletion, so a later move never wins", () => {
    expect(newestDeletion(byName, ["GV_VecDir2_80016EF8.s"])).toEqual({
      commit: "c3",
      path: "asm/libgv/GV_VecDir2_80016EF8.s",
    });
  });

  it("tries each candidate name in order", () => {
    expect(
      newestDeletion(byName, ["GV_Other_00000000.s", "GV_Other.s"])?.commit,
    ).toBe("c1");
  });

  it("is undefined when no name was ever deleted", () => {
    expect(newestDeletion(byName, ["Absent.s"])).toBeUndefined();
  });
});
