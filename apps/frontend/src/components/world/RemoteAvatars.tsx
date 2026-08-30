import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AlertTriangle, Check, X, Zap } from "lucide-react";
import Avatar from "./Avatar";
import { AvatarErrorBoundary } from "./AvatarErrorBoundary";
import type { MapAvatar } from "@/hooks/useRealtimeMap";
import { type NearbyTokens } from "@/hooks/useNearbyTokens";
import { formatTokens } from "./MapHud";

const DEFAULT_AVATAR = "/avatars/male/hive_male_01.glb";

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
  onAvatarClick,
}: RemoteAvatarsProps) {
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());

  useFrame(() => {
    for (const [id, avatar] of avatars) {
      if (id === myUserId) continue;
      const g = groupRefs.current.get(id);
      if (g) g.position.set(avatar.x, 0, avatar.y);
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
        const needsYou =
          avatar.sessionStatus === "blocked" ||
          avatar.sessionStatus === "waiting_approval";

        const meta: Array<{
          text: string;
          tone?: "amber" | "green" | "red" | "neutral";
          icon?: React.ReactNode;
        }> = [];
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
