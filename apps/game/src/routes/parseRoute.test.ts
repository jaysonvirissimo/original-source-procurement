import { describe, expect, it } from "vitest";
import { parseRoute } from "./parseRoute";

describe("parseRoute", () => {
  it.each(["", "#", "#/", "/"])("treats %j as the home route", (hash) => {
    expect(parseRoute(hash)).toEqual({ kind: "home" });
  });

  it.each(["#/settings", "#/settings/", "#settings"])(
    "parses %j as settings",
    (hash) => {
      expect(parseRoute(hash)).toEqual({ kind: "settings" });
    },
  );

  it("parses a mission route", () => {
    expect(parseRoute("#/mission/001")).toEqual({
      kind: "mission",
      missionId: "001",
    });
  });

  it("parses the orientation route and the manual without an entry", () => {
    expect(parseRoute("#/orientation")).toEqual({ kind: "orientation" });
    expect(parseRoute("#/manual/")).toEqual({ kind: "manual" });
  });

  it("parses a manual route", () => {
    expect(parseRoute("#/manual/MIPS.LOAD.WORD")).toEqual({
      kind: "manual",
      entryId: "MIPS.LOAD.WORD",
    });
  });

  it("decodes percent-encoded identifiers", () => {
    expect(parseRoute("#/mission/a%20b%2Fc")).toEqual({
      kind: "mission",
      missionId: "a b/c",
    });
  });

  it.each([
    "#/mission",
    "#/mission/",
    "#/mission//",
    "#/manual//",
    "#/orientation/extra",
    "#/mission/001/extra",
    "#/settings/extra",
    "#/unknown",
    "#/unknown/value",
    "#/mission/%E0%A4%A",
  ])("treats %j as not found", (hash) => {
    expect(parseRoute(hash).kind).toBe("not-found");
  });

  it("reports the unmatched path without the hash sign", () => {
    expect(parseRoute("#/nowhere")).toEqual({
      kind: "not-found",
      path: "/nowhere",
    });
  });
});
