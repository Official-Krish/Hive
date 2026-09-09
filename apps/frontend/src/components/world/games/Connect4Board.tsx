import { useEffect, useMemo, useRef, useState } from "react";
import {
  C4_COLS,
  C4_ROWS,
  c4CellsFromString,
  c4RowFor,
  findWinLine,
} from "@hive/games";

const W = 490;
const H = 420;
const PAD = 18;
const CELL_W = (W - PAD * 2) / C4_COLS;
const CELL_H = (H - PAD * 2) / C4_ROWS;

interface Connect4BoardProps {
  board: string;
  /** My disc, or null for spectators (read-only). */
  myDisc: "R" | "Y" | null;
  canMove: boolean;
  onMove: (col: number) => void;
}

/**
 * Canvas-2D Connect 4 board. Click a column to drop; the winning line
 * highlights from the shared engine's scan.
 */
export function Connect4Board({
  board,
  myDisc,
  canMove,
  onMove,
}: Connect4BoardProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const cells = useMemo(() => {
    try {
      return c4CellsFromString(board);
    } catch {
      return null;
    }
  }, [board]);
  const line = useMemo(() => (cells ? findWinLine(cells) : null), [cells]);
  const lineSet = useMemo(
    () => new Set((line ?? []).map(([c, r]) => `${c}:${r}`)),
    [line],
  );

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !cells) return;
    ctx.clearRect(0, 0, W, H);
    // frame
    ctx.fillStyle = "#1e3a5f";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 16);
    ctx.fill();
    for (let c = 0; c < C4_COLS; c++) {
      for (let r = 0; r < C4_ROWS; r++) {
        // row 0 is the bottom — flip for canvas space
        const x = PAD + c * CELL_W + CELL_W / 2;
        const y = H - PAD - r * CELL_H - CELL_H / 2;
        const disc = cells[c]![r];
        ctx.beginPath();
        ctx.arc(x, y, Math.min(CELL_W, CELL_H) * 0.38, 0, Math.PI * 2);
        if (!disc) {
          ctx.fillStyle = "#0b2038";
          ctx.fill();
        } else {
          const grad = ctx.createRadialGradient(
            x - 6,
            y - 6,
            4,
            x,
            y,
            Math.min(CELL_W, CELL_H) * 0.38,
          );
          if (disc === "R") {
            grad.addColorStop(0, "#fda4af");
            grad.addColorStop(1, "#e11d48");
          } else {
            grad.addColorStop(0, "#fde68a");
            grad.addColorStop(1, "#d97706");
          }
          ctx.fillStyle = grad;
          ctx.fill();
          if (lineSet.has(`${c}:${r}`)) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }
      }
    }
    // hover preview
    if (hover !== null && canMove && myDisc && cells) {
      const row = c4RowFor(cells, hover);
      if (row >= 0) {
        const x = PAD + hover * CELL_W + CELL_W / 2;
        const y = PAD / 2 + 6;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = myDisc === "R" ? "#e11d48" : "#d97706";
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  });

  const colFromEvent = (e: React.MouseEvent): number | null => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const col = Math.floor((x - PAD) / CELL_W);
    return col >= 0 && col < C4_COLS ? col : null;
  };

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      onClick={(e) => {
        if (!canMove || !myDisc) return;
        const col = colFromEvent(e);
        if (col !== null) onMove(col);
      }}
      onMouseMove={(e) => setHover(colFromEvent(e))}
      onMouseLeave={() => setHover(null)}
      className="w-full cursor-pointer rounded-2xl"
      style={{ aspectRatio: `${W} / ${H}` }}
      aria-label="Connect four board"
    />
  );
}
