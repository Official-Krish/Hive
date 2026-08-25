import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Avatar from "./Avatar";
import type { MapAvatar } from "@/hooks/useRealtimeMap";

const DEFAULT_AVATAR = "/avatars/male/hive_male_01.glb";

const STATUS_COLOR: Record<string, string> = {
  online: "bg-emerald-400",
  away: "bg-amber-400",
  offline: "bg-slate-500",
};

interface RemoteAvatarsProps {
  avatars: ReadonlyMap<string, MapAvatar>;
  myUserId: string;
  onAvatarClick?: (developerId: string) => void;
}

/**
 * Renders every remote avatar in the workspace at its current 2D (x, z) position
 * using the player's GLB. The current user's avatar is skipped — it is rendered
 * by PlayerController. Positions are read from a ref each frame so React
 * doesn't re-render the scene on every move event.
 */
export function RemoteAvatars({
  avatars,
  myUserId,
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

  const entries: Array<[string, MapAvatar]> = [];
  for (const [id, a] of avatars) {
    if (id === myUserId) continue;
    entries.push([id, a]);
  }

  return (
    <>
      {entries.map(([id, avatar]) => (
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
          <Avatar
            modelUrl={avatar.avatarUrl ?? DEFAULT_AVATAR}
            name={avatar.name || "Member"}
            status={avatar.status ?? "online"}
            badgeColor={STATUS_COLOR[avatar.status ?? "online"] ?? "bg-sky-500"}
            position={[0, 0, 0]}
          />
        </group>
      ))}
    </>
  );
}

export default RemoteAvatars;
