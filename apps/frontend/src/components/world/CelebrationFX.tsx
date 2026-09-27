import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MapAvatar } from "@/hooks/useRealtimeMap";
import type { ShipCelebration } from "@/hooks/useShipStreaks";

const _v = new THREE.Vector3();

interface CelebrationFXProps {
  celebrations: ShipCelebration[];
  avatars: ReadonlyMap<string, MapAvatar>;
  /** Local player's feet position (self merges burst here — self has no remote avatar). */
  selfPos: [number, number, number];
  myUserId: string;
  /** Head-height world Y for a burst at (x, z) — e.g. supportAt + 1.8. */
  heightAt: (x: number, z: number) => number;
  /** Screen-space burst; parent maps level → particle counts. */
  onBurst: (x: number, y: number, level: 1 | 2 | 3) => void;
}

/**
 * Turns merge celebrations into confetti bursts positioned over the author's
 * avatar. Lives inside the Canvas (only place with the camera): projects
 * the world position to viewport coords and hands them to the DOM confetti
 * layer outside. Each celebration fires exactly once.
 */
export function CelebrationFX({
  celebrations,
  avatars,
  selfPos,
  myUserId,
  heightAt,
  onBurst,
}: CelebrationFXProps) {
  const camera = useThree((s) => s.camera);
  const firedRef = useRef<Set<number>>(new Set());
  const onBurstRef = useRef(onBurst);
  onBurstRef.current = onBurst;

  useEffect(() => {
    for (const c of celebrations) {
      if (firedRef.current.has(c.at)) continue;
      firedRef.current.add(c.at);
      // Self has no remote avatar — and its map entry lags the live
      // player position, so always burst self merges at selfPos.
      const a = c.userId === myUserId ? undefined : avatars.get(c.userId);
      const wx = a ? a.x : selfPos[0];
      const wz = a ? a.y : selfPos[2];
      _v.set(wx, heightAt(wx, wz), wz).project(camera);
      // Behind the camera or far off-screen: skip rather than misfire.
      if (_v.z > 1 || _v.x < -1.2 || _v.x > 1.2 || _v.y < -1.2 || _v.y > 1.2) {
        continue;
      }
      const x = (_v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
      onBurstRef.current(
        x / window.innerWidth,
        y / window.innerHeight,
        c.level,
      );
    }
    if (firedRef.current.size > 20) {
      const keep = new Set(celebrations.map((c) => c.at));
      firedRef.current = new Set(
        [...firedRef.current].filter((at) => keep.has(at)),
      );
    }
  }, [celebrations, avatars, selfPos, myUserId, heightAt, camera]);

  return null;
}
