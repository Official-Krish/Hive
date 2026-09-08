import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const HOLD_POS = new THREE.Vector3(0.24, 1.12, 0.16);
const MOUTH_POS = new THREE.Vector3(0.1, 1.52, 0.24);
// raise → sip → sip → lower, then hold until dismissed
const T_RAISE0 = 0.5;
const T_RAISE1 = 1.1;
const T_SIP_END = 2.7;
const T_LOWER = 3.3;

const STEAM_COUNT = 3;

function smooth(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return t * t * (3 - 2 * t);
}

/**
 * Takeaway cup with a procedural sip cycle: pop in at the chest, rise to the
 * mouth, tilt twice (with a steam burst per sip), then lower back to a hold.
 * Child of the player group so it inherits position and heading; no hand pose
 * exists in the FBX set, so the grab stays procedural.
 */
export function CoffeeCup() {
  const groupRef = useRef<THREE.Group>(null);
  const steamRefs = useRef<THREE.Group[]>([]);
  const startRef = useRef<number | null>(null);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useFrame(() => {
    const group = groupRef.current;
    const now = performance.now();
    const t0 = startRef.current ?? (startRef.current = now);
    const t = (now - t0) / 1000;
    if (!group) return;

    if (reduced) {
      group.position.copy(HOLD_POS);
      group.rotation.set(0, 0, 0);
      group.scale.setScalar(1);
    } else if (t < 0.28) {
      // pop-in overshoot at the chest
      const k = t / 0.28;
      group.position.copy(HOLD_POS);
      group.rotation.set(0, 0, 0);
      group.scale.setScalar(k * (1 + 0.35 * Math.sin(k * Math.PI)));
    } else {
      group.scale.setScalar(1);
      const raise = smooth((t - T_RAISE0) / (T_RAISE1 - T_RAISE0));
      const lower = smooth((t - T_SIP_END) / (T_LOWER - T_SIP_END));
      const lift = raise * (1 - lower);
      group.position.lerpVectors(HOLD_POS, MOUTH_POS, lift);
      // two tilt wobbles while at the mouth
      let tilt = 0;
      if (t > T_RAISE1 && t < T_SIP_END) {
        const st = (t - T_RAISE1) / (T_SIP_END - T_RAISE1);
        tilt = Math.sin(st * Math.PI * 2) * 0.5 + 0.55;
      }
      group.rotation.set(-tilt * lift, 0, -tilt * 0.4 * lift);
    }

    // steam: idle wisps, bursting on each sip tilt
    const sipping =
      !reduced && t > T_RAISE1 && t < T_SIP_END
        ? 0.5 +
          0.5 *
            Math.sin(((t - T_RAISE1) / (T_SIP_END - T_RAISE1)) * Math.PI * 2)
        : 0;
    steamRefs.current.forEach((g, i) => {
      if (!g) return;
      const tt = now / 1000 + i / STEAM_COUNT;
      const phase = (tt * 0.45) % 1;
      g.position.y = 0.12 + phase * 0.28;
      g.position.x = Math.sin(tt * 2.4 + i * 2.1) * 0.015;
      const mesh = g.children[0] as THREE.Mesh | undefined;
      if (mesh) {
        const m = mesh.material as THREE.MeshBasicMaterial;
        m.opacity = (0.5 + sipping * 0.5) * (1 - phase) * (1 - phase);
      }
      const s = 1 + sipping * 0.6;
      g.scale.setScalar(s);
    });
  });

  return (
    <group
      position={HOLD_POS.toArray() as [number, number, number]}
      ref={groupRef}
    >
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
