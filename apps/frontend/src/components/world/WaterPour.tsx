import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WATER_COOLER } from "./office/layout";

// Spigot tip in cooler-local space (matches Furnishings WaterCooler).
const TIP: [number, number, number] = [-0.33, 0.9, 0];
const CUP_POS: [number, number, number] = [-0.5, 0, 0.12];
const CUP_H = 0.16;
const POUR_END = 2.6;
const FADE_END = 3.6;

const RIPPLES = 3;

function smooth(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return t * t * (3 - 2 * t);
}

/**
 * Transient pour effect at the water cooler: a cup on the floor, a stream
 * that grows, pours with splash + expanding ripples and a rising fill line,
 * then shrinks away. Mounted by WorldCanvas for ~3.6s per interaction.
 */
export function WaterPour() {
  const streamRef = useRef<THREE.Mesh>(null);
  const fillRef = useRef<THREE.Mesh>(null);
  const splashRef = useRef<THREE.Group>(null);
  const rippleRefs = useRef<THREE.Group[]>([]);
  const glugRefs = useRef<THREE.Mesh[]>([]);
  const startRef = useRef<number | null>(null);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useFrame(() => {
    const now = performance.now();
    const t0 = startRef.current ?? (startRef.current = now);
    const t = (now - t0) / 1000;

    const grow = smooth(t / 0.4);
    const shrink = smooth((t - POUR_END) / 0.4);
    const flow = grow * (1 - shrink);
    const fade = 1 - smooth((t - POUR_END) / (FADE_END - POUR_END));

    if (streamRef.current) {
      streamRef.current.visible = flow > 0.01;
      const h = Math.max(0.01, (TIP[1] - (CUP_H + 0.02)) * flow);
      streamRef.current.scale.set(
        flow > 0.01 ? 1 : 0.001,
        h,
        flow > 0.01 ? 1 : 0.001,
      );
      streamRef.current.position.set(TIP[0], TIP[1] - h / 2, TIP[2]);
      const m = streamRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.75 * flow;
    }
    if (fillRef.current) {
      const fill = reduced ? 1 : smooth((t - 0.4) / (POUR_END - 0.4));
      const fh = Math.max(0.02, CUP_H - 0.03) * fill;
      fillRef.current.scale.y = Math.max(0.02, fill);
      fillRef.current.position.y = 0.012 + fh / 2;
      const m = fillRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.85 * fade;
    }
    if (splashRef.current) {
      splashRef.current.visible = !reduced && flow > 0.05;
      const s = 0.8 + 0.3 * Math.sin(now * 0.04);
      splashRef.current.scale.set(s, 1, s);
    }
    rippleRefs.current.forEach((g, i) => {
      if (!g) return;
      const phase = (((t * 0.9 + i / RIPPLES) % 1) + 1) % 1;
      const active = !reduced && t > 0.4 && t < FADE_END;
      g.visible = active;
      if (!active) return;
      const r = 0.08 + phase * 0.3;
      g.scale.set(r / 0.2, r / 0.2, 1);
      g.children.forEach((c) => {
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.opacity = 0.6 * (1 - phase) * fade;
      });
    });
    // glug bubbles rising in the bottle while pouring
    glugRefs.current.forEach((m, i) => {
      if (!m) return;
      const phase = (((t * 0.7 + i / glugRefs.current.length) % 1) + 1) % 1;
      m.visible = flow > 0.05;
      if (!m.visible) return;
      m.position.y = 1.58 + phase * 0.3;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 * (1 - phase) * flow;
    });
  });

  return (
    <group position={[WATER_COOLER[0], 0, WATER_COOLER[1]]}>
      {/* tumbler on the floor under the spigot */}
      <mesh position={[CUP_POS[0], CUP_H / 2, CUP_POS[2]]}>
        <cylinderGeometry args={[0.055, 0.045, CUP_H, 14, 1, true]} />
        <meshStandardMaterial
          color="#cfe3ea"
          transparent
          opacity={0.45}
          roughness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[CUP_POS[0], 0.008, CUP_POS[2]]}>
        <cylinderGeometry args={[0.045, 0.045, 0.016, 14]} />
        <meshStandardMaterial color="#9fb6c0" roughness={0.3} />
      </mesh>
      {/* rising fill */}
      <mesh ref={fillRef} position={[CUP_POS[0], 0.05, CUP_POS[2]]}>
        <cylinderGeometry args={[0.046, 0.04, CUP_H - 0.03, 14]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      {/* stream (unit-height cylinder, scaled per-frame) */}
      <mesh ref={streamRef} position={[TIP[0], TIP[1] - 0.3, TIP[2]]}>
        <cylinderGeometry args={[0.016, 0.02, 1, 8]} />
        <meshBasicMaterial
          color="#bae6fd"
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </mesh>
      {/* splash cone at the cup mouth */}
      <group ref={splashRef} position={[CUP_POS[0], CUP_H + 0.02, CUP_POS[2]]}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.05, 0.09, 10, 1, true]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      {/* expanding ripples around the cup */}
      {Array.from({ length: RIPPLES }, (_, i) => (
        <group
          key={i}
          position={[CUP_POS[0], 0.012, CUP_POS[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          ref={(el) => {
            if (el) rippleRefs.current[i] = el;
          }}
        >
          <mesh>
            <ringGeometry args={[0.16, 0.2, 32]} />
            <meshBasicMaterial
              color="#7dd3fc"
              transparent
              opacity={0.6}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
      {/* glug bubbles inside the bottle */}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh
          key={`g${i}`}
          position={[0, 1.6, 0]}
          ref={(el) => {
            if (el) glugRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
