import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AlertTriangle, Check, Waves, X, Zap } from "lucide-react";
import Avatar, { type PlayerMotion } from "./Avatar";
import { AvatarErrorBoundary } from "./AvatarErrorBoundary";
import type { MapAvatar } from "@/hooks/useRealtimeMap";
import { type NearbyTokens } from "@/hooks/useNearbyTokens";
import { formatTokens } from "./MapHud";
import { ASSET_BASE_URL } from "@/lib/config";

const DEFAULT_AVATAR = `${ASSET_BASE_URL}/avatars/male/hive_male_01.glb`;

/** Only genuine model files reach useGLTF — anything else gets the default. */
function safeModelUrl(url: string | null | undefined): string {
  if (url && /\.(glb|gltf)$/i.test(url.trim())) return url.trim();
  return DEFAULT_AVATAR;
}

const STATUS_COLOR: Record<string, string> = {
  online: "bg-emerald-400",
  away: "bg-amber-400",
  on_call: "bg-sky-400",
  busy: "bg-rose-500",
};

interface RemoteAvatarsProps {
  avatars: ReadonlyMap<string, MapAvatar>;
  myUserId: string;
  /** Token readouts for members currently within proximity radius. */
  pills?: ReadonlyMap<string, NearbyTokens>;
  /** Short-lived speech bubbles: developerId → text (e.g. water-cooler bump). */
  bubbles?: Readonly<Record<string, string>>;
  onAvatarClick?: (developerId: string) => void;
  /** Walkable-surface height, same sampler the local player uses. Without
   *  it remotes hover at Y=0 on stairs and the upper deck. */
  groundAt?: (x: number, z: number, feetY: number) => number;
}

// Matches PlayerController tuning so remote stride matches local stride.
const RUN_SPEED = 7.4; // m/s
/** Raw glide speed above this counts as started-moving. */
const MOVE_START = 0.6; // m/s
/** Below this for STOP_HOLD_MS the remote settles back to idle. */
const MOVE_STOP = 0.3; // m/s
const STOP_HOLD_MS = 150;

/**
 * Renders every member who is actually in the workplace at their current 2D
 * (x, z) position — online, away, on a call, or busy. Only truly absent
 * (offline) members are hidden: someone who stepped away but is still present
 * stays standing there. The nameplate dot always reflects their live presence
 * color, so a status change is visible to everyone else in real time.
 */
export function RemoteAvatars({
  avatars,
  myUserId,
  pills,
  bubbles,
  onAvatarClick,
  groundAt,
}: RemoteAvatarsProps) {
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  // Smoothed per-remote transform: network positions arrive in jumps, the
  // scene shows exponential glide + heading slerp + speed-matched walk blend.
  const smoothRef = useRef(
    new Map<
      string,
      {
        x: number;
        z: number;
        y: number;
        heading: number;
        speed: number;
        moving: boolean;
        stillSince: number;
      }
    >(),
  );
  // Per-remote motion objects fed to Avatar via motionRef (same path as the
  // local player). Mutated in useFrame — never triggers React re-renders,
  // so start/stop can never flicker the tree.
  const motionRefs = useRef(
    new Map<string, React.MutableRefObject<PlayerMotion>>(),
  );
  const motionRefFor = (id: string) => {
    let r = motionRefs.current.get(id);
    if (!r) {
      r = { current: { speed: 0, grounded: true, jumpSeq: 0 } };
      motionRefs.current.set(id, r);
    }
    return r;
  };
  const groundRef = useRef(groundAt);
  groundRef.current = groundAt;

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    // Tighter glide while moving so glide speed matches the stride the
    // walk/run blend plays — loose glide + in-place anim reads as floating.
    const kMove = 1 - Math.exp(-delta * 13);
    const kIdle = 1 - Math.exp(-delta * 9);
    const now = performance.now();
    for (const [id, avatar] of avatars) {
      if (id === myUserId) continue;
      const g = groupRefs.current.get(id);
      if (!g) continue;
      let s = smoothRef.current.get(id);
      if (!s) {
        s = {
          x: avatar.x,
          z: avatar.y,
          y: groundRef.current?.(avatar.x, avatar.y, 0) ?? 0,
          heading: 0,
          speed: 0,
          moving: false,
          stillSince: now,
        };
        smoothRef.current.set(id, s);
        g.position.set(s.x, s.y, s.z);
        continue;
      }
      const dx = avatar.x - s.x;
      const dz = avatar.y - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 3) {
        // Teleport (respawn) — snap, don't glide across the map.
        s.x = avatar.x;
        s.z = avatar.y;
        s.speed = 0;
        s.moving = false;
      } else {
        const k = s.moving ? kMove : kIdle;
        s.x += dx * k;
        s.z += dz * k;
      }
      // Hysteresis: start fast, stop only after holding still — 20Hz network
      // updates straddling a single threshold flickered idle/run every tick.
      const rawSpeed = dist / Math.max(delta, 1e-3);
      if (rawSpeed > MOVE_START) {
        s.moving = true;
      } else if (rawSpeed < MOVE_STOP) {
        if (s.moving && now - s.stillSince < STOP_HOLD_MS) {
          // keep moving until the hold elapses
        } else {
          s.moving = false;
        }
      }
      if (rawSpeed >= MOVE_STOP) s.stillSince = now;
      // Smooth the speed itself so the walk blend eases instead of snapping.
      const targetSpeed = s.moving ? Math.min(rawSpeed, RUN_SPEED) : 0;
      s.speed = THREE.MathUtils.damp(s.speed, targetSpeed, 8, delta);
      const motion = motionRefs.current.get(id);
      if (motion) {
        motion.current.speed = Math.min(1, s.speed / RUN_SPEED);
        motion.current.grounded = true;
      }
      if (dist > 0.05) {
        const target = Math.atan2(dx, dz);
        let d = target - s.heading;
        while (d < -Math.PI) d += Math.PI * 2;
        while (d > Math.PI) d -= Math.PI * 2;
        s.heading += d * Math.min(1, delta * 10);
      }
      // Ride the walkable surface like the local player (stairs, L2 deck).
      const ground = groundRef.current?.(s.x, s.z, s.y) ?? 0;
      s.y = THREE.MathUtils.damp(s.y, ground, 10, delta);
      if (Math.abs(s.y - ground) < 0.01) s.y = ground;
      g.position.set(s.x, s.y, s.z);
      g.rotation.y = s.heading;
    }
    for (const id of [...smoothRef.current.keys()]) {
      if (!avatars.has(id)) {
        smoothRef.current.delete(id);
        groupRefs.current.delete(id);
        motionRefs.current.delete(id);
      }
    }
  });

  const now = Date.now();
  const entries: Array<[string, MapAvatar]> = [];
  for (const [id, a] of avatars) {
    if (id === myUserId) continue;
    if (a.status === "offline") continue;
    entries.push([id, a]);
  }

  return (
    <>
      {entries.map(([id, avatar]) => {
        const modelUrl = safeModelUrl(avatar.mapAvatarModel);
        const motionRef = motionRefFor(id);
        const needsYou =
          avatar.sessionStatus === "blocked" ||
          avatar.sessionStatus === "waiting_approval";

        const meta: Array<{
          text: string;
          tone?: "amber" | "green" | "red" | "violet" | "neutral";
          icon?: React.ReactNode;
        }> = [];
        // The work chip is the floater's headline: "currently working on…"
        if (avatar.workingOn) {
          meta.push({
            text: avatar.workingOn,
            tone: "violet",
            icon: <Zap className="size-2.5" />,
          });
        }
        if (bubbles?.[id]) {
          meta.push({
            text: bubbles[id],
            tone: "amber",
            icon: <Waves className="size-2.5" />,
          });
        }
        if (needsYou)
          meta.push({
            text: "Needs you",
            tone: "amber",
            icon: <AlertTriangle className="size-2.5" />,
          });
        if (avatar.label) meta.push({ text: avatar.label, tone: "neutral" });
        if (avatar.project)
          meta.push({ text: avatar.project, tone: "neutral" });
        const t = pills?.get(id);
        const testFresh =
          avatar.lastTest && now - avatar.lastTest.at < 8_000
            ? avatar.lastTest
            : undefined;
        if (testFresh) {
          meta.push({
            text: "Tests",
            tone: testFresh.passed ? "green" : "red",
            icon: testFresh.passed ? (
              <Check className="size-2.5" />
            ) : (
              <X className="size-2.5" />
            ),
          });
        } else if (t) {
          meta.push({
            text: `${formatTokens(t.inputTokens)} in · ${formatTokens(
              t.outputTokens,
            )} out${
              t.costCents != null ? ` · $${(t.costCents / 100).toFixed(2)}` : ""
            }`,
            tone: "neutral",
            icon: <Zap className="size-2.5" />,
          });
        }

        return (
          <group
            key={id}
            ref={(node) => {
              if (node) groupRefs.current.set(id, node);
              else groupRefs.current.delete(id);
            }}
            position={[avatar.x, 0, avatar.y]}
            onClick={(e) => {
              e.stopPropagation();
              onAvatarClick?.(id);
            }}
          >
            <AvatarErrorBoundary
              key={modelUrl}
              fallback={
                <Avatar
                  modelUrl={DEFAULT_AVATAR}
                  name={avatar.name || "Member"}
                  status={avatar.status ?? "online"}
                  badgeColor={
                    STATUS_COLOR[avatar.status ?? "online"] ?? "bg-emerald-400"
                  }
                  position={[0, 0, 0]}
                />
              }
            >
              <Avatar
                modelUrl={modelUrl}
                motionRef={motionRef}
                name={avatar.name || "Member"}
                status={avatar.status ?? "online"}
                badgeColor={
                  STATUS_COLOR[avatar.status ?? "online"] ?? "bg-emerald-400"
                }
                position={[0, 0, 0]}
                meta={meta}
              />
            </AvatarErrorBoundary>
          </group>
        );
      })}
    </>
  );
}

export default RemoteAvatars;
