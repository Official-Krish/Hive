import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export type RoomZoneId =
  | "overview"
  | "workspace"
  | "conference"
  | "command"
  | "server"
  | "lounge"
  | "kitchen";

export interface RoomPreset {
  id: RoomZoneId;
  name: string;
  target: [number, number, number];
  position: [number, number, number];
}

export const ROOM_PRESETS: Record<RoomZoneId, RoomPreset> = {
  overview: {
    id: "overview",
    name: "Architectural Overview",
    target: [0, 0, 0],
    position: [24, 22, 28],
  },
  workspace: {
    id: "workspace",
    name: "Central Workspace Core",
    target: [-8, 0.7, 4],
    position: [-8, 12, 18],
  },
  conference: {
    id: "conference",
    name: "Glass Conference Room",
    target: [10, 0.7, -10.5],
    position: [10, 10, -1],
  },
  command: {
    id: "command",
    name: "AI & Command Center",
    target: [-8, 0.8, -12],
    position: [-8, 9, -2],
  },
  server: {
    id: "server",
    name: "Server Infrastructure",
    target: [15, 0.8, 0],
    position: [15, 8, 9],
  },
  lounge: {
    id: "lounge",
    name: "Executive Lounge",
    target: [10, 0.5, 10.5],
    position: [10, 9, 20],
  },
  kitchen: {
    id: "kitchen",
    name: "Coffee & Kitchen Bar",
    target: [-14, 0.6, 14],
    position: [-14, 8, 22],
  },
};

interface CameraControllerProps {
  activeZone: RoomZoneId;
}

/**
 * Camera Controller handling smooth inertia transitions to active zone framing presets
 */
export function CameraController({ activeZone }: CameraControllerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const targetPosRef = useRef<THREE.Vector3>(
    new THREE.Vector3(...ROOM_PRESETS[activeZone].position),
  );
  const targetLookAtRef = useRef<THREE.Vector3>(
    new THREE.Vector3(...ROOM_PRESETS[activeZone].target),
  );

  useEffect(() => {
    const preset = ROOM_PRESETS[activeZone] || ROOM_PRESETS.overview;
    targetPosRef.current.set(...preset.position);
    targetLookAtRef.current.set(...preset.target);
  }, [activeZone]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // Smoothly interpolate camera position using THREE.MathUtils.damp
    const lambda = 4.0;
    state.camera.position.x = THREE.MathUtils.damp(
      state.camera.position.x,
      targetPosRef.current.x,
      lambda,
      delta,
    );
    state.camera.position.y = THREE.MathUtils.damp(
      state.camera.position.y,
      targetPosRef.current.y,
      lambda,
      delta,
    );
    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      targetPosRef.current.z,
      lambda,
      delta,
    );

    // Smoothly interpolate orbit controls target
    controlsRef.current.target.x = THREE.MathUtils.damp(
      controlsRef.current.target.x,
      targetLookAtRef.current.x,
      lambda,
      delta,
    );
    controlsRef.current.target.y = THREE.MathUtils.damp(
      controlsRef.current.target.y,
      targetLookAtRef.current.y,
      lambda,
      delta,
    );
    controlsRef.current.target.z = THREE.MathUtils.damp(
      controlsRef.current.target.z,
      targetLookAtRef.current.z,
      lambda,
      delta,
    );

    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      minDistance={6}
      maxDistance={60}
      minPolarAngle={Math.PI / 6} // ~30 degrees elevation minimum
      maxPolarAngle={Math.PI / 2.3} // ~78 degrees elevation maximum (prevents looking under floor)
      maxAzimuthAngle={Math.PI / 1.5}
      minAzimuthAngle={-Math.PI / 1.5}
    />
  );
}
