import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const STEAM_COUNT = 3;
const POP_MS = 0.28;

/**
 * A small takeaway cup hanging near the player's chest while "coffee" is
 * active. Steam puffs rise and fade until the cup is dismissed. Rendered as a
 * child of the player group so it inherits position and heading; the grab is
 * a procedural pop rather than a skinned hand (no hand pose in the FBX set).
 */
export function CoffeeCup() {
  const groupRef = useRef<THREE.Group>(null);
  const steamRefs = useRef<THREE.Group[]>([]);
  const startRef = useRef<number | null>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (group) {
      const t = startRef.current ?? (startRef.current = performance.now());
      const k = Math.min(1, (performance.now() - t) / POP_MS);
      // Overshoot bounce, then settle.
      const scale = k * (1 + 0.35 * Math.sin(k * Math.PI));
      group.scale.setScalar(scale);
    }

    steamRefs.current.forEach((g, i) => {
      if (!g) return;
      const t = performance.now() / 1000 + i / STEAM_COUNT;
      const phase = (t * 0.45) % 1;
      g.position.y = 0.12 + phase * 0.28;
      g.position.x = Math.sin(t * 2.4 + i * 2.1) * 0.015;
      const mesh = g.children[0] as THREE.Mesh;
      if (mesh) {
        const m = mesh.material as THREE.MeshBasicMaterial;
        m.opacity = 0.5 * (1 - phase) * (1 - phase);
      }
    });
  });

  return (
    <group position={[0.24, 1.12, 0.16]} ref={groupRef}>
      {/* Cup body + handle */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.045, 0.16, 14]} />
        <meshStandardMaterial color="#ece7dd" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.085, 0]}>
        <cylinderGeometry args={[0.046, 0.055, 0.012, 14]} />
        <meshStandardMaterial color="#d8d2c6" roughness={0.7} />
      </mesh>
      {/* Coffee surface */}
      <mesh position={[0, 0.018, 0]}>
        <cylinderGeometry args={[0.048, 0.048, 0.01, 14]} />
        <meshStandardMaterial color="#4a2c17" roughness={0.4} />
      </mesh>
      {/* Handle (toroidal loop) */}
      <mesh position={[0.062, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.035, 0.011, 8, 16]} />
        <meshStandardMaterial color="#ece7dd" roughness={0.8} />
      </mesh>
      {/* Rising steam */}
      {Array.from({ length: STEAM_COUNT }, (_, i) => (
        <group
          key={i}
          position={[0, 0.1, 0]}
          ref={(el) => {
            if (el) steamRefs.current[i] = el;
          }}
        >
          <mesh position={[0, 0.06, 0]}>
            <coneGeometry args={[0.016, 0.12, 8]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.5}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
