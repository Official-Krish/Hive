import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkerBoardFromString,
  checkerCaptures,
  checkerHasCapture,
  checkerMovesFor,
} from "@hive/games";
import { playBoardSound } from "./sound";

const SIZE = 480;
const SQ = SIZE / 8;

interface CheckersBoardProps {
  board: string;
  /** My color, or null for spectators (read-only). */
  myColor: "R" | "B" | null;
  canMove: boolean;
  onMove: (from: number, to: number) => void;
}

/** Square index under a pointer event (null outside the board). */
function squareFromEvent(
  e: React.MouseEvent,
  ref: React.RefObject<HTMLCanvasElement | null>,
): number | null {
  const rect = ref.current?.getBoundingClientRect();
  if (!rect) return null;
  const f = Math.floor(((e.clientX - rect.left) / rect.width) * 8);
  const r = 7 - Math.floor(((e.clientY - rect.top) / rect.height) * 8);
  return f >= 0 && f < 8 && r >= 0 && r <= 7 ? r * 8 + f : null;
}

/**
 * Canvas-2D checkers board. Tap a piece to see legal landings (captures
 * forced and dotted); tap a landing to move. Chains stay selected.
 */
export function CheckersBoard({
  board,
  myColor,
  canMove,
  onMove,
}: CheckersBoardProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const cells = useMemo(() => {
    try {
      return checkerBoardFromString(board);
    } catch {
      return null;
    }
  }, [board]);

  const targets = useMemo(() => {
    if (!cells || selected === null || !canMove || !myColor) return [];
    return checkerMovesFor(cells, selected);
  }, [cells, selected, canMove, myColor]);

  // Drop selection when the board updates under us.
  useEffect(() => {
    setSelected(null);
  }, [board]);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !cells) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    // frame
    ctx.fillStyle = "#4a2f1d";
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 16);
    ctx.fill();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const dark = (r + f) % 2 === 1;
        const x = f * SQ;
        const y = (7 - r) * SQ;
        ctx.fillStyle = dark ? "#8a5a33" : "#ecdcb9";
        ctx.fillRect(x + 1, y + 1, SQ - 2, SQ - 2);
      }
    }
    const targetsSet = new Set(targets);
    // capture hint ring on pieces that must capture
    const mustCapture =
      canMove && myColor && cells ? checkerHasCapture(cells, myColor) : false;
    for (let i = 0; i < 64; i++) {
      const p = cells[i]!;
      const cx = fileOf(i) * SQ + SQ / 2;
      const cy = (7 - rankOf(i)) * SQ + SQ / 2;
      if (targetsSet.has(i)) {
        ctx.beginPath();
        ctx.arc(cx, cy, SQ * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(251,191,36,0.95)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (!p) continue;
      const rad = SQ * 0.36;
      // shadow
      ctx.beginPath();
      ctx.arc(cx + 2, cy + 3, rad, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      const grad = ctx.createRadialGradient(
        cx - rad * 0.35,
        cy - rad * 0.4,
        rad * 0.15,
        cx,
        cy,
        rad,
      );
      if (p.color === "R") {
        grad.addColorStop(0, "#fca5a5");
        grad.addColorStop(0.5, "#dc2626");
        grad.addColorStop(1, "#7f1d1d");
      } else {
        grad.addColorStop(0, "#a3a3a3");
        grad.addColorStop(0.5, "#404040");
        grad.addColorStop(1, "#0a0a0a");
      }
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (p.rank === "king") {
        // crown path (no font glyphs)
        const s = SQ * 0.028;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(-9, -3.5);
        ctx.lineTo(-6.5, -1);
        ctx.lineTo(-4, -5.5);
        ctx.lineTo(0, 0);
        ctx.lineTo(4, -5.5);
        ctx.lineTo(6.5, -1);
        ctx.lineTo(9, -3.5);
        ctx.lineTo(7, 5.5);
        ctx.lineTo(-7, 5.5);
        ctx.closePath();
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
        ctx.fillRect(-7, 6.5, 14, 2);
        ctx.restore();
      }
      if (i === selected) {
        ctx.beginPath();
        ctx.arc(cx, cy, rad + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (
        mustCapture &&
        p.color === myColor &&
        checkerCaptures(cells, i).length > 0
      ) {
        ctx.beginPath();
        ctx.arc(cx, cy, rad + 4, 0, Math.PI * 2);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  });

  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      onClick={(e) => {
        if (!canMove || !myColor || !cells) return;
        const sq = squareFromEvent(e, ref);
        if (sq === null) return;
        if (selected !== null && targets.includes(sq)) {
          playBoardSound("move");
          onMove(selected, sq);
          return;
        }
        const p = cells[sq];
        if (p && p.color === myColor) {
          playBoardSound("select");
          setSelected(sq);
        } else {
          setSelected(null);
        }
      }}
      className="h-full w-full cursor-pointer rounded-xl"
      aria-label="Checkers board"
    />
  );
}

function fileOf(i: number): number {
  return i % 8;
}

function rankOf(i: number): number {
  return Math.floor(i / 8);
}
