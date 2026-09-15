import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, type ReactElement } from "react";
import type { VrPresentationState } from "../presentation";
import type { SceneColors } from "../sceneTokens";
import { CHAMBER_VARIANTS } from "../variants";
import { AmbientGeometry } from "./AmbientGeometry";
import { CompilePulse } from "./CompilePulse";
import { GridFloor } from "./GridFloor";
import { CAMERA_HOME } from "./camera";
import { MissionTransition } from "./MissionTransition";

const LOOK_AT = [0, 0, -4] as const;
// How much closer the camera sits once the target matches exactly.
const EXACT_APPROACH = 1.5;

interface VrChamberProps {
  readonly state: VrPresentationState;
  readonly colors: SceneColors;
}

/** The training chamber: void, grid, sparse geometry, and phase feedback. */
export function VrChamber({ state, colors }: VrChamberProps): ReactElement {
  const variant = CHAMBER_VARIANTS[state.missionTier];
  const invalidate = useThree((root) => root.invalidate);

  // With reduced motion the scene renders on demand, so draw each change once.
  useEffect(() => {
    invalidate();
  }, [invalidate, state, colors]);

  return (
    <>
      <color attach="background" args={[colors.void]} />
      <fog attach="fog" args={[colors.void, 12, 42]} />
      <CameraRig
        reducedMotion={state.reducedMotion}
        exact={state.phase === "exact"}
      />
      <GridFloor
        colors={colors}
        opacity={variant.gridOpacity}
        phase={state.phase}
      />
      <AmbientGeometry
        color={colors.line}
        count={variant.shapeCount}
        opacity={variant.shapeOpacity}
        drift={!state.reducedMotion}
      />
      <CompilePulse
        phase={state.phase}
        colors={colors}
        reducedMotion={state.reducedMotion}
      />
      <MissionTransition
        active={state.phase === "exact"}
        color={colors.match}
        reducedMotion={state.reducedMotion}
      />
    </>
  );
}

interface CameraRigProps {
  readonly reducedMotion: boolean;
  readonly exact: boolean;
}

/** Sways slowly and eases closer on an exact match; stays still with reduced motion. */
function CameraRig({ reducedMotion, exact }: CameraRigProps): null {
  useFrame(({ camera, clock }, delta) => {
    const [homeX, homeY, homeZ] = CAMERA_HOME;
    const targetZ = exact ? homeZ - EXACT_APPROACH : homeZ;
    if (reducedMotion) {
      camera.position.set(homeX, homeY, targetZ);
    } else {
      const time = clock.elapsedTime;
      camera.position.x = homeX + Math.sin(time * 0.05) * 0.6;
      camera.position.y = homeY + Math.sin(time * 0.07) * 0.15;
      camera.position.z += (targetZ - camera.position.z) * Math.min(1, delta);
    }
    camera.lookAt(...LOOK_AT);
  });
  return null;
}
