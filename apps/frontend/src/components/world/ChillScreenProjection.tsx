import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Bridges the r3f scene to a DOM overlay node. The projection component inside
 * the canvas writes the screen's viewport quad each frame; the DOM overlay
 * element (outside the canvas) reads the node ref here and gets positioned.
 */
export const chillScreenOverlay = {
  node: null as HTMLElement | null,
  videoActive: false,
};

/** World space quad of the Chill Space screen (matches layout.CHILL_SCREEN). */
const SCREEN_CENTER = [-14, 2.4, -20] as [number, number, number];
const SCREEN_HALF_W = 5.6 / 2;
const SCREEN_HALF_H = 3.1 / 2;
const FACE_OFFSET = 0.5;
const SCREEN_FORWARD = new THREE.Vector3(0, 0, 1);
const SCREEN_RIGHT = new THREE.Vector3(1, 0, 0);
const SCREEN_UP = new THREE.Vector3(0, 1, 0);

function screenCorners(ctx: {
  center: [number, number, number];
  halfW: number;
  halfH: number;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const { center, halfW, halfH, forward, right, up } = ctx;
  const c = new THREE.Vector3(...center);
  return [
    c
      .clone()
      .addScaledVector(right, halfW)
      .addScaledVector(up, halfH)
      .addScaledVector(forward, FACE_OFFSET), // TR
    c
      .clone()
      .addScaledVector(right, -halfW)
      .addScaledVector(up, halfH)
      .addScaledVector(forward, FACE_OFFSET), // TL
    c
      .clone()
      .addScaledVector(right, -halfW)
      .addScaledVector(up, -halfH)
      .addScaledVector(forward, FACE_OFFSET), // BL
    c
      .clone()
      .addScaledVector(right, halfW)
      .addScaledVector(up, -halfH)
      .addScaledVector(forward, FACE_OFFSET), // BR
  ] as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
}

const chillScreenGeometry = {
  center: SCREEN_CENTER,
  forward: SCREEN_FORWARD,
  right: SCREEN_RIGHT,
  up: SCREEN_UP,
  halfW: SCREEN_HALF_W,
  halfH: SCREEN_HALF_H,
};

/**
 * Renders inside the r3f `<Canvas>`. Each frame projects the Chill Space screen
 * quad into viewport space and lays out the DOM overlay that hosts the shared
 * YouTube player, so the video appears painted onto the 3D wall.
 */
export function ChillScreenProjection({ active }: { active: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const lastVisible = useRef(false);

  useFrame(() => {
    const node = chillScreenOverlay.node;
    const maxW = Math.max(1, size.width);
    const maxH = Math.max(1, size.height);
    const toScreen = (p: THREE.Vector3) => {
      p.project(camera);
      return { x: (p.x + 1) * 0.5 * maxW, y: (1 - p.y) * 0.5 * maxH };
    };
    const c = screenCorners(chillScreenGeometry);
    const topRight = toScreen(c[0]);
    const topLeft = toScreen(c[1]);
    const bottomLeft = toScreen(c[2]);

    // Face visibility — compare camera direction to the screen's outward normal.
    const camPos = camera.position as THREE.Vector3;
    const center = new THREE.Vector3(...chillScreenGeometry.center);
    const toCam = camPos.clone().sub(center).normalize();
    const facing = toCam.dot(chillScreenGeometry.forward);
    const visible = active && facing > 0.25;

    if (!visible) {
      if (lastVisible.current && node) node.style.display = "none";
      lastVisible.current = false;
      chillScreenOverlay.videoActive = false;
      return;
    }
    lastVisible.current = true;
    chillScreenOverlay.videoActive = true;

    const width = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
    const height = Math.hypot(
      bottomLeft.x - topLeft.x,
      bottomLeft.y - topLeft.y,
    );
    const angle = Math.atan2(topRight.y - topLeft.y, topRight.x - topLeft.x);

    if (!node) return;
    node.style.display = "block";
    node.style.left = `${topLeft.x}px`;
    node.style.top = `${topLeft.y}px`;
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    node.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
  });

  return null;
}
