import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AlertTriangle, Check, Waves, X, Zap } from "lucide-react";
import Avatar from "./Avatar";
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
}

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
}: RemoteAvatarsProps) {
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  // Smoothed per-remote transform: network positions arrive in jumps, the
  // scene shows exponential glide + heading slerp + run-blend flips.
  const smoothRef = useRef(
    new Map<
      string,
      { x: number; z: number; heading: number; moving: boolean }
    >(),
  );
  // Bumped only when a remote starts/stops moving (rare) so isMoving flips
  // re-render without per-frame state.
  const [, setMoveTick] = useState(0);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const k = 1 - Math.exp(-delta * 9);
    let flipped = false;
    for (const [id, avatar] of avatars) {
      if (id === myUserId) continue;
      const g = groupRefs.current.get(id);
      if (!g) continue;
      let s = smoothRef.current.get(id);
      if (!s) {
        s = { x: avatar.x, z: avatar.y, heading: 0, moving: false };
        smoothRef.current.set(id, s);
        g.position.set(s.x, 0, s.z);
        continue;
      }
      const dx = avatar.x - s.x;
      const dz = avatar.y - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 3) {
        // Teleport (respawn) — snap, don't glide across the map.
        s.x = avatar.x;
        s.z = avatar.y;
      } else {
        s.x += dx * k;
        s.z += dz * k;
      }
      const moving = dist / Math.max(delta, 1e-3) > 0.4;
      if (moving !== s.moving) {
        s.moving = moving;
        flipped = true;
      }
      if (dist > 0.05) {
        const target = Math.atan2(dx, dz);
        let d = target - s.heading;
        while (d < -Math.PI) d += Math.PI * 2;
        while (d > Math.PI) d -= Math.PI * 2;
        s.heading += d * Math.min(1, delta * 10);
      }
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.heading;
    }
    for (const id of [...smoothRef.current.keys()]) {
      if (!avatars.has(id)) {
        smoothRef.current.delete(id);
        groupRefs.current.delete(id);
      }
    }
    if (flipped) setMoveTick((t) => t + 1);
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
        const moving = smoothRef.current.get(id)?.moving ?? false;
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
                name={avatar.name || "Member"}
                status={avatar.status ?? "online"}
                badgeColor={
                  STATUS_COLOR[avatar.status ?? "online"] ?? "bg-emerald-400"
                }
                position={[0, 0, 0]}
                isMoving={moving}
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
