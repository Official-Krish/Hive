import { useCallback, useMemo, useRef, useState } from "react";

export interface ShipCelebration {
  userId: string;
  prNumber: number;
  /** 1 = single merge, 2 = second within the hour, 3 = on fire. */
  level: 1 | 2 | 3;
  at: number;
}

/** Merges inside this window stack into a streak. */
const STREAK_WINDOW_MS = 60 * 60 * 1000;
/** How long the gold ring lingers under a celebrating avatar. */
const RING_MS = 60 * 1000;

interface UseShipStreaksResult {
  celebrations: ShipCelebration[];
  celebratingIds: ReadonlySet<string>;
  /** Record a merge; returns the celebration (ring auto-expires). */
  recordMerge: (userId: string, prNumber: number) => ShipCelebration;
}

/**
 * Ship-it Streaks: merge moments with escalation. All client-side and
 * ephemeral — every connected client derives the same levels from the
 * same `pr.updated` stream, so no hub state is needed.
 */
export function useShipStreaks(): UseShipStreaksResult {
  const [celebrations, setCelebrations] = useState<ShipCelebration[]>([]);
  const timesRef = useRef<Map<string, number[]>>(new Map());
  const timersRef = useRef<Map<number, number>>(new Map());

  const recordMerge = useCallback((userId: string, prNumber: number) => {
    const now = Date.now();
    const recent = [...(timesRef.current.get(userId) ?? []), now]
      .filter((t) => now - t < STREAK_WINDOW_MS)
      .slice(-5);
    timesRef.current.set(userId, recent);
    const level = (recent.length >= 3 ? 3 : recent.length === 2 ? 2 : 1) as
      1 | 2 | 3;
    const celebration: ShipCelebration = { userId, prNumber, level, at: now };
    setCelebrations((prev) => [...prev.slice(-5), celebration]);
    const timer = window.setTimeout(() => {
      timersRef.current.delete(now);
      setCelebrations((prev) => prev.filter((c) => c.at !== now));
    }, RING_MS);
    timersRef.current.set(now, timer);
    return celebration;
  }, []);

  const celebratingIds = useMemo(
    () => new Set(celebrations.map((c) => c.userId)),
    [celebrations],
  );

  return { celebrations, celebratingIds, recordMerge };
}
