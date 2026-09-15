import { useEffect, useRef, type ReactElement } from "react";
import type { GridHelper } from "three";
import type { VrPhase } from "../presentation";
import type { SceneColors } from "../sceneTokens";
import { phaseAccent } from "../variants";

const SIZE = 120;
const DIVISIONS = 120;
// A tinted phase lifts the grid this much above its tier's opacity.
const ACCENT_LIFT = 0.25;

interface GridFloorProps {
  readonly colors: SceneColors;
  readonly opacity: number;
  readonly phase: VrPhase;
}

/** The luminous floor grid, tinted by the current phase. */
export function GridFloor({
  colors,
  opacity,
  phase,
}: GridFloorProps): ReactElement {
  const grid = useRef<GridHelper>(null);
  const accent = phaseAccent(phase);

  useEffect(() => {
    const helper = grid.current;
    if (helper === null) {
      return;
    }
    for (const material of [helper.material].flat()) {
      material.transparent = true;
      material.opacity =
        accent === undefined ? opacity : Math.min(1, opacity + ACCENT_LIFT);
    }
  }, [opacity, accent]);

  return (
    <gridHelper
      ref={grid}
      args={[
        SIZE,
        DIVISIONS,
        accent === undefined ? colors.grid : colors[accent],
        colors.gridDim,
      ]}
      position={[0, -2, 0]}
    />
  );
}
