import { useEffect, useRef, useState } from "react";
import { http } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";

export interface NearbyTokens {
  inputTokens: number;
  outputTokens: number;
  costCents: number | null;
}

const REFRESH_MS = 15_000;
const TICK_MS = 5_000;

/**
 * Token readout for the members currently within proximity of the player.
 * Deliberately lazy: at most one overlay request per member per REFRESH_MS,
 * checked on a slow ticker, so walking past a crowd never bursts the API.
 */
export function useNearbyTokens(
  workspaceId: string,
  client: RealtimeClient | null,
  nearIds: ReadonlySet<string>,
): ReadonlyMap<string, NearbyTokens> {
  const [map, setMap] = useState<ReadonlyMap<string, NearbyTokens>>(new Map());
  const nearRef = useRef(nearIds);
  nearRef.current = nearIds;
  const lastFetched = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!client || !workspaceId) return;
    let cancelled = false;

    const tick = async () => {
      for (const developerId of nearRef.current) {
        const last = lastFetched.current.get(developerId) ?? 0;
        if (Date.now() - last < REFRESH_MS) continue;
        lastFetched.current.set(developerId, Date.now());
        try {
          const data = await http.reads.mapOverlay(workspaceId, developerId);
          if (cancelled) return;
          setMap((prev) => {
            const next = new Map(prev);
            next.set(developerId, {
              inputTokens: data.inputTokens,
              outputTokens: data.outputTokens,
              costCents: data.costCents ?? null,
            });
            return next;
          });
        } catch {
          // Pill simply stays stale/absent — never worth surfacing.
        }
      }
    };

    void tick();
    const timer = setInterval(tick, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [workspaceId, client]);

  return map;
}
