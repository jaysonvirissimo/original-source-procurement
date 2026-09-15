import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactElement } from "react";
import type { Mesh, MeshBasicMaterial } from "three";
import type { VrPhase } from "../presentation";
import type { SceneColors } from "../sceneTokens";
import { phaseAccent } from "../variants";

// Seconds for one ring to cross the floor.
const PERIOD = 1.2;
const MAX_SCALE = 15;
const PEAK_OPACITY = 0.45;
// With reduced motion the ring is drawn once, at rest.
const STILL_SCALE = 6;
const STILL_OPACITY = 0.25;

interface CompilePulseProps {
  readonly phase: VrPhase;
  readonly colors: SceneColors;
  readonly reducedMotion: boolean;
}

/**
 * A ring across the floor: repeating while compiling, once on an error, and
 * a still ring with reduced motion.
 */
export function CompilePulse({
  phase,
  colors,
  reducedMotion,
}: CompilePulseProps): ReactElement {
  const ring = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const startedAt = useRef<number | undefined>(undefined);
  const accent =
    phase === "compiling" || phase === "error" ? phaseAccent(phase) : undefined;

  useEffect(() => {
    startedAt.current = undefined;
  }, [accent]);

  useFrame(({ clock }) => {
    const mesh = ring.current;
    const surface = material.current;
    if (mesh === null || surface === null) {
      return;
    }
    if (accent === undefined) {
      surface.opacity = 0;
      return;
    }
    if (reducedMotion) {
      mesh.scale.setScalar(STILL_SCALE);
      surface.opacity = STILL_OPACITY;
      return;
    }
    startedAt.current ??= clock.elapsedTime;
    const elapsed = (clock.elapsedTime - startedAt.current) / PERIOD;
    const progress = phase === "compiling" ? elapsed % 1 : Math.min(elapsed, 1);
    mesh.scale.setScalar(1 + progress * (MAX_SCALE - 1));
    surface.opacity = (1 - progress) * PEAK_OPACITY;
  });

  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.98, 0]}>
      <ringGeometry args={[0.96, 1, 64]} />
      <meshBasicMaterial
        ref={material}
        color={accent === undefined ? colors.grid : colors[accent]}
        transparent
        opacity={0}
      />
    </mesh>
  );
}
