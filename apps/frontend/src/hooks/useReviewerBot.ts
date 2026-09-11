import { useEffect, useState } from "react";
import type { RealtimeClient } from "@/lib/realtime";
import type { MapAvatar } from "./useRealtimeMap";

export const REVIEWER_BOT_ID = "bot:reviewer";

/** Own nook in engineering's NE corner — clear of desks, monitors, vending. */
export const BOT_POS = { x: -5.5, y: 1.0 } as const;
const BOT_X = BOT_POS.x;
const BOT_Y = BOT_POS.y;

function baseBot(modelUrl: string | null): MapAvatar {
  return {
    developerId: REVIEWER_BOT_ID,
    name: "Reviewer",
    avatarUrl: null,
    mapAvatarModel: modelUrl,
    label: "Code review",
    workingOn: null,
    sessionStatus: null,
    project: null,
    status: "online",
    x: BOT_X,
    y: BOT_Y,
    roomId: null,
  };
}

export interface ReviewerBot {
  bot: MapAvatar;
  /** Speech bubble text for the bot (findings), null when quiet. */
  bubble: string | null;
}

/**
 * Ambient reviewer teammate: a synthetic avatar that idles at its desk and
 * narrates review activity. Client-side only — no User row, no presence
 * writes; driven purely by review.* realtime events.
 */
export function useReviewerBot(
  client: RealtimeClient | null,
  modelUrl: string | null,
): ReviewerBot {
  const [bot, setBot] = useState<MapAvatar>(() => baseBot(modelUrl));
  const [bubble, setBubble] = useState<string | null>(null);

  useEffect(() => {
    setBot((prev) =>
      prev.mapAvatarModel === modelUrl ? prev : baseBot(modelUrl),
    );
  }, [modelUrl]);

  useEffect(() => {
    if (!client) return;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const offs = [
      client.on("review.started", (e) => {
        setBot((prev) => ({ ...prev, workingOn: `reading #${e.prNumber}` }));
        setBubble(`On it — reading #${e.prNumber}`);
        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = setTimeout(() => setBubble(null), 8000);
      }),
      client.on("review.finished", (e) => {
        const text =
          e.findingCount === 0
            ? `#${e.prNumber} looks clean`
            : `${e.findingCount} finding${e.findingCount === 1 ? "" : "s"} on #${e.prNumber}`;
        setBot((prev) => ({ ...prev, workingOn: text }));
        setBubble(text);
        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = setTimeout(() => {
          setBubble(null);
          setBot((prev) =>
            prev.workingOn === text ? { ...prev, workingOn: null } : prev,
          );
        }, 45000);
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [client]);

  return { bot, bubble };
}
