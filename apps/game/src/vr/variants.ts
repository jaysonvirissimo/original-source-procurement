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

/**
 * Sparse wireframe shapes at the side edges of the view, below the eye line.
 * The upper half holds the wordmark, headings and links, which sit on no
 * panel, so a shape there crosses text; lower down the opaque panels cover
 * all but the margins, and the shapes frame them instead.
 */
export const AMBIENT_SHAPES: readonly AmbientShape[] = [
  { position: [-12, -1, -8], radius: 1.2 },
  { position: [12, -0.5, -10], radius: 1.4 },
  { position: [-19, -2, -16], radius: 1 },
  { position: [16, 1, -15], radius: 1.1 },
  { position: [-10, -3, -6], radius: 0.8 },
  { position: [11, -3.5, -7], radius: 0.9 },
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
