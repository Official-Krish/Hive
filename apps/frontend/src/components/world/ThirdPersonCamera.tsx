import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Box3Spec } from "./office/layout";

interface ThirdPersonCameraProps {
  targetPosition?: [number, number, number];
  targetRef?: React.RefObject<THREE.Object3D | null>;
  colliders?: Box3Spec[];
  onYawChange?: (yaw: number) => void;
  /** "first" puts the lens at eye height, looking along yaw/pitch. */
  mode?: "third" | "first";
  /** Eye height above the feet in first-person. */
  eyeHeight?: number;
  /** Fired when the browser exits pointer lock (Esc) while in first-person. */
  onPointerLockExit?: () => void;
}

const MIN_DIST = 1.6;
const MAX_DIST = 13;
const DEFAULT_DIST = 6.5;
const TARGET_HEIGHT = 1.35; // shoulder/head height above feet
const CAM_MARGIN = 0.35; // keep the lens off the wall
const EYE_PROBE = 0.5; // nose-against-wall clamp distance in first-person
// First-person pitch range (look up/down); third-person stays top-down only.
const FPP_PITCH_MIN = -1.2;
const FPP_PITCH_MAX = 1.35;
// Module-scope scratch temps — the follow loop runs every frame.
const _desired = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _view = new THREE.Vector3();
const _camPos = new THREE.Vector3();

/**
 * Smooth third-person follow camera.
 * Orbit (drag) + zoom (scroll), exponential follow, and analytic ray-vs-AABB
 * collision that pulls the camera in when a wall would occlude the player.
 */
export function ThirdPersonCamera({
  targetPosition,
  targetRef,
  colliders = [],
  onYawChange,
  mode = "third",
  eyeHeight = 1.62,
  onPointerLockExit,
}: ThirdPersonCameraProps) {
  const { camera, gl } = useThree();

  const yawRef = useRef(0); // 0 → camera south of player, looking north (-Z)
  const pitchRef = useRef(0.26);
  const distanceRef = useRef(DEFAULT_DIST);
  const draggingRef = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Entering/exiting FPP resets any in-flight drag so yaw can't jump.
  useEffect(() => {
    draggingRef.current = false;
    if (mode === "first") {
      gl.domElement.requestPointerLock?.();
    } else if (document.pointerLockElement === gl.domElement) {
      document.exitPointerLock?.();
    }
  }, [mode, gl]);

  // Pointer-lock exit (Esc) bubbles up so the app can leave FPP.
  useEffect(() => {
    if (mode !== "first") return;
    const onLockChange = () => {
      if (document.pointerLockElement !== gl.domElement) {
        onPointerLockExit?.();
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);
    return () =>
      document.removeEventListener("pointerlockchange", onLockChange);
  }, [mode, gl, onPointerLockExit]);

  const currentTarget = useRef(
    new THREE.Vector3(...(targetPosition ?? [0, 0, 0])),
  );
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
      const locked =
        document.pointerLockElement === gl.domElement &&
        modeRef.current === "first";
      if (!draggingRef.current && !locked) return;
      const sens = 0.005;
      if (locked) {
        yawRef.current -= e.movementX * sens;
        pitchRef.current += e.movementY * sens;
      } else {
        const dx = e.clientX - prevMouse.current.x;
        const dy = e.clientY - prevMouse.current.y;
        prevMouse.current = { x: e.clientX, y: e.clientY };
        yawRef.current -= dx * sens;
        pitchRef.current += dy * sens;
      }
      const fp = modeRef.current === "first";
      pitchRef.current = Math.max(
        fp ? FPP_PITCH_MIN : 0.05,
        Math.min(fp ? FPP_PITCH_MAX : Math.PI / 2 - 0.08, pitchRef.current),
      );
      onYawChange?.(yawRef.current);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (modeRef.current === "first") return; // zoom has no meaning at the eye
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
    let tx = 0;
    let ty = 0;
    let tz = 0;
    if (targetRef?.current) {
      tx = targetRef.current.position.x;
      ty = targetRef.current.position.y;
      tz = targetRef.current.position.z;
    } else if (targetPosition) {
      tx = targetPosition[0];
      ty = targetPosition[1];
      tz = targetPosition[2];
    }
    const desiredTarget = _desired.set(tx, ty + TARGET_HEIGHT, tz);
    currentTarget.current.lerp(desiredTarget, Math.min(1, delta * 10));
    const target = currentTarget.current;

    const yaw = yawRef.current;
    const pitch = pitchRef.current;
    const dir = _dir
      .set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
      .normalize();

    // First-person: lens at the eye, looking along yaw/pitch. Movement stays
    // yaw-only (PlayerController never reads pitch), so nothing else changes.
    if (modeRef.current === "first") {
      const eye = _eye.set(tx, ty + eyeHeight, tz);
      // viewDir points from behind-camera to in-front; negate orbit dir.
      const view = _view.set(-dir.x, -dir.y, -dir.z);
      // Keep the near plane out of the wall when nose-against it.
      const clear = rayHit(eye, view, EYE_PROBE);
      const back = clear < EYE_PROBE ? EYE_PROBE - clear : 0;
      eye.addScaledVector(view, -back);
      eye.y = Math.max(0.5, eye.y);
      camera.position.copy(eye);
      camera.lookAt(eye.x + view.x, eye.y + view.y, eye.z + view.z);
      return;
    }

    // Collision: shrink distance if a wall is between target and desired camera.
    const wanted = distanceRef.current;
    const clear = rayHit(target, dir, wanted + CAM_MARGIN);
    const allowed = Math.max(MIN_DIST, Math.min(wanted, clear - CAM_MARGIN));
    // Snap inward instantly (avoid clipping), ease back out.
    smoothDist.current =
      allowed < smoothDist.current
        ? allowed
        : THREE.MathUtils.damp(smoothDist.current, allowed, 6, delta);

    const camPos = _camPos.set(
      target.x + dir.x * smoothDist.current,
      Math.max(0.5, target.y + dir.y * smoothDist.current),
      target.z + dir.z * smoothDist.current,
    );

    camera.position.lerp(camPos, Math.min(1, delta * 14));
    camera.lookAt(target);
  });

  return null;
}
