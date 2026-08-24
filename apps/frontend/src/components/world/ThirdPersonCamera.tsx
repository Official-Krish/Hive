import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Box3Spec } from "./office/layout";

interface ThirdPersonCameraProps {
  targetPosition: [number, number, number];
  colliders?: Box3Spec[];
  onYawChange?: (yaw: number) => void;
}

const MIN_DIST = 1.6;
const MAX_DIST = 13;
const DEFAULT_DIST = 6.5;
const TARGET_HEIGHT = 1.35; // shoulder/head height above feet
const CAM_MARGIN = 0.35; // keep the lens off the wall

/**
 * Smooth third-person follow camera.
 * Orbit (drag) + zoom (scroll), exponential follow, and analytic ray-vs-AABB
 * collision that pulls the camera in when a wall would occlude the player.
 */
export function ThirdPersonCamera({
  targetPosition,
  colliders = [],
  onYawChange,
}: ThirdPersonCameraProps) {
  const { camera, gl } = useThree();

  const yawRef = useRef(0); // 0 → camera south of player, looking north (-Z)
  const pitchRef = useRef(0.26);
  const distanceRef = useRef(DEFAULT_DIST);
  const draggingRef = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });

  const currentTarget = useRef(new THREE.Vector3(...targetPosition));
  const smoothDist = useRef(DEFAULT_DIST);

  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        draggingRef.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onUp = () => (draggingRef.current = false);
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      prevMouse.current = { x: e.clientX, y: e.clientY };
      const sens = 0.005;
      yawRef.current -= dx * sens;
      pitchRef.current += dy * sens;
      pitchRef.current = Math.max(
        0.05,
        Math.min(Math.PI / 2 - 0.08, pitchRef.current),
      );
      onYawChange?.(yawRef.current);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      distanceRef.current = Math.max(
        MIN_DIST,
        Math.min(MAX_DIST, distanceRef.current + e.deltaY * 0.006),
      );
    };
    const onContext = (e: Event) => e.preventDefault();

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContext);
    };
  }, [gl, onYawChange]);

  // Nearest wall hit along a ray (slab method); returns maxDist if clear.
  const rayHit = (
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
  ): number => {
    let nearest = maxDist;
    for (const b of colliders) {
      let tmin = 0;
      let tmax = maxDist;
      let hit = true;
      // Literal axis indices so the tuple reads are statically in-bounds.
      for (const a of [0, 1, 2] as const) {
        const o = origin.getComponent(a);
        const d = dir.getComponent(a);
        const lo = b.min[a];
        const hi = b.max[a];
        if (Math.abs(d) < 1e-6) {
          if (o < lo || o > hi) {
            hit = false;
            break;
          }
        } else {
          let t1 = (lo - o) / d;
          let t2 = (hi - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            hit = false;
            break;
          }
        }
      }
      if (hit && tmin > 0.05 && tmin < nearest) nearest = tmin;
    }
    return nearest;
  };

  useFrame((_, delta) => {
    const desiredTarget = new THREE.Vector3(
      targetPosition[0],
      targetPosition[1] + TARGET_HEIGHT,
      targetPosition[2],
    );
    currentTarget.current.lerp(desiredTarget, Math.min(1, delta * 10));
    const target = currentTarget.current;

    const yaw = yawRef.current;
    const pitch = pitchRef.current;
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ).normalize();

    // Collision: shrink distance if a wall is between target and desired camera.
    const wanted = distanceRef.current;
    const clear = rayHit(target, dir, wanted + CAM_MARGIN);
    const allowed = Math.max(MIN_DIST, Math.min(wanted, clear - CAM_MARGIN));
    // Snap inward instantly (avoid clipping), ease back out.
    smoothDist.current =
      allowed < smoothDist.current
        ? allowed
        : THREE.MathUtils.damp(smoothDist.current, allowed, 6, delta);

    const camPos = new THREE.Vector3(
      target.x + dir.x * smoothDist.current,
      Math.max(0.5, target.y + dir.y * smoothDist.current),
      target.z + dir.z * smoothDist.current,
    );

    camera.position.lerp(camPos, Math.min(1, delta * 14));
    camera.lookAt(target);
  });

  return null;
}
