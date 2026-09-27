import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Hangs over the AI-lab screen trio while the build is red. */
const CLOUD_POS: [number, number, number] = [17.5, 5.6, -15];
const DROPS = 380;
const FALL_SPEED = 7;
const RAIN_TOP = 5.0;
const RAIN_BOTTOM = 0.2;

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Build weather: a dark little storm that gathers over the AI lab when a
 * test run goes red and breaks apart on the next green run. Pure ambience —
 * no assets, one draw call for the blob plus one for the rain.
 */
export function StormCloud({ active }: { active: boolean }) {
  const blobRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);

  // Group-relative: rain falls from just under the blob to the floor.
  const positions = useMemo(() => {
    const arr = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 1] =
        RAIN_BOTTOM - CLOUD_POS[1] + Math.random() * (RAIN_TOP - RAIN_BOTTOM);
      arr[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (!active) return;
    const step = Math.min(dt, 0.05);
    if (blobRef.current && !reducedMotion) {
      const t = performance.now() / 1000;
      // Group-relative bob — the parent group already sits at CLOUD_POS.
      blobRef.current.position.y = Math.sin(t * 0.9) * 0.12;
      blobRef.current.rotation.y = t * 0.05;
    }
    const points = pointsRef.current;
    if (points && !reducedMotion) {
      const pos = points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < DROPS; i++) {
        const y = arr[i * 3 + 1] ?? 0;
        arr[i * 3 + 1] =
          y - FALL_SPEED * step < RAIN_BOTTOM - CLOUD_POS[1]
            ? RAIN_TOP - CLOUD_POS[1]
            : y - FALL_SPEED * step;
      }
      pos.needsUpdate = true;
    }
  });

  if (!active) return null;
  return (
    <group position={CLOUD_POS}>
      {/* the blob: a few overlapping dark spheres read as one cloud */}
      <group ref={blobRef}>
        {(
          [
            [0, 0, 0, 2.6],
            [-2.2, -0.3, 0.4, 1.8],
            [2.2, -0.3, -0.3, 1.9],
            [0.4, 0.5, -0.8, 1.6],
            [-0.9, 0.4, 0.9, 1.5],
          ] as Array<[number, number, number, number]>
        ).map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[r, 14, 12]} />
            <meshStandardMaterial
              color="#39415a"
              roughness={1}
              transparent
              opacity={0.88}
            />
          </mesh>
        ))}
      </group>
      {/* rain sheet under the blob */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#9db8d9"
          size={0.07}
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
