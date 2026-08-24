import React from "react";
import { SoftShadows } from "@react-three/drei";

interface LightingRigProps {
  mode?: "day" | "evening";
}

/**
 * Production-Quality Layered Architectural Lighting Setup
 */
export function LightingRig({ mode = "day" }: LightingRigProps) {
  const isDay = mode === "day";

  return (
    <group name="lighting-rig">
      {/* SOFT SHADOWS MAP ENHANCEMENT */}
      <SoftShadows size={15} samples={16} focus={0.5} />

      {/* AMBIENT FILL LIGHTING */}
      <ambientLight
        intensity={isDay ? 0.9 : 0.4}
        color={isDay ? "#f8fafc" : "#1e293b"}
      />
      <hemisphereLight
        intensity={isDay ? 0.7 : 0.3}
        color={isDay ? "#ffffff" : "#38bdf8"}
        groundColor={isDay ? "#475569" : "#0f172a"}
      />

      {/* KEY SUN DIRECTIONAL LIGHT (Cast soft cinematic shadows across campus) */}
      <directionalLight
        position={[18, 35, 14]}
        intensity={isDay ? 2.4 : 0.8}
        color={isDay ? "#fffbeb" : "#38bdf8"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-bias={-0.0001}
      />

      {/* SECONDARY SOFT FILL DIRECTIONAL LIGHT */}
      <directionalLight
        position={[-20, 25, -20]}
        intensity={isDay ? 0.8 : 0.3}
        color="#e2e8f0"
      />

      {/* INTERIOR ZONE SPOTLIGHTS */}
      {/* Central Core Downlight */}
      <spotLight
        position={[-8, 10, 4]}
        target-position={[-8, 0, 4]}
        intensity={isDay ? 3.0 : 4.0}
        color="#ffffff"
        angle={1.1}
        penumbra={0.6}
        distance={22.0}
      />

      {/* Glass Boardroom Soft Downlight */}
      <spotLight
        position={[10, 10, -10.5]}
        target-position={[10, 0, -10.5]}
        intensity={isDay ? 3.5 : 4.5}
        color="#ffedd5"
        angle={0.9}
        penumbra={0.5}
        distance={22.0}
      />

      {/* AI Command Center Intelligence Core Spotlight */}
      <spotLight
        position={[-8, 10, -12]}
        target-position={[-8, 0, -12]}
        intensity={isDay ? 3.5 : 5.0}
        color="#7dd3fc"
        angle={1.0}
        penumbra={0.5}
        distance={22.0}
      />

      {/* Lounge Warm Spotlight */}
      <spotLight
        position={[10, 10, 10.5]}
        target-position={[10, 0, 10.5]}
        intensity={isDay ? 3.2 : 4.8}
        color="#fef08a"
        angle={0.9}
        penumbra={0.6}
        distance={22.0}
      />
    </group>
  );
}
