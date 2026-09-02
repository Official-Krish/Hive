import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Avatar, { type PlayerMotion } from "./Avatar";
import { CoffeeCup } from "./CoffeeCup";
import type { AABB } from "./office/layout";

interface PlayerControllerProps {
  cameraYaw: number;
  obstacles: AABB[];
  spawn?: [number, number, number];
  modelUrl?: string;
  name?: string;
  status?: string;
  badgeColor?: string;
  playerRef?: React.RefObject<THREE.Group | null>;
  onPositionUpdate?: (pos: [number, number, number], roomName: string) => void;
  onRoomChange?: (roomName: string) => void;
  roomAt?: (x: number, z: number, y?: number) => string;
  /** Height of the walkable surface under (x, z) given the current feet height. */
  groundAt?: (x: number, z: number, feetY: number) => number;
  /** Largest step the player can walk up without jumping. */
  stepUp?: number;
  /** Called every frame with the player's current XZ position (for realtime). */
  onRealtimeMove?: (x: number, z: number, roomId: string | null) => void;
  /** Locks keyboard movement (e.g. while a modal is open). */
  disabled?: boolean;
  /** When true, the avatar holds a coffee cup (inherits position + heading). */
  coffee?: boolean;
  /** Hides the avatar + name tag (e.g. under a full-screen modal). */
  hidden?: boolean;
}

// --- Movement tuning --------------------------------------------------------
const WALK_SPEED = 3.4; // m/s
const RUN_SPEED = 7.4; // m/s (Shift)
const GRAVITY = 24; // m/s^2
const JUMP_V = 7.6; // m/s launch velocity
const PLAYER_RADIUS = 0.34;
const PLAYER_HEIGHT = 1.75; // used to decide which storey's walls apply
const TURN_RATE = 16; // heading smoothing
const MODEL_YAW_OFFSET = 0; // flip to Math.PI if the avatar faces backwards

/**
 * Third-person player controller (custom, no physics engine).
 * Camera-relative WASD with velocity accel/decel, Shift sprint, Space jump +
 * gravity, analytic AABB slide collision and walkable-surface sampling so the
 * player can climb the feature stair onto the upper floor. Emits a per-frame
 * motion ref for the avatar's walk/run/jump blend and a throttled HUD callback.
 */
export function PlayerController({
  cameraYaw,
  obstacles,
  spawn = [0, 0, 38],
  modelUrl = "/avatars/male/hive_male_01.glb",
  name = "You",
  status = "Online",
  badgeColor = "bg-emerald-400",
  playerRef,
  onPositionUpdate,
  onRoomChange,
  roomAt,
  groundAt,
  stepUp = 0.6,
  onRealtimeMove,
  disabled = false,
  coffee = false,
  hidden = false,
}: PlayerControllerProps) {
  const internalGroupRef = useRef<THREE.Group>(null);
  const groupRef = playerRef || internalGroupRef;

  // Physics state (refs — no per-frame React state).
  const posRef = useRef<[number, number, number]>([...spawn]);
  const velRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const vyRef = useRef(0);
  const groundedRef = useRef(true);
  const rotYRef = useRef(Math.PI + MODEL_YAW_OFFSET); // face the entrance (-Z)
  const jumpSeqRef = useRef(0);

  // Motion handed to the Avatar for animation blending.
  const motionRef = useRef<PlayerMotion>({
    speed: 0,
    grounded: true,
    jumpSeq: 0,
  });

  // Camera yaw kept in a ref so useFrame always sees the latest without re-subscribing.
  const yawRef = useRef(cameraYaw);
  yawRef.current = cameraYaw;

  // Modal-open lock: ref so useFrame sees the latest value without re-subscribing.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // Keyboard state.
  const keys = useRef<Record<string, boolean>>({});
  const hudAccum = useRef(0);

  useEffect(() => {
    const inEditable = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      );
    };
    const down = (e: KeyboardEvent) => {
      if (inEditable()) return;
      keys.current[e.code] = true;
      if (e.code === "Space") e.preventDefault(); // don't scroll the page
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /**
   * XZ overlap test, filtered by the vertical band each box blocks. `feetY` is
   * the player's foot height, so level 1 partitions stop mattering the moment
   * the player is standing on the upper deck (and vice versa).
   */
  const collides = (x: number, z: number, feetY: number): boolean => {
    const r = PLAYER_RADIUS;
    const head = feetY + PLAYER_HEIGHT;
    // Ignore anything the player can simply step onto.
    const shin = feetY + stepUp;
    for (const b of obstacles) {
      const y0 = b.y0 ?? 0;
      const y1 = b.y1 ?? Number.POSITIVE_INFINITY;
      if (y1 <= shin || y0 >= head) continue;
      if (
        x + r > b.min[0] &&
        x - r < b.max[0] &&
        z + r > b.min[1] &&
        z - r < b.max[1]
      ) {
        return true;
      }
    }
    return false;
  };

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05); // clamp huge frames (tab refocus)
    const k = keys.current;

    // --- Input → camera-relative direction ---------------------------------
    const blocked = disabledRef.current;
    let f = 0;
    let r = 0;
    if (!blocked) {
      if (k["KeyW"] || k["ArrowUp"]) f += 1;
      if (k["KeyS"] || k["ArrowDown"]) f -= 1;
      if (k["KeyD"] || k["ArrowRight"]) r += 1;
      if (k["KeyA"] || k["ArrowLeft"]) r -= 1;
    }

    const yaw = yawRef.current;
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    let dirX = fwdX * f + rightX * r;
    let dirZ = fwdZ * f + rightZ * r;
    const dirLen = Math.hypot(dirX, dirZ);
    const hasInput = dirLen > 0.001;
    if (hasInput) {
      dirX /= dirLen;
      dirZ /= dirLen;
    }

    // --- Target velocity + accel/decel -------------------------------------
    const sprint = k["ShiftLeft"] || k["ShiftRight"];
    const targetSpeed = hasInput ? (sprint ? RUN_SPEED : WALK_SPEED) : 0;
    const targetVX = dirX * targetSpeed;
    const targetVZ = dirZ * targetSpeed;

    // Exponential approach: quicker to spin up, a touch slower to coast down.
    const lambda = hasInput ? 12 : 10;
    velRef.current.x = THREE.MathUtils.damp(
      velRef.current.x,
      targetVX,
      lambda,
      delta,
    );
    velRef.current.z = THREE.MathUtils.damp(
      velRef.current.z,
      targetVZ,
      lambda,
      delta,
    );

    const vx = velRef.current.x;
    const vz = velRef.current.z;

    // --- Horizontal move with axis-separated slide collision ---------------
    const feetY = posRef.current[1];
    let nextX = posRef.current[0] + vx * delta;
    let nextZ = posRef.current[2] + vz * delta;
    const curZ = posRef.current[2];
    const curX = posRef.current[0];

    if (collides(nextX, curZ, feetY)) {
      nextX = curX;
      velRef.current.x = 0;
    }
    if (collides(nextX, nextZ, feetY)) {
      nextZ = curZ;
      velRef.current.z = 0;
    }

    // --- Vertical: walkable-surface sampling + jump + gravity ---------------
    // `support` is the top of whatever the player can stand on here; it follows
    // the stair ramp tread-by-tread and the upper deck once they're on it.
    const support = groundAt ? groundAt(nextX, nextZ, feetY) : 0;

    if (!blocked && groundedRef.current && k["Space"]) {
      vyRef.current = JUMP_V;
      groundedRef.current = false;
      jumpSeqRef.current += 1;
    }

    let nextY = feetY;
    if (groundedRef.current) {
      if (support < feetY - 0.03) {
        // Walked off an edge — hand over to gravity from where we are.
        groundedRef.current = false;
        vyRef.current = 0;
      } else {
        nextY = support; // snap to the surface (climbs the treads)
      }
    }
    if (!groundedRef.current) {
      vyRef.current -= GRAVITY * delta;
      nextY += vyRef.current * delta;
      if (vyRef.current <= 0 && nextY <= support) {
        nextY = support;
        vyRef.current = 0;
        groundedRef.current = true;
      }
    }

    posRef.current = [nextX, nextY, nextZ];

    // --- Heading (face movement direction) ---------------------------------
    const speed = Math.hypot(vx, vz);
    if (speed > 0.15) {
      const targetAngle = Math.atan2(dirX, dirZ) + MODEL_YAW_OFFSET;
      let diff = targetAngle - rotYRef.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      rotYRef.current += diff * Math.min(1, delta * TURN_RATE);
    }

    // --- Push transform to the group + motion to the avatar ----------------
    if (groupRef.current) {
      groupRef.current.position.set(nextX, nextY, nextZ);
      groupRef.current.rotation.y = rotYRef.current;
    }
    motionRef.current.speed = Math.min(1, speed / RUN_SPEED);
    motionRef.current.grounded = groundedRef.current;
    motionRef.current.jumpSeq = jumpSeqRef.current;

    // --- Throttled HUD update (~12 Hz) -------------------------------------
    hudAccum.current += delta;
    if (hudAccum.current > 0.08) {
      hudAccum.current = 0;
      (window as unknown as Record<string, unknown>).__dbg = {
        pos: [nextX, nextY, nextZ],
        vel: [velRef.current.x, velRef.current.z],
        keys: Object.entries(keys.current).filter(([, v]) => v),
        grounded: groundedRef.current,
        support,
      };
      const room = roomAt ? roomAt(nextX, nextZ, nextY) : "";
      if (onRoomChange) {
        onRoomChange(room);
      }
      if (onPositionUpdate) {
        onPositionUpdate([nextX, nextY, nextZ], room);
      }
      if (onRealtimeMove) {
        onRealtimeMove(nextX, nextZ, room || null);
      }
    }
  });

  return (
    <group ref={groupRef} position={spawn}>
      {!hidden && (
        <>
          <Avatar
            modelUrl={modelUrl}
            motionRef={motionRef}
            name={name}
            status={status}
            badgeColor={badgeColor}
          />
          {coffee && <CoffeeCup />}
        </>
      )}
    </group>
  );
}
