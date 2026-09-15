import { Canvas } from "@react-three/fiber";
import type { ReactElement } from "react";
import type { VrPresentationState } from "./presentation";
import styles from "./PresentationLayer.module.css";
import { CAMERA_HOME } from "./scene/camera";
import { VrChamber } from "./scene/VrChamber";
import type { SceneColors } from "./sceneTokens";
import type { FrameLoop } from "./vrQuality";

export interface VrCanvasProps {
  readonly state: VrPresentationState;
  readonly colors: SceneColors;
  readonly frameloop: FrameLoop;
  readonly dpr: number;
}

/**
 * The WebGL canvas for the training chamber: capped resolution, no
 * antialiasing, shadows, or post-processing.
 */
export default function VrCanvas({
  state,
  colors,
  frameloop,
  dpr,
}: VrCanvasProps): ReactElement {
  return (
    <Canvas
      className={styles.canvas}
      dpr={dpr}
      frameloop={frameloop}
      gl={{ antialias: false, powerPreference: "low-power" }}
      camera={{ position: [...CAMERA_HOME], fov: 50, near: 0.1, far: 80 }}
    >
      <VrChamber state={state} colors={colors} />
    </Canvas>
  );
}
