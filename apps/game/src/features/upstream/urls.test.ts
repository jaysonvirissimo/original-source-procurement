import { describe, expect, it } from "vitest";
import { sourceLink, upstreamUrls } from "./urls";

const COMMIT = "a".repeat(40);

describe("upstreamUrls", () => {
  it("lists the raw host, then jsDelivr, for an allowlisted repository", () => {
    expect(
      upstreamUrls("FoxdieTeam/mgs_reversing", COMMIT, "asm/sample/f.s"),
    ).toEqual([
      {
        host: "raw.githubusercontent.com",
        url: `https://raw.githubusercontent.com/FoxdieTeam/mgs_reversing/${COMMIT}/asm/sample/f.s`,
      },
      {
        host: "cdn.jsdelivr.net",
        url: `https://cdn.jsdelivr.net/gh/FoxdieTeam/mgs_reversing@${COMMIT}/asm/sample/f.s`,
      },
    ]);
  });

  it("builds psyq_sdk URLs with that repository", () => {
    expect(
      upstreamUrls(
        "FoxdieTeam/psyq_sdk",
        COMMIT,
        "psyq_4.4/include/sample.h",
      )?.map(({ url }) => url),
    ).toEqual([
      `https://raw.githubusercontent.com/FoxdieTeam/psyq_sdk/${COMMIT}/psyq_4.4/include/sample.h`,
      `https://cdn.jsdelivr.net/gh/FoxdieTeam/psyq_sdk@${COMMIT}/psyq_4.4/include/sample.h`,
    ]);
  });

  it("percent-encodes characters that would change the URL", () => {
    expect(
      upstreamUrls("FoxdieTeam/mgs_reversing", COMMIT, "source/a b#?.h")?.[0]
        ?.url,
    ).toBe(
      `https://raw.githubusercontent.com/FoxdieTeam/mgs_reversing/${COMMIT}/source/a%20b%23%3F.h`,
    );
  });

  it.each([
    ["a repository outside the allowlist", "someone/else", COMMIT, "a.h"],
    ["a short commit", "FoxdieTeam/mgs_reversing", "abc123", "a.h"],
    ["an uppercase commit", "FoxdieTeam/mgs_reversing", "A".repeat(40), "a.h"],
    ["an absolute path", "FoxdieTeam/mgs_reversing", COMMIT, "/etc/a.h"],
    ["a parent segment", "FoxdieTeam/mgs_reversing", COMMIT, "source/../a.h"],
    ["a backslash", "FoxdieTeam/mgs_reversing", COMMIT, "source\\a.h"],
    ["a URL scheme", "FoxdieTeam/mgs_reversing", COMMIT, "https:x/a.h"],
    ["a control character", "FoxdieTeam/mgs_reversing", COMMIT, "source/a\n.h"],
  ])("rejects %s", (_, repository, commit, path) => {
    expect(upstreamUrls(repository, commit, path)).toBeUndefined();
  });
});

describe("sourceLink", () => {
  it("links a pinned file, with a line anchor when given", () => {
    expect(sourceLink(COMMIT, "source/osp/sample.c")).toBe(
      `https://github.com/FoxdieTeam/mgs_reversing/blob/${COMMIT}/source/osp/sample.c`,
    );
    expect(sourceLink(COMMIT, "source/osp/sample.c", 12)).toBe(
      `https://github.com/FoxdieTeam/mgs_reversing/blob/${COMMIT}/source/osp/sample.c#L12`,
    );
  });

  it.each([
    ["a malformed commit", "xyz", "source/a.c", undefined],
    ["an unsafe path", COMMIT, "../a.c", undefined],
    ["a zero line", COMMIT, "source/a.c", 0],
    ["a fractional line", COMMIT, "source/a.c", 1.5],
  ])("rejects %s", (_, commit, path, line) => {
    expect(sourceLink(commit, path, line)).toBeUndefined();
  });
});
