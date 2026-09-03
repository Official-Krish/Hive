import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CHILL_SCREEN } from "./office/layout";

/** The shared YouTube player is created by useChillMedia. */
export const chillScreenOverlay = {
  node: null as HTMLElement | null,
  videoActive: false,
};

// Html's CSS-3D camera conversion applies its own pixel-to-world factor. This
// calibrated scale makes the 560 × 310 player fill the 5.6 × 3.1 wall TV.
const PLAYER_WIDTH = 560;
const PLAYER_HEIGHT = 310;
const FACE_OFFSET = 0.056;
const rotation = new THREE.Euler(...CHILL_SCREEN.rotation);
const facePosition = new THREE.Vector3(...CHILL_SCREEN.position).add(
  new THREE.Vector3(0, 0, FACE_OFFSET).applyEuler(rotation),
);

/**
 * Hosts the iframe in drei's CSS-3D renderer instead of manually projecting it
 * into 2D viewport coordinates. The resulting element inherits the TV's real
 * world transform and perspective, so camera motion cannot make it slide away
 * from the wall like a floating HUD panel.
 */
export function ChillScreenProjection({ active }: { active: boolean }) {
  const playerMountRef = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const player = chillScreenOverlay.node;
    const mount = playerMountRef.current;
    if (player && mount && player.parentElement !== mount) {
      // The player used to be a fixed, viewport-level DOM overlay. Reparent it
      // into the CSS-3D TV surface and reset that viewport positioning.
      Object.assign(player.style, {
        position: "absolute",
        inset: "0",
        display: "block",
        width: "100%",
        height: "100%",
        transform: "none",
        zIndex: "auto",
      });
      mount.appendChild(player);
    }
    chillScreenOverlay.videoActive = active;
  });

  return (
    <Html
      transform
      position={facePosition}
      rotation={CHILL_SCREEN.rotation}
      scale={0.4}
      // Keep the 3D player beneath the React modal layer (z-40).
      zIndexRange={[0, 0]}
      style={{
        display: active ? "block" : "none",
        width: `${PLAYER_WIDTH}px`,
        height: `${PLAYER_HEIGHT}px`,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        ref={playerMountRef}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />
    </Html>
  );
}
