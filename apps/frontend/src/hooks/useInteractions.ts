import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INTERACTABLES,
  type Interactable,
} from "@/components/world/interactions";

interface UseInteractionsOptions {
  /** Player feet position: [x, y, z] (y is the floor height). */
  pos: [number, number, number];
  /** While true, presses are ignored (modals, chat, typing…). */
  blocked?: boolean;
  onPress?: (target: Interactable) => void;
}

/** Cooldown between presses on the same interactable. */
const COOLDOWN_MS = 2500;
/** How close the player's feet must be to an interactable's floor level. */
const LEVEL_EPS = 0.9;

/**
 * Picks the nearest interactable within its radius (level-aware) and fires
 * `onPress` when the player taps E. The handler ignores keys typed into
 * inputs so it can't hijack chat, search, or the custom-status field.
 */
export function useInteractions({
  pos,
  blocked = false,
  onPress,
}: UseInteractionsOptions) {
  const [near, setNear] = useState<Interactable | null>(null);
  const lastPressRef = useRef<Record<string, number>>({});
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    const [x, feetY, z] = pos;
    let best: Interactable | null = null;
    let bestDistance = Infinity;
    for (const it of INTERACTABLES) {
      if (Math.abs(feetY - it.y) > LEVEL_EPS) continue;
      const d = Math.hypot(x - it.x, z - it.z);
      if (d <= it.radius && d < bestDistance) {
        best = it;
        bestDistance = d;
      }
    }
    setNear(best);
  }, [pos]);

  const press = useCallback(() => {
    if (blocked || !near) return;
    const now = Date.now();
    if (now - (lastPressRef.current[near.id] ?? 0) < COOLDOWN_MS) return;
    lastPressRef.current[near.id] = now;
    onPressRef.current?.(near);
  }, [near, blocked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      press();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return useMemo(() => ({ near, press }), [near, press]);
}
