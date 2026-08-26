import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
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
  offline: "bg-slate-500",
};

interface RemoteAvatarsProps {
  avatars: ReadonlyMap<string, MapAvatar>;
  myUserId: string;
  /** Token readouts for members currently within proximity radius. */
  pills?: ReadonlyMap<string, NearbyTokens>;
  onAvatarClick?: (developerId: string) => void;
}

/**
 * Renders every ONLINE remote avatar in the workspace at its current 2D
 * (x, z) position. Offline/away members are hidden — someone who never joined
 * should not stand frozen in the office. Nameplates carry context pills:
 * needs-you beacon, project tag, fresh test result, and nearby token spend.
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
    if (a.status !== "online") continue;
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
        }> = [];
        if (needsYou) meta.push({ text: "⚠ needs you", tone: "amber" });
        if (avatar.label)
          meta.push({ text: avatar.label, tone: "neutral" });
        if (avatar.project)
          meta.push({ text: avatar.project, tone: "neutral" });
        const t = pills?.get(id);
        const testFresh =
          avatar.lastTest && now - avatar.lastTest.at < 8_000
            ? avatar.lastTest
            : undefined;
        if (testFresh) {
          meta.push({
            text: `${testFresh.passed ? "✓" : "✗"} tests`,
            tone: testFresh.passed ? "green" : "red",
          });
        } else if (t) {
          meta.push({
            text: `⚡ ${formatTokens(t.inputTokens)} in · ${formatTokens(
              t.outputTokens,
            )} out${
              t.costCents != null ? ` · $${(t.costCents / 100).toFixed(2)}` : ""
            }`,
            tone: "neutral",
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
                    needsYou
                      ? "bg-amber-400"
                      : (STATUS_COLOR[avatar.status ?? "online"] ??
                        "bg-sky-500")
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
                  needsYou
                    ? "bg-amber-400"
                    : (STATUS_COLOR[avatar.status ?? "online"] ?? "bg-sky-500")
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
