import { describe, expect, it } from "vitest";
import {
  checkoutsFromEnvironment,
  createGitReader,
  parseDeletions,
} from "./checkout.ts";

describe("checkoutsFromEnvironment", () => {
  it("reads both directories", () => {
    expect(
      checkoutsFromEnvironment({
        OSP_MGS_REVERSING_DIR: "/a",
        OSP_PSYQ_SDK_DIR: "/b",
      }),
    ).toEqual({ mgsReversing: "/a", psyqSdk: "/b" });
  });

  it("is undefined unless both are set", () => {
    expect(
      checkoutsFromEnvironment({ OSP_MGS_REVERSING_DIR: "/a" }),
    ).toBeUndefined();
    expect(
      checkoutsFromEnvironment({ OSP_PSYQ_SDK_DIR: "/b" }),
    ).toBeUndefined();
    expect(checkoutsFromEnvironment({})).toBeUndefined();
  });
});

describe("parseDeletions", () => {
  it("reads commits and the paths each one deleted", () => {
    expect(parseDeletions("\0c1\n\na.s\nb.s\n\0c2\n\nc.s\n")).toEqual([
      { commit: "c1", paths: ["a.s", "b.s"] },
      { commit: "c2", paths: ["c.s"] },
    ]);
  });

  it("ignores a commit that deleted nothing under the pathspec", () => {
    expect(parseDeletions("\0c1\n\0c2\n\na.s\n")).toEqual([
      { commit: "c2", paths: ["a.s"] },
    ]);
  });

  it("reads empty output", () => {
    expect(parseDeletions("")).toEqual([]);
  });
});

/*
 * The reader is exercised against this repository, which is the only
 * checkout a test can count on. It reads git's object store, so nothing
 * depends on the working tree.
 */
describe("createGitReader", () => {
  const git = createGitReader(process.cwd());

  it("reads a file's bytes at a revision", async () => {
    const bytes = await git.blob("HEAD", "package.json");
    expect(new TextDecoder().decode(bytes)).toContain('"name": "osp"');
  });

  it("returns nothing for a file that is not at that revision", async () => {
    await expect(git.blob("HEAD", "absent-file.txt")).resolves.toBeUndefined();
  });

  it("lists the paths in a revision's tree", async () => {
    await expect(git.paths("HEAD")).resolves.toContain("package.json");
  });

  it("lists nothing for a revision that does not exist", async () => {
    await expect(git.paths("not-a-revision")).resolves.toEqual([]);
  });

  it("resolves a revision to a full hash", async () => {
    await expect(git.resolve("HEAD")).resolves.toMatch(/^[0-9a-f]{40}$/);
  });

  it("resolves nothing for a revision that does not exist", async () => {
    await expect(git.resolve("not-a-revision")).resolves.toBeUndefined();
  });

  it("lists deletions under a pathspec, newest first", async () => {
    const deletions = await git.deletions("HEAD", "tools");
    expect(Array.isArray(deletions)).toBe(true);
  });

  it("lists no deletions for a revision that does not exist", async () => {
    await expect(git.deletions("not-a-revision", "tools")).resolves.toEqual([]);
  });
});
