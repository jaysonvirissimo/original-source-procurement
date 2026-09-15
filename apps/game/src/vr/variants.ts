import type { MissionTier, VrPhase } from "./presentation";
import type { SceneToken } from "./sceneTokens";

/** How full the chamber is for a tier of mission. */
export interface ChamberVariant {
  readonly gridOpacity: number;
  readonly shapeCount: number;
  readonly shapeOpacity: number;
}

export interface AmbientShape {
  readonly position: readonly [number, number, number];
  readonly radius: number;
}

/** Sparse wireframe shapes placed around the edges of the view, never behind its center. */
export const AMBIENT_SHAPES: readonly AmbientShape[] = [
  { position: [-9, 1.5, -6], radius: 1.2 },
  { position: [8, 3, -9], radius: 1.6 },
  { position: [-5, 4.5, -14], radius: 1 },
  { position: [11, 0.5, -4], radius: 0.8 },
  { position: [3, 5, -16], radius: 1.4 },
  { position: [-12, 2.5, -11], radius: 1.1 },
];

/**
 * Training is an orderly, well-lit chamber. Solved field work is darker
 * recovered data. Live work strips the chamber back so the tools dominate.
 */
export const CHAMBER_VARIANTS: Readonly<Record<MissionTier, ChamberVariant>> = {
  training: { gridOpacity: 0.5, shapeCount: 6, shapeOpacity: 0.35 },
  field: { gridOpacity: 0.25, shapeCount: 3, shapeOpacity: 0.2 },
  live: { gridOpacity: 0.35, shapeCount: 1, shapeOpacity: 0.25 },
};

/** The token that tints the chamber during a phase, if any. */
export function phaseAccent(phase: VrPhase): SceneToken | undefined {
  switch (phase) {
    case "compiling":
      return "info";
    case "error":
      return "error";
    case "improved":
      return "grid";
    case "exact":
      return "match";
    case "idle":
      return undefined;
  }
}
