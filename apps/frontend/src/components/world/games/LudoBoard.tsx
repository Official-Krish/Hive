import { useEffect, useMemo, useRef, useState } from "react";
import {
  LUDO_LOOP,
  LUDO_YARD_COLORS,
  LUDO_YARD_DARK,
  LUDO_YARD_LIGHT,
  ludoClassicStart,
  ludoMovable,
  ludoStateFromString,
  ludoYard,
} from "@hive/games";
import { DieIcon } from "./GameIcons";
import { playBoardSound } from "./sound";

const SIZE = 480;
const N = 15;
const CELL = SIZE / N;

/**
 * Classic 52-cell outer path, clockwise from green start (row, col).
 * Star safes: the starts plus 8, 21, 34, 47.
 */
const PATH: Array<[number, number]> = [
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0],
];
const STAR_IDX = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Home columns by yard, outside-in (classic 5; tokens use the inner 4). */
const HOME_COLS: Array<Array<[number, number]>> = [
  [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
  [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
];

/** Yard grid origins by yard index (TL, TR, BR, BL). */
const YARD_RC: Array<[number, number]> = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
];

interface LudoBoardProps {
  board: string;
  /** My seat index, or null for spectators (read-only). */
  mySeat: number | null;
  canMove: boolean;
  /** Seat names in turn order (yard labels). */
  names?: string[];
  onRoll: () => void;
  onToken: (token: number) => void;
}

type HitToken = { x: number; y: number; seat: number; token: number };

function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Glossy 3D pawn token in a yard color, standing at (x, y). */
function pin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  dark: string,
  r: number,
  glow: boolean,
): void {
  const hy = y - r * 1.05; // head center
  // ground shadow
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.72, r * 0.78, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fill();

  ctx.save();
  if (glow) {
    ctx.shadowColor = "rgba(251,191,36,0.95)";
    ctx.shadowBlur = 16;
  }
  // base
  const baseGrad = ctx.createLinearGradient(x - r * 0.7, 0, x + r * 0.7, 0);
  baseGrad.addColorStop(0, dark);
  baseGrad.addColorStop(0.45, color);
  baseGrad.addColorStop(1, dark);
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.42, r * 0.68, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = baseGrad;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // neck
  const neckGrad = ctx.createLinearGradient(x - r * 0.34, 0, x + r * 0.34, 0);
  neckGrad.addColorStop(0, dark);
  neckGrad.addColorStop(0.5, color);
  neckGrad.addColorStop(1, dark);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.34, y + r * 0.35);
  ctx.lineTo(x - r * 0.22, hy + r * 0.25);
  ctx.lineTo(x + r * 0.22, hy + r * 0.25);
  ctx.lineTo(x + r * 0.34, y + r * 0.35);
  ctx.closePath();
  ctx.fillStyle = neckGrad;
  ctx.fill();
  // head
  const headGrad = ctx.createRadialGradient(
    x - r * 0.3,
    hy - r * 0.35,
    r * 0.08,
    x,
    hy,
    r * 0.78,
  );
  headGrad.addColorStop(0, "#ffffff");
  headGrad.addColorStop(0.35, color);
  headGrad.addColorStop(1, dark);
  ctx.beginPath();
  ctx.arc(x, hy, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = headGrad;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // specular highlight
  ctx.beginPath();
  ctx.arc(x - r * 0.26, hy - r * 0.3, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  // face emblem
  ctx.beginPath();
  ctx.arc(x, hy + r * 0.08, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, hy + r * 0.08, r * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  if (glow) {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 1.55, 0, Math.PI * 2);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Classic 15×15 Ludo board, four tokens a seat: corner yards with token
 * slots + player labels, white cross track with colored starts + star safes,
 * colored home columns, quadrant center, tappable map-pin tokens. Seats map
 * to classic yards (two players sit diagonally).
 */
export function LudoBoard({
  board,
  mySeat,
  canMove,
  names = [],
  onRoll,
  onToken,
}: LudoBoardProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hitsRef = useRef<HitToken[]>([]);
  const prevTokens = useRef<string | null>(null);

  // Dice-roll magic: cycle faces after throwing, settle on the live value.
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState(6);
  const rollMovesRef = useRef<number | null>(null);

  const state = useMemo(() => {
    try {
      return ludoStateFromString(board);
    } catch {
      return null;
    }
  }, [board]);

  const iPick = state !== null && mySeat !== null && canMove;
  const movable = useMemo(
    () =>
      state && mySeat !== null && canMove && state.turn === mySeat
        ? ludoMovable(state, mySeat)
        : [],
    [state, mySeat, canMove],
  );
  const picking = iPick && state.turn === mySeat && state.pendingRoll !== null;

  // Settle the dice once the rolled state lands (with a hard stop).
  useEffect(() => {
    if (!rolling || !state) return;
    if (rollMovesRef.current !== null && state.moves !== rollMovesRef.current) {
      setRolling(false);
      if (state.lastRoll !== null) setFace(state.lastRoll);
      return;
    }
    const t = window.setTimeout(() => {
      setRolling(false);
      if (state.lastRoll !== null) setFace(state.lastRoll);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [rolling, state]);

  useEffect(() => {
    if (!rolling) return;
    const t = window.setInterval(() => {
      setFace(1 + Math.floor(Math.random() * 6));
    }, 90);
    return () => window.clearInterval(t);
  }, [rolling]);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !state) return;

    const sig = JSON.stringify(state.tokens);
    if (prevTokens.current && prevTokens.current !== sig) {
      const was: number[][] = JSON.parse(prevTokens.current) as number[][];
      const sentHome = state.tokens.some((row, s) =>
        row.some((t, i) => t === -1 && (was[s]?.[i] ?? -1) >= 0),
      );
      if (sentHome) playBoardSound("capture");
      else playBoardSound("move");
      if (state.status === "win") playBoardSound("notify");
    }
    prevTokens.current = sig;

    const hits: HitToken[] = [];
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#123524";
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 18);
    ctx.fill();

    const bw = CELL * (N - 1);
    ctx.save();
    ctx.translate(CELL * 0.5, CELL * 0.5);

    const X = (c: number): number => c * CELL;
    const Y = (r: number): number => r * CELL;

    ctx.fillStyle = "#f7f3e6";
    ctx.fillRect(-CELL / 2, -CELL / 2, bw + CELL, bw + CELL);

    // cross arms
    ctx.strokeStyle = "#c9c2a8";
    ctx.lineWidth = 1;
    for (let r = 6; r <= 8; r++) {
      for (let c = 0; c < N; c++) {
        ctx.strokeRect(X(c) - CELL / 2, Y(r) - CELL / 2, CELL, CELL);
      }
    }
    for (let c = 6; c <= 8; c++) {
      for (let r = 0; r < N; r++) {
        ctx.strokeRect(X(c) - CELL / 2, Y(r) - CELL / 2, CELL, CELL);
      }
    }

    const yardOf = (s: number): number => ludoYard(state.seats, s);
    const colorOf = (s: number): string =>
      LUDO_YARD_COLORS[yardOf(s)] ?? "#999";

    // home columns (colored, inner 4 used by tokens)
    for (let s = 0; s < state.seats; s++) {
      const y = yardOf(s);
      const col = HOME_COLS[y]!;
      col.forEach(([r, c], k) => {
        ctx.fillStyle = LUDO_YARD_COLORS[y]!;
        ctx.fillRect(X(c) - CELL / 2, Y(r) - CELL / 2, CELL, CELL);
        ctx.strokeStyle = k === 0 ? "#ffffff" : LUDO_YARD_DARK[y]!;
        ctx.lineWidth = k === 0 ? 2 : 1;
        ctx.strokeRect(X(c) - CELL / 2, Y(r) - CELL / 2, CELL, CELL);
      });
      const [ar, ac] = col[0]!;
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${CELL * 0.55}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const arrow = y === 0 ? "↓" : y === 1 ? "←" : y === 2 ? "↑" : "→";
      ctx.fillText(arrow, X(ac), Y(ar) + 1);
    }

    // colored start cells
    for (let s = 0; s < state.seats; s++) {
      const [r, c] = PATH[ludoClassicStart(state.seats, s)]!;
      ctx.fillStyle = colorOf(s);
      ctx.fillRect(X(c) - CELL / 2, Y(r) - CELL / 2, CELL, CELL);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(X(c) - CELL / 2, Y(r) - CELL / 2, CELL, CELL);
    }

    // star safes (non-start)
    const starts = new Set(
      Array.from({ length: state.seats }, (_, s) =>
        ludoClassicStart(state.seats, s),
      ),
    );
    for (const idx of STAR_IDX) {
      if (starts.has(idx)) continue;
      const [r, c] = PATH[idx]!;
      star(ctx, X(c), Y(r), CELL * 0.28, "#a8a184");
    }

    // center quadrants
    const corners: Array<[number, number]> = [
      [6, 6],
      [6, 8],
      [8, 8],
      [8, 6],
    ];
    for (let q = 0; q < 4; q++) {
      const seatHere = Array.from({ length: state.seats }, (_, s) => s).find(
        (s) => yardOf(s) === q,
      );
      const color = seatHere !== undefined ? colorOf(seatHere) : "#cfc8ae";
      const [r1, c1] = corners[q]!;
      const [r2, c2] = corners[(q + 1) % 4]!;
      ctx.beginPath();
      ctx.moveTo(X(7), Y(7));
      ctx.lineTo(X(c1), Y(r1));
      ctx.lineTo(X(c2), Y(r2));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#f7f3e6";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.strokeStyle = "#3f3a2e";
    ctx.lineWidth = 2;
    ctx.strokeRect(X(6) - CELL / 2, Y(6) - CELL / 2, CELL * 3, CELL * 3);

    // corner yards (only seated yards feel alive; others stay neutral)
    const yardsPresent = new Set(
      Array.from({ length: state.seats }, (_, s) => yardOf(s)),
    );
    for (let y = 0; y < 4; y++) {
      const [yr, yc] = YARD_RC[y]!;
      const x0 = X(yc) - CELL / 2;
      const y0 = Y(yr) - CELL / 2;
      const live = yardsPresent.has(y);
      const seatHere = Array.from({ length: state.seats }, (_, s) => s).find(
        (s) => yardOf(s) === y,
      );
      ctx.fillStyle = live ? LUDO_YARD_COLORS[y]! : "#d8d2ba";
      ctx.fillRect(x0, y0, CELL * 6, CELL * 6);
      const px = x0 + CELL * 0.9;
      const py = y0 + CELL * 0.9;
      const pw = CELL * 4.2;
      const ph = CELL * 3.4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 8);
      ctx.fill();
      if (live) {
        ctx.strokeStyle = LUDO_YARD_DARK[y]!;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const slots: Array<[number, number]> = [
        [px + pw * 0.28, py + ph * 0.3],
        [px + pw * 0.72, py + ph * 0.3],
        [px + pw * 0.28, py + ph * 0.72],
        [px + pw * 0.72, py + ph * 0.72],
      ];
      slots.forEach(([sx, sy], k) => {
        const occupied =
          live && seatHere !== undefined && state.tokens[seatHere]![k] === -1;
        ctx.beginPath();
        ctx.arc(sx, sy, CELL * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = occupied ? LUDO_YARD_LIGHT[y]! : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = live ? LUDO_YARD_COLORS[y]! : "#b8ad8a";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      if (live && seatHere !== undefined) {
        const label = names[seatHere] ?? `Seat ${seatHere + 1}`;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${CELL * 0.52}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label.slice(0, 12), x0 + CELL * 3, y0 + CELL * 5.55);
      }
    }

    ctx.strokeStyle = "#3f3a2e";
    ctx.lineWidth = 3;
    ctx.strokeRect(-CELL / 2, -CELL / 2, bw + CELL, bw + CELL);

    // ---- tokens ----
    type Placed = { x: number; y: number; seat: number; token: number };
    const placed: Placed[] = [];
    const atKey = new Map<string, number[]>();
    const keyOf = (x: number, y: number): string =>
      `${Math.round(x / 6)}:${Math.round(y / 6)}`;

    const yardSlot = (s: number, t: number): [number, number] => {
      const y = yardOf(s);
      const [yr, yc] = YARD_RC[y]!;
      const x0 = X(yc) - CELL / 2;
      const y0 = Y(yr) - CELL / 2;
      const px = x0 + CELL * 0.9;
      const py = y0 + CELL * 0.9;
      const pw = CELL * 4.2;
      const ph = CELL * 3.4;
      const fx = t % 2 === 0 ? 0.28 : 0.72;
      const fy = t < 2 ? 0.3 : 0.72;
      return [px + pw * fx, py + ph * fy];
    };

    state.tokens.forEach((row, s) => {
      row.forEach((p, t) => {
        let gx: number;
        let gy: number;
        if (p === -1) {
          [gx, gy] = yardSlot(s, t);
        } else if (p >= 32) {
          // finished tokens share the center, fanned in a row
          const homeIdx = row.slice(0, t).filter((v) => v >= 32).length;
          gx = X(7) + (homeIdx - 1.5) * 13;
          gy = Y(7);
        } else if (p >= LUDO_LOOP) {
          const [r, c] = HOME_COLS[yardOf(s)]![p - LUDO_LOOP + 1]!;
          gx = X(c);
          gy = Y(r);
        } else {
          const f =
            (ludoClassicStart(state.seats, s) + (p * PATH.length) / LUDO_LOOP) %
            PATH.length;
          const i0 = Math.floor(f);
          const tt = f - i0;
          const [r0, c0] = PATH[i0]!;
          const [r1, c1] = PATH[(i0 + 1) % PATH.length]!;
          gx = X(c0) + (X(c1) - X(c0)) * tt;
          gy = Y(r0) + (Y(r1) - Y(r0)) * tt;
        }
        placed.push({ x: gx, y: gy, seat: s, token: t });
        const k = keyOf(gx, gy);
        atKey.set(k, [...(atKey.get(k) ?? []), placed.length - 1]);
      });
    });

    const movableSet = new Set(movable.map((t) => `${mySeat}:${t}`));
    for (const idxs of atKey.values()) {
      idxs.forEach((pi, n) => {
        const pl = placed[pi]!;
        const ox = idxs.length > 1 ? (n - (idxs.length - 1) / 2) * 12 : 0;
        const pickable = picking && movableSet.has(`${pl.seat}:${pl.token}`);
        pin(
          ctx,
          pl.x + ox,
          pl.y,
          LUDO_YARD_COLORS[yardOf(pl.seat)]!,
          LUDO_YARD_DARK[yardOf(pl.seat)]!,
          pl.x === X(7) && pl.y === Y(7) ? 10 : 12,
          pickable || (pl.seat === state.turn && state.pendingRoll === null),
        );
        hits.push({ x: pl.x + ox, y: pl.y, seat: pl.seat, token: pl.token });
      });
    }
    hitsRef.current = hits;

    ctx.restore();
  });

  const myTurn = canMove && mySeat !== null && state?.turn === mySeat;
  const showRoll = myTurn && state && state.pendingRoll === null;

  const throwDice = (): void => {
    if (!state) return;
    rollMovesRef.current = state.moves;
    setRolling(true);
    onRoll();
  };

  const tapToken = (e: React.MouseEvent): void => {
    if (!picking || mySeat === null) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * SIZE - CELL * 0.5;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE - CELL * 0.5;
    let best: HitToken | null = null;
    let bestD = 22;
    for (const h of hitsRef.current) {
      if (h.seat !== mySeat) continue;
      if (!movable.includes(h.token)) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (best) {
      playBoardSound("select");
      onToken(best.token);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center gap-2">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <canvas
          ref={ref}
          width={SIZE}
          height={SIZE}
          onClick={tapToken}
          className={
            picking
              ? "aspect-square h-full max-h-full w-auto max-w-full cursor-pointer rounded-xl"
              : "aspect-square h-full max-h-full w-auto max-w-full rounded-xl"
          }
          aria-label="Ludo board"
        />
      </div>
      {/* Dice tray — its own strip below the board, never covering cells */}
      <div className="flex w-full shrink-0 items-center gap-3 rounded-2xl bg-neutral-900/92 px-3 py-2 shadow-xl ring-1 ring-white/15 backdrop-blur-[2px]">
        <DieIcon
          value={rolling ? face : (state?.lastRoll ?? undefined)}
          className="size-9 text-amber-300"
        />
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
            {state && picking
              ? "Pick a glowing goti"
              : myTurn
                ? "Your throw"
                : state
                  ? `${names[state.turn] ?? "Opponent"} to throw`
                  : "Ludo"}
          </div>
          <div className="truncate text-[12.5px] font-bold text-white">
            {rolling
              ? "Rolling…"
              : state && state.pendingRoll !== null
                ? `Rolled ${state.pendingRoll}`
                : state?.lastRoll !== null && state
                  ? `Last roll ${state.lastRoll}`
                  : "Start the game"}
          </div>
        </div>
        {showRoll && (
          <button
            type="button"
            onClick={throwDice}
            className="shrink-0 animate-pulse rounded-xl bg-amber-400 px-5 py-2 text-[13px] font-black text-neutral-950 transition-transform hover:scale-105"
          >
            ROLL
          </button>
        )}
      </div>
    </div>
  );
}
