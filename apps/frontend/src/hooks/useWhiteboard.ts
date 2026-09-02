import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeClient } from "@/lib/realtime";

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  strokeId: string;
  color: string;
  width: number;
  points: WhiteboardPoint[];
}

interface UseWhiteboardResult {
  strokes: WhiteboardStroke[];
  isLive: boolean;
  commit: (points: WhiteboardPoint[], color: string, width: number) => void;
  clear: () => void;
}

/**
 * Collaborative whiteboard for a single `boardId` (one per wall panel).
 * Strokes are broadcast as realtime `whiteboard.stroke` events; the server
 * relays them to every client in the workspace and buffers the last 200 per
 * board, so a modal opened later replays existing strokes via
 * `whiteboard.history`. No database writes — the buffer lives in the hub.
 */
export function useWhiteboard(
  boardId: string,
  client: RealtimeClient | null,
): UseWhiteboardResult {
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [isLive, setIsLive] = useState(false);
  const seqRef = useRef(0);

  const requestHistory = useCallback(() => {
    if (!client) return;
    setStrokes([]);
    client.requestWhiteboardHistory(boardId);
  }, [client, boardId]);

  useEffect(() => {
    if (!client) return;
    requestHistory();

    const offs = [
      client.on("whiteboard.history", (e) => {
        if (e.boardId !== boardId) return;
        setStrokes(e.strokes);
        setIsLive(true);
      }),
      client.on("whiteboard.stroke", (e) => {
        if (e.boardId !== boardId) return;
        setStrokes((prev) =>
          prev.some((s) => s.strokeId === e.stroke.strokeId)
            ? prev
            : [...prev, e.stroke],
        );
      }),
      client.on("whiteboard.clear", (e) => {
        if (e.boardId !== boardId) return;
        setStrokes([]);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [client, boardId, requestHistory]);

  const commit = useCallback(
    (points: WhiteboardPoint[], color: string, width: number) => {
      if (points.length < 2) return;
      const stroke: WhiteboardStroke = {
        strokeId: `${boardId}-${Date.now()}-${++seqRef.current}`,
        color,
        width,
        points,
      };
      setStrokes((prev) => [...prev, stroke]);
      client?.sendWhiteboardStroke(boardId, stroke);
    },
    [client, boardId],
  );

  const clear = useCallback(() => {
    setStrokes([]);
    client?.sendWhiteboardClear(boardId);
  }, [client, boardId]);

  return { strokes, isLive, commit, clear };
}
