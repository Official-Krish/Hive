import { useEffect, useRef, useState } from "react";
import type { RealtimeClient } from "@/lib/realtime";
import { useWhiteboard, type WhiteboardPoint } from "@/hooks/useWhiteboard";
import { WModal } from "./motion";
import { DBtn, EYEBROW, useEscape } from "./chrome";
import { cn } from "@/lib/utils";

const COLORS: Array<{ hex: string; name: string }> = [
  { hex: "#1c1917", name: "Ink black" },
  { hex: "#d97706", name: "Amber" },
  { hex: "#b91c1c", name: "Red" },
  { hex: "#2563eb", name: "Blue" },
  { hex: "#059669", name: "Green" },
  { hex: "#7c3aed", name: "Violet" },
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
  const [color, setColor] = useState<string>(COLORS[0]?.hex ?? "#1c1917");
  const [confirmClear, setConfirmClear] = useState(false);

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
      if (!p0) continue;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      if (s.points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          p0.x * canvas.width,
          p0.y * canvas.height,
          s.width / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        continue;
      }
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
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 2500);
    return () => clearTimeout(t);
  }, [confirmClear]);

  useEscape(onClose);

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

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    commit(pointsRef.current, color, STROKE_WIDTH);
    pointsRef.current = [];
  };

  const onPointerUp = finishStroke;
  const onPointerCancel = finishStroke;
  const onPointerLeave = finishStroke;

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    clear();
  };

  return (
    <WModal
      label={`Whiteboard ${boardId}`}
      onClose={onClose}
      wide
      className="h-[min(86vh,860px)] max-w-[min(1024px,96vw)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.07] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className={EYEBROW}>Whiteboard</span>
          <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] text-neutral-600 ring-1 ring-black/[0.08]">
            {boardId}
          </span>
          {isLive ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <span
                aria-hidden
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none"
              />
              live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-neutral-300"
              />
              offline — changes won&apos;t sync
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" aria-live="polite">
          {confirmClear ? (
            <DBtn
              variant="danger"
              onClick={handleClear}
              className="px-2.5 py-1 text-[12px]"
            >
              Sure?
            </DBtn>
          ) : (
            <DBtn
              variant="ghost"
              onClick={handleClear}
              className="px-2.5 py-1 text-[12px]"
            >
              Clear
            </DBtn>
          )}
          <DBtn
            variant="ghost"
            onClick={onClose}
            className="px-2.5 py-1 text-[12px]"
          >
            Close
          </DBtn>
        </div>
      </div>

      {/* Tray + board */}
      <div className="flex min-h-0 flex-col">
        <div
          className="flex items-center gap-2 px-4 py-2"
          role="radiogroup"
          aria-label="Ink color"
        >
          {COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={color === c.hex}
              onClick={() => setColor(c.hex)}
              className={cn(
                "h-5 w-5 rounded-full ring-2 ring-offset-1 ring-offset-[#f4f2ed] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-zinc-900",
                color === c.hex ? "ring-zinc-900" : "ring-transparent",
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        <div className="min-h-0 flex-1 px-4 pb-4">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Shared whiteboard ${boardId}. Use ink color ${COLORS.find((c) => c.hex === color)?.name ?? "selected"}; drawing needs a pointer or touch.`}
            width={DRAW_LEN}
            height={DRAW_HEIGHT}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
            className="w-full touch-none rounded-xl bg-white shadow-inner ring-1 ring-black/[0.08]"
          />
        </div>
      </div>
    </WModal>
  );
}
