import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactElement } from "react";
import { BoxGeometry, EdgesGeometry, type LineSegments } from "three";

// Hidden frames keep a tiny nonzero scale, because a zero scale is not invertible.
const HIDDEN_SCALE = 0.0001;

interface MissionTransitionProps {
  readonly active: boolean;
  readonly color: string;
  readonly reducedMotion: boolean;
}

/**
 * On an exact match a bright chamber frame opens around the workspace. With
 * reduced motion it appears at full size without growing.
 */
export function MissionTransition({
  active,
  color,
  reducedMotion,
}: MissionTransitionProps): ReactElement {
  const frame = useRef<LineSegments>(null);
  const edges = useMemo(() => {
    const box = new BoxGeometry(16, 7, 16);
    const outline = new EdgesGeometry(box);
    box.dispose();
    return outline;
  }, []);

  useEffect(
    () => () => {
      edges.dispose();
    },
    [edges],
  );

  useFrame((_, delta) => {
    const lines = frame.current;
    if (lines === null) {
      return;
    }
    const target = active ? 1 : 0;
    const scale = reducedMotion
      ? target
      : lines.scale.x + (target - lines.scale.x) * Math.min(1, delta * 2);
    lines.scale.setScalar(Math.max(scale, HIDDEN_SCALE));
    lines.visible = scale > 0.01;
  });

  return (
    <lineSegments
      ref={frame}
      geometry={edges}
      position={[0, 1.5, -6]}
      scale={HIDDEN_SCALE}
      visible={false}
    >
      <lineBasicMaterial color={color} transparent opacity={0.5} />
    </lineSegments>
  );
}
