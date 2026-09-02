import { useEffect, useRef, useState } from "react";
import type { RealtimeClient } from "@/lib/realtime";
import { useWhiteboard, type WhiteboardPoint } from "@/hooks/useWhiteboard";
import { cn } from "@/lib/utils";

const COLORS = [
  "#1c1917",
  "#d97706",
  "#b91c1c",
  "#2563eb",
  "#059669",
  "#7c3aed",
];
const STROKE_WIDTH = 3;
const DRAW_LEN = 1440;
const DRAW_HEIGHT = 900;

interface WhiteboardModalProps {
  boardId: string;
  client: RealtimeClient | null;
  onClose: () => void;
}

/**
 * Full-window collaborative whiteboard. Pointer strokes are normalised to
 * [0..1] and broadcast via `whiteboard.stroke`; every open client redraws the
 * whole canvas from its stroke list. `useWhiteboard` replays the server's
 * in-memory buffer on open, so someone at the same wall sees your marks.
 */
export function WhiteboardModal({
  boardId,
  client,
  onClose,
}: WhiteboardModalProps) {
  const { strokes, isLive, commit, clear } = useWhiteboard(boardId, client);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<WhiteboardPoint[]>([]);
  const [color, setColor] = useState<string>(COLORS[0] ?? "#1c1917");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes) {
      const p0 = s.points[0];
      if (!p0 || s.points.length < 2) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(p0.x * canvas.width, p0.y * canvas.height);
      for (let i = 1; i < s.points.length; i++) {
        const pt = s.points[i];
        if (!pt) continue;
        ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const localPoint = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): WhiteboardPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    pointsRef.current = [localPoint(e)];
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = localPoint(e);
    const pts = pointsRef.current;
    const last = pts[pts.length - 1];
    if (!last) return;
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.003) return;
    pts.push(p);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x * canvas.width, last.y * canvas.height);
    ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    ctx.stroke();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drawingRef.current) return;
    drawingRef.current = false;
    commit(pointsRef.current, color, STROKE_WIDTH);
    pointsRef.current = [];
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex flex-col bg-zinc-950/85 p-4 backdrop-blur-[2px]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl bg-[#f4f2ed] ring-1 ring-black/[0.09] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.07] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Whiteboard
            </span>
            <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] text-neutral-600 ring-1 ring-black/[0.08]">
              {boardId}
            </span>
            {isLive && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clear}
              className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-semibold text-neutral-700 ring-1 ring-black/[0.09] transition-colors hover:bg-neutral-100"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-neutral-950 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tray + board */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setColor(c)}
                className={cn(
                  "h-5 w-5 rounded-full ring-2 ring-offset-1 ring-offset-[#f4f2ed] transition-transform hover:scale-110",
                  color === c ? "ring-zinc-900" : "ring-transparent",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex-1 px-4 pb-4">
            <canvas
              ref={canvasRef}
              width={DRAW_LEN}
              height={DRAW_HEIGHT}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="w-full touch-none rounded-xl bg-white shadow-inner ring-1 ring-black/[0.08]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
