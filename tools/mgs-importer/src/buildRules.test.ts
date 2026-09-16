import { describe, expect, it } from "vitest";
import {
  gpSizeFor,
  isExcludedSource,
  overlayFor,
  GLOBAL_SIZE_PATHS,
} from "./buildRules.ts";

describe("gpSizeFor", () => {
  it("is 8 for a source on upstream's global-size list", () => {
    expect(gpSizeFor("source/libgv/util.c")).toBe(8);
  });

  it("is 0 for a source that is not on it", () => {
    expect(gpSizeFor("source/libgv/vector.c")).toBe(0);
  });

  it("distinguishes same-named files in different directories", () => {
    expect(gpSizeFor("source/libgv/debug.c")).toBe(8);
    expect(gpSizeFor("source/other/debug.c")).toBe(0);
  });

  it("covers every listed path", () => {
    for (const entry of GLOBAL_SIZE_PATHS) {
      expect(gpSizeFor(`source${entry}`)).toBe(8);
    }
  });
});

describe("isExcludedSource", () => {
  it("excludes the sources built with the older toolchain", () => {
    expect(isExcludedSource("source/mts/mts_new.c")).toBe(true);
    expect(isExcludedSource("source/sound/sd_str.c")).toBe(true);
  });

  it("keeps everything else", () => {
    expect(isExcludedSource("source/libgv/util.c")).toBe(false);
  });
});

describe("overlayFor", () => {
  it("names the overlay a source is linked into", () => {
    expect(overlayFor("source/overlays/brf/onoda/brf/b_select.c")).toBe("brf");
  });

  it("is main for everything outside the overlays", () => {
    expect(overlayFor("source/libgv/util.c")).toBe("main");
  });
});
