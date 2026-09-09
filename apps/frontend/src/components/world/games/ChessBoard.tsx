import { useEffect, useMemo, useRef, useState } from "react";
import {
  chessFromFen,
  inCheck,
  legalMoves,
  squareIndex,
  type ChessMove,
  type ChessPiece,
} from "@hive/games";
import { playBoardSound } from "./sound";

const SIZE = 480;
const CELL = SIZE / 8;

const GLYPHS: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

interface ChessBoardProps {
  fen: string;
  /** My color, or null for spectators (read-only). */
  myColor: "w" | "b" | null;
  /** False when it is not my turn or the match is over. */
  canMove: boolean;
  muted: boolean;
  onMove: (move: {
    from: number;
    to: number;
    promote?: "n" | "b" | "r" | "q";
  }) => void;
}

const samePiece = (a: ChessPiece | null, b: ChessPiece | null): boolean => {
  if (!a || !b) return a === b;
  return a.type === b.type && a.color === b.color;
};

/**
 * Canvas-2D chess board, chess.com-style: click-click or drag-to-move,
 * hover targets, last-move highlight, check alert, and move sounds.
 * Legal-move hints come from the shared engine; the server is authoritative.
 */
export function ChessBoard({
  fen,
  myColor,
  canMove,
  muted,
  onMove,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [hoverSq, setHoverSq] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ sq: number; x: number; y: number } | null>(
    null,
  );
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(
    null,
  );
  const prevPieces = useRef<Array<ChessPiece | null> | null>(null);
  const prevTurn = useRef<"w" | "b" | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const soundMuted = useRef(muted);
  soundMuted.current = muted;

  const state = useMemo(() => {
    try {
      return chessFromFen(fen);
    } catch {
      return null;
    }
  }, [fen]);

  // Derive the last move by diffing consecutive positions.
  useEffect(() => {
    if (!state) return;
    const prev = prevPieces.current;
    if (prev) {
      const mover = state.turn === "w" ? "b" : "w";
      const changed: number[] = [];
      for (let i = 0; i < 64; i++) {
        if (!samePiece(prev[i]!, state.board[i]!)) changed.push(i);
      }
      if (changed.length >= 2) {
        const emptied = changed.filter((i) => state.board[i] === null);
        const filled = changed.filter((i) => state.board[i] !== null);
        const from =
          emptied.find(
            (i) => prev[i]?.type === "k" && prev[i]?.color === mover,
          ) ??
          emptied.find((i) => prev[i]?.color === mover) ??
          changed[0]!;
        const arrived = filled.filter((i) => state.board[i]?.color === mover);
        const to =
          arrived.find((i) => state.board[i]?.type === "k") ??
          arrived[arrived.length - 1] ??
          changed[changed.length - 1]!;
        setLastMove({ from, to });
      }
    }
    prevPieces.current = state.board.slice();
  }, [state]);

  // Notify when the turn swings to me (with extra urgency on check).
  useEffect(() => {
    if (!state || !myColor) return;
    const was = prevTurn.current;
    prevTurn.current = state.turn;
    if (was !== null && was !== state.turn && state.turn === myColor) {
      if (!soundMuted.current) {
        playBoardSound(inCheck(state, myColor) ? "check" : "notify");
      }
    }
  }, [state, myColor]);

  const targets = useMemo(() => {
    if (!state || selected === null) return new Map<number, ChessMove[]>();
    const map = new Map<number, ChessMove[]>();
    for (const m of legalMoves(state, selected)) {
      const list = map.get(m.to) ?? [];
      list.push(m);
      map.set(m.to, list);
    }
    return map;
  }, [state, selected]);

  const flip = myColor === "b";

  const toLocal = (clientX: number, clientY: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    return { x, y };
  };

  const squareAt = (x: number, y: number): number | null => {
    const lf = Math.floor(x / CELL);
    const lr = Math.floor(y / CELL);
    if (lf < 0 || lf > 7 || lr < 0 || lr > 7) return null;
    const f = flip ? 7 - lf : lf;
    const r = flip ? lr : 7 - lr;
    return r * 8 + f;
  };

  const attemptMove = (from: number, to: number) => {
    if (!state || !myColor) return;
    const options = targets.get(to)?.filter((m) => m.from === from);
    if (!options || options.length === 0) return;
    const piece = state.board[from];
    const lastRank = myColor === "w" ? 7 : 0;
    if (
      piece?.type === "p" &&
      Math.floor(to / 8) === lastRank &&
      options.length > 1
    ) {
      setPromo({ from, to });
      return;
    }
    const dest = state.board[to];
    if (!soundMuted.current) playBoardSound(dest ? "capture" : "move");
    onMove({ from: options[0]!.from, to: options[0]!.to });
    setSelected(null);
  };

  const select = (sq: number) => {
    if (!state || !myColor) return;
    const piece = state.board[sq];
    if (piece && piece.color === myColor) {
      setSelected(sq);
      if (!soundMuted.current) playBoardSound("select");
    } else {
      setSelected(null);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!state || !canMove || !myColor || promo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = toLocal(e.clientX, e.clientY, rect);
    const sq = squareAt(x, y);
    if (sq === null) return;
    downPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    const piece = state.board[sq];
    if (piece && piece.color === myColor) {
      if (selected !== sq && !soundMuted.current) playBoardSound("select");
      setSelected(sq);
      setDrag({ sq, x, y });
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = toLocal(e.clientX, e.clientY, rect);
    setHoverSq(squareAt(x, y));
    if (drag) setDrag({ ...drag, x, y });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = toLocal(e.clientX, e.clientY, rect);
    const from = drag.sq;
    setDrag(null);
    const down = downPos.current;
    downPos.current = null;
    if (!down) return;
    const movedFar = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    const to = squareAt(x, y);
    if (to === null) {
      if (!movedFar) select(from);
      return;
    }
    if (!movedFar) {
      // Tap: select, or move if a target was tapped.
      if (selected !== null && selected !== from && targets.has(from)) {
        attemptMove(selected, from);
      } else {
        select(from);
      }
      return;
    }
    // Drag-and-drop onto a target square (fresh legality, not the memo —
    // the selection may have changed mid-drag).
    if (to !== from && state && myColor) {
      const fromTargets = legalMoves(state, from).filter((m) => m.to === to);
      if (fromTargets.length > 0) {
        const piece = state?.board[from];
        const lastRank = myColor === "w" ? 7 : 0;
        if (
          piece?.type === "p" &&
          Math.floor(to / 8) === lastRank &&
          fromTargets.length > 1
        ) {
          setPromo({ from, to });
          return;
        }
        const dest = state?.board[to];
        if (!soundMuted.current) playBoardSound(dest ? "capture" : "move");
        onMove({ from, to });
        setSelected(null);
        return;
      }
    }
    select(from);
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    if (!state) return;
    for (let lf = 0; lf < 8; lf++) {
      for (let lr = 0; lr < 8; lr++) {
        const f = flip ? 7 - lf : lf;
        const r = flip ? lr : 7 - lr;
        const sq = r * 8 + f;
        const light = (f + r) % 2 === 1;
        ctx.fillStyle = light ? "#e9e2d4" : "#7d8aa0";
        ctx.fillRect(lf * CELL, lr * CELL, CELL, CELL);
        // last-move trail (chess.com yellow)
        if (lastMove && (sq === lastMove.from || sq === lastMove.to)) {
          ctx.fillStyle = light
            ? "rgba(205,210,60,0.55)"
            : "rgba(155,160,40,0.6)";
          ctx.fillRect(lf * CELL, lr * CELL, CELL, CELL);
        }
        if (sq === selected || (hoverSq === sq && canMove && !!myColor)) {
          ctx.fillStyle = "rgba(52,211,153,0.55)";
          ctx.fillRect(lf * CELL, lr * CELL, CELL, CELL);
        }
        if (targets.has(sq)) {
          const occupied = !!state.board[sq];
          ctx.strokeStyle = "rgba(16,185,129,0.85)";
          ctx.lineWidth = 3;
          if (occupied) {
            // capture ring
            ctx.beginPath();
            ctx.arc(
              lf * CELL + CELL / 2,
              lr * CELL + CELL / 2,
              CELL * 0.44,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
          } else {
            ctx.fillStyle = "rgba(16,185,129,0.5)";
            ctx.beginPath();
            ctx.arc(
              lf * CELL + CELL / 2,
              lr * CELL + CELL / 2,
              CELL * 0.16,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
        const p = state.board[sq];
        // hide the piece being dragged — the ghost follows the cursor
        if (p && !(drag && drag.sq === sq)) {
          const inChk =
            p.type === "k" && inCheck(state, p.color) && state.turn === p.color;
          if (inChk) {
            ctx.fillStyle = "rgba(244,63,94,0.65)";
            ctx.fillRect(lf * CELL, lr * CELL, CELL, CELL);
          }
          ctx.font = `${CELL * 0.72}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = p.color === "w" ? "#fafafa" : "#1c1917";
          ctx.strokeStyle = p.color === "w" ? "#44403c" : "#fafafa";
          ctx.lineWidth = 1.5;
          const x = lf * CELL + CELL / 2;
          const y = lr * CELL + CELL / 2 + 2;
          ctx.strokeText(GLYPHS[p.type]!, x, y);
          ctx.fillText(GLYPHS[p.type]!, x, y);
        }
      }
    }
    // file/rank labels
    ctx.fillStyle = "rgba(28,25,23,0.55)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < 8; i++) {
      const f = flip ? 7 - i : i;
      ctx.fillText("abcdefgh"[f]!, i * CELL + 4, SIZE - 4);
      const r = flip ? i : 7 - i;
      ctx.fillText(String(r + 1), 4, i * CELL + 14);
    }
    // drag ghost
    if (drag && state.board[drag.sq]) {
      const p = state.board[drag.sq]!;
      ctx.globalAlpha = 0.9;
      ctx.font = `${CELL * 0.8}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = p.color === "w" ? "#fafafa" : "#1c1917";
      ctx.strokeStyle = p.color === "w" ? "#44403c" : "#fafafa";
      ctx.lineWidth = 1.5;
      ctx.strokeText(GLYPHS[p.type]!, drag.x, drag.y);
      ctx.fillText(GLYPHS[p.type]!, drag.x, drag.y);
      ctx.globalAlpha = 1;
    }
  };

  const hoveringOwn =
    hoverSq !== null && !!myColor && state?.board[hoverSq]?.color === myColor;
  const hoveringTarget = hoverSq !== null && targets.has(hoverSq);

  return (
    <div className="relative">
      <DrawCanvas
        draw={draw}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHoverSq(null);
          setDrag(null);
        }}
        cursor={
          !canMove || !myColor
            ? "default"
            : drag || hoveringOwn || hoveringTarget
              ? "pointer"
              : "default"
        }
      />
      {promo && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {(["q", "r", "b", "n"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (!soundMuted.current) playBoardSound("move");
                onMove({ from: promo.from, to: promo.to, promote: p });
                setPromo(null);
                setSelected(null);
              }}
              className="rounded-lg bg-neutral-950 px-3 py-1.5 text-xl text-white shadow-lg hover:bg-neutral-800"
              aria-label={`Promote to ${p}`}
            >
              {GLYPHS[p]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Canvas that repaints whenever the draw closure changes. */
function DrawCanvas({
  draw,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  cursor,
}: {
  draw: (ctx: CanvasRenderingContext2D) => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
  cursor: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    draw(ctx);
  });
  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className="w-full touch-none rounded-xl ring-1 ring-black/10"
      style={{ aspectRatio: "1", cursor }}
      aria-label="Chess board"
    />
  );
}

export { squareIndex };
