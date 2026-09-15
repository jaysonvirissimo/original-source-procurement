import { describe, expect, it } from "vitest";
import { VR_PHASES } from "./presentation";
import { SCENE_TOKENS } from "./sceneTokens";
import { AMBIENT_SHAPES, CHAMBER_VARIANTS, phaseAccent } from "./variants";

describe("CHAMBER_VARIANTS", () => {
  it("never asks for more shapes than exist", () => {
    for (const variant of Object.values(CHAMBER_VARIANTS)) {
      expect(variant.shapeCount).toBeGreaterThan(0);
      expect(variant.shapeCount).toBeLessThanOrEqual(AMBIENT_SHAPES.length);
    }
  });

  it("darkens field work and strips live work back", () => {
    const { training, field, live } = CHAMBER_VARIANTS;
    expect(field.gridOpacity).toBeLessThan(training.gridOpacity);
    expect(field.shapeOpacity).toBeLessThan(training.shapeOpacity);
    expect(live.shapeCount).toBeLessThan(field.shapeCount);
    expect(field.shapeCount).toBeLessThan(training.shapeCount);
  });

  it("keeps shapes out of the center of the view", () => {
    for (const { position } of AMBIENT_SHAPES) {
      expect(Math.abs(position[0])).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("phaseAccent", () => {
  it.each([
    ["idle", undefined],
    ["compiling", "info"],
    ["error", "error"],
    ["improved", "grid"],
    ["exact", "match"],
  ] as const)("tints %s with %s", (phase, token) => {
    expect(phaseAccent(phase)).toBe(token);
  });

  it("only uses scene tokens", () => {
    for (const phase of VR_PHASES) {
      const token = phaseAccent(phase);
      if (token !== undefined) {
        expect(SCENE_TOKENS).toContain(token);
      }
    }
  });
});
