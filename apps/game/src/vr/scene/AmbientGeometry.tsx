import { useFrame } from "@react-three/fiber";
import { useRef, type ReactElement } from "react";
import type { Group } from "three";
import { AMBIENT_SHAPES } from "../variants";

interface AmbientGeometryProps {
  readonly color: string;
  readonly count: number;
  readonly opacity: number;
  /** False with reduced motion: the shapes hold still. */
  readonly drift: boolean;
}

/** Sparse low-poly wireframe shapes at the edges of the chamber. */
export function AmbientGeometry({
  color,
  count,
  opacity,
  drift,
}: AmbientGeometryProps): ReactElement {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!drift || group.current === null) {
      return;
    }
    for (const shape of group.current.children) {
      shape.rotation.x += delta * 0.04;
      shape.rotation.y += delta * 0.06;
    }
  });

  return (
    <group ref={group}>
      {AMBIENT_SHAPES.slice(0, count).map((shape) => (
        <mesh key={shape.position.join(",")} position={[...shape.position]}>
          <icosahedronGeometry args={[shape.radius, 0]} />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={opacity}
          />
        </mesh>
      ))}
    </group>
  );
}
