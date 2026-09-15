import { useCallback, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Avatar, { type PlayerMotion } from "./Avatar";
import { CoffeeCup } from "./CoffeeCup";
import type { AABB } from "./office/layout";
import { SIT_RADIUS, type SitSpot } from "./interactions";
import { ASSET_BASE_URL } from "../../lib/config";

interface PlayerControllerProps {
  /** Shared camera yaw (radians) — a ref so orbit never re-renders. */
  yawRef: React.MutableRefObject<number>;
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
  /** First-person: hide the whole own avatar so the head never clips the lens. */
  firstPerson?: boolean;
  /** Chairs the player can sit on (F nearby, WASD/Space/F to stand). */
  sitSpots?: SitSpot[];
  /** Fires on sit/stand transitions (toasts, HUD hints). */
  onSitChange?: (sitting: boolean) => void;
  /** Receives the sit toggle so HUD pills can trigger it on click/tap. */
  sitToggleRef?: React.MutableRefObject<(() => void) | null>;
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

/** Keys that stand the player up when seated. */
const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

/**
 * Third-person player controller (custom, no physics engine).
 * Camera-relative WASD with velocity accel/decel, Shift sprint, Space jump +
 * gravity, analytic AABB slide collision and walkable-surface sampling so the
 * player can climb the feature stair onto the upper floor. Emits a per-frame
 * motion ref for the avatar's walk/run/jump blend and a throttled HUD callback.
 */
export function PlayerController({
  yawRef,
  obstacles,
  spawn = [0, 0, 38],
  modelUrl = `${ASSET_BASE_URL}/avatars/male/hive_male_01.glb`,
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
  firstPerson = false,
  sitSpots = [],
  onSitChange,
  sitToggleRef,
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
    sitting: false,
  });

  // Seated state: the spot we're on (null = standing). Refs so the
  // once-subscribed key handler always sees fresh values.
  const sittingRef = useRef<SitSpot | null>(null);
  const sitSpotsRef = useRef(sitSpots);
  sitSpotsRef.current = sitSpots;
  const onSitChangeRef = useRef(onSitChange);
  onSitChangeRef.current = onSitChange;

  const stand = useCallback(() => {
    if (!sittingRef.current) return;
    sittingRef.current = null;
    motionRef.current.sitting = false;
    onSitChangeRef.current?.(false);
  }, []);

  const toggleSit = useCallback(() => {
    if (disabledRef.current) return;
    if (sittingRef.current) {
      stand();
      return;
    }
    const [px, feetY, pz] = posRef.current;
    let best: SitSpot | null = null;
    let bestD = SIT_RADIUS;
    for (const spot of sitSpotsRef.current) {
      if (Math.abs(feetY - spot.y) > 0.9) continue;
      const d = Math.hypot(px - spot.x, pz - spot.z);
      if (d < bestD) {
        bestD = d;
        best = spot;
      }
    }
    if (!best) return;
    sittingRef.current = best;
    motionRef.current.sitting = true;
    onSitChangeRef.current?.(true);
  }, [stand]);

  // Modal-open lock: ref so useFrame sees the latest value without re-subscribing.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // Keyboard state.
  const keys = useRef<Record<string, boolean>>({});
  const hudAccum = useRef(0);
  const lastRoomRef = useRef<string | null>(null);
  const jumpHeldRef = useRef(false);

  useEffect(() => {
    const inEditable = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.tagName === "BUTTON" ||
        el.isContentEditable
      );
    };
    const down = (e: KeyboardEvent) => {
      if (inEditable()) return;
      // F toggles sitting near a chair (never while a modal owns input).
      if (e.code === "KeyF") {
        toggleSit();
        return;
      }
      if (sittingRef.current) {
        // Any locomotion key stands up first. Space is swallowed so you
        // don't jump straight out of the chair.
        if (MOVE_KEYS.has(e.code)) {
          stand();
          if (e.code === "Space") {
            e.preventDefault();
            return;
          }
        } else {
          return;
        }
      }
      keys.current[e.code] = true;
      if (e.code === "Space") e.preventDefault(); // don't scroll the page
      if (e.code.startsWith("Arrow")) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      if (e.code === "Space") jumpHeldRef.current = false;
    };
    // Alt-Tab (or any focus loss) with keys held must not stick movement.
    const onBlur = () => {
      keys.current = {};
      jumpHeldRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", onBlur);
    };
  }, [toggleSit, stand]);

  // Opening a modal with a key held must not lurch on close.
  useEffect(() => {
    if (disabled) {
      keys.current = {};
      jumpHeldRef.current = false;
    }
  }, [disabled]);

  // Publish the sit toggle for HUD pills ( nullable when unmounted ).
  useEffect(() => {
    if (!sitToggleRef) return;
    sitToggleRef.current = toggleSit;
    return () => {
      sitToggleRef.current = null;
    };
  }, [sitToggleRef, toggleSit]);

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
    // Seated players ignore locomotion input; the spot snap below eases the
    // avatar onto the chair instead.
    const seated = sittingRef.current;
    const blocked = disabledRef.current || seated !== null;
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

    if (!blocked && groundedRef.current && k["Space"] && !jumpHeldRef.current) {
      vyRef.current = JUMP_V;
      groundedRef.current = false;
      jumpSeqRef.current += 1;
      jumpHeldRef.current = true;
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

    posRef.current[0] = nextX;
    posRef.current[1] = nextY;
    posRef.current[2] = nextZ;

    // --- Heading (face movement direction) ---------------------------------
    const speed = Math.hypot(vx, vz);
    if (seated) {
      // Ease onto the chair facing the desk; velocity decays to zero above.
      posRef.current[0] = THREE.MathUtils.damp(
        posRef.current[0],
        seated.x,
        12,
        delta,
      );
      posRef.current[1] = THREE.MathUtils.damp(
        posRef.current[1],
        groundAt ? groundAt(seated.x, seated.z, nextY) : seated.y,
        12,
        delta,
      );
      posRef.current[2] = THREE.MathUtils.damp(
        posRef.current[2],
        seated.z,
        12,
        delta,
      );
      let diff = seated.heading - rotYRef.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      rotYRef.current += diff * Math.min(1, delta * TURN_RATE);
      velRef.current.x = 0;
      velRef.current.z = 0;
    } else if (speed > 0.15) {
      const targetAngle = Math.atan2(dirX, dirZ) + MODEL_YAW_OFFSET;
      let diff = targetAngle - rotYRef.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      rotYRef.current += diff * Math.min(1, delta * TURN_RATE);
    }

    // --- Push transform to the group + motion to the avatar ----------------
    const px = posRef.current[0];
    const py = posRef.current[1];
    const pz = posRef.current[2];
    if (groupRef.current) {
      groupRef.current.position.set(px, py, pz);
      groupRef.current.rotation.y = rotYRef.current;
    }
    motionRef.current.speed = seated ? 0 : Math.min(1, speed / RUN_SPEED);
    motionRef.current.grounded = groundedRef.current;
    motionRef.current.jumpSeq = jumpSeqRef.current;
    motionRef.current.sitting = seated !== null;

    // --- Throttled HUD update (~12 Hz) -------------------------------------
    hudAccum.current += delta;
    if (hudAccum.current > 0.08) {
      hudAccum.current = 0;
      // No env variables in the frontend — dev-only debug write gates on
      // localhost.
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        (window as unknown as Record<string, unknown>).__dbg = {
          pos: [px, py, pz],
          vel: [velRef.current.x, velRef.current.z],
          keys: Object.entries(keys.current).filter(([, v]) => v),
          grounded: groundedRef.current,
          support,
        };
      }
      const room = roomAt ? roomAt(px, pz, py) : "";
      if (onRoomChange && room !== lastRoomRef.current) {
        lastRoomRef.current = room;
        onRoomChange(room);
      }
      if (onPositionUpdate) {
        onPositionUpdate([px, py, pz], room);
      }
      if (onRealtimeMove) {
        onRealtimeMove(px, pz, room || null);
      }
    }
  });

  return (
    <group ref={groupRef} position={spawn}>
      {!hidden && !firstPerson && (
        <>
          <Avatar
            modelUrl={modelUrl}
            motionRef={motionRef}
            name={name}
            status={status}
            badgeColor={badgeColor}
            hideNameplate
          />
          {coffee && <CoffeeCup />}
        </>
      )}
    </group>
  );
}
