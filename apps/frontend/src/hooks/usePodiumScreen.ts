import { useCallback, useEffect, useState } from "react";
import type { RealtimeClient } from "@/lib/realtime";

interface UsePodiumScreenResult {
  /** URL currently on the wall (null = idle). */
  url: string | null;
  /** Who put it up (user id, null when idle). */
  setBy: string | null;
  /** Put a URL up for the whole room. */
  setUrl: (url: string) => void;
  /** Take the screen back to idle. */
  clear: () => void;
}

/**
 * Podium wall-screen state: a single shared URL per workspace, synced via
 * `podium.screen.state` (full sync on connect, deltas after). Ephemeral —
 * the hub forgets it on restart.
 */
export function usePodiumScreen(
  client: RealtimeClient | null,
): UsePodiumScreenResult {
  const [url, setUrlState] = useState<string | null>(null);
  const [setBy, setSetBy] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    client.requestPodiumScreenState();
    return client.on("podium.screen.state", (e) => {
      setUrlState(e.url);
      setSetBy(e.setBy);
    });
  }, [client]);

  const setUrl = useCallback(
    (next: string) => {
      client?.sendPodiumScreenSet(next);
    },
    [client],
  );

  const clear = useCallback(() => {
    client?.sendPodiumScreenClear();
  }, [client]);

  return { url, setBy, setUrl, clear };
}
