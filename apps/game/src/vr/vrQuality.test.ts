import { describe, expect, it } from "vitest";
import {
  frameLoop,
  MAX_PIXEL_RATIO,
  pixelRatio,
  webglAvailable,
} from "./vrQuality";

describe("pixelRatio", () => {
  it.each([
    [1, 1],
    [1.25, 1.25],
    [1.5, 1.5],
    [2, MAX_PIXEL_RATIO],
    [3, MAX_PIXEL_RATIO],
    [0, 1],
    [-1, 1],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
  ])("renders a device ratio of %s at %s", (device, expected) => {
    expect(pixelRatio(device)).toBe(expected);
  });
});

describe("frameLoop", () => {
  it.each([
    [{ hidden: false, reducedMotion: false }, "always"],
    [{ hidden: false, reducedMotion: true }, "demand"],
    [{ hidden: true, reducedMotion: false }, "never"],
    [{ hidden: true, reducedMotion: true }, "never"],
  ] as const)("%o renders %s", (options, expected) => {
    expect(frameLoop(options)).toBe(expected);
  });
});

describe("webglAvailable", () => {
  const canvas = (contexts: Record<string, unknown>) => () => ({
    getContext: (id: string) => contexts[id] ?? null,
  });

  it("accepts WebGL 2 or, failing that, WebGL 1", () => {
    expect(webglAvailable(canvas({ webgl2: {} }))).toBe(true);
    expect(webglAvailable(canvas({ webgl: {} }))).toBe(true);
  });

  it("rejects a browser with neither, or one that throws", () => {
    expect(webglAvailable(canvas({}))).toBe(false);
    expect(
      webglAvailable(() => {
        throw new Error("blocked");
      }),
    ).toBe(false);
  });
});
