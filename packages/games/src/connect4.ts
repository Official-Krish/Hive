export const C4_COLS = 7;
export const C4_ROWS = 6;

export type C4Disc = "R" | "Y";
export type C4Cell = C4Disc | null;

export type C4Status = "playing" | "win" | "draw";

export interface C4State {
  /** Column-major grid: cells[col][row], row 0 is the bottom. */
  cells: C4Cell[][];
  turn: C4Disc;
  status: C4Status;
  winner: C4Disc | null;
  /** Winning line (for UI highlight), if any. */
  line: [number, number][] | null;
  moves: number;
}

export type C4MoveError =
  "bad-column" | "column-full" | "wrong-turn" | "game-over";

export function initialC4State(): C4State {
  return {
    cells: Array.from({ length: C4_COLS }, () =>
      Array<C4Cell>(C4_ROWS).fill(null),
    ),
    turn: "R",
    status: "playing",
    winner: null,
    line: null,
    moves: 0,
  };
}

/** Lowest empty row in a column, or -1 when full/invalid. */
export function c4RowFor(cells: C4Cell[][], col: number): number {
  if (col < 0 || col >= C4_COLS) return -1;
  return cells[col]!.findIndex((c) => c === null);
}

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

function winLine(
  cells: C4Cell[][],
  col: number,
  row: number,
): [number, number][] | null {
  const disc = cells[col]![row]!;
  for (const [dc, dr] of DIRS) {
    const line: [number, number][] = [[col, row]];
    for (const s of [1, -1] as const) {
      let c = col + s * dc;
      let r = row + s * dr;
      while (
        c >= 0 &&
        c < C4_COLS &&
        r >= 0 &&
        r < C4_ROWS &&
        cells[c]![r] === disc
      ) {
        line.push([c, r]);
        c += s * dc;
        r += s * dr;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

export interface C4Move {
  /** Column to drop into. */
  col: number;
  /** Expected turn (server checks the seat; engine double-checks). */
  by?: C4Disc;
}

/**
 * Drop a disc. Returns the new state, or an `error` (state unchanged).
 */
export function applyC4Move(
  state: C4State,
  move: C4Move,
): { state: C4State } | { error: C4MoveError } {
  if (state.status !== "playing") return { error: "game-over" };
  if (move.by && move.by !== state.turn) return { error: "wrong-turn" };
  if (move.col < 0 || move.col >= C4_COLS) return { error: "bad-column" };
  const row = c4RowFor(state.cells, move.col);
  if (row < 0) return { error: "column-full" };

  const cells = state.cells.map((c) => c.slice());
  cells[move.col]![row] = state.turn;
  const moves = state.moves + 1;
  const line = winLine(cells, move.col, row);
  const next: C4State = {
    cells,
    turn: state.turn === "R" ? "Y" : "R",
    status: line ? "win" : moves >= C4_COLS * C4_ROWS ? "draw" : "playing",
    winner: line ? state.turn : null,
    line,
    moves,
  };
  return { state: next };
}

/** Columns that still accept a disc. */
export function c4LegalColumns(state: C4State): number[] {
  if (state.status !== "playing") return [];
  const out: number[] = [];
  for (let c = 0; c < C4_COLS; c++) {
    if (c4RowFor(state.cells, c) >= 0) out.push(c);
  }
  return out;
}

/** Winning line anywhere on the grid (for UI highlight), if any. */
export function findWinLine(cells: C4Cell[][]): [number, number][] | null {
  for (let c = 0; c < C4_COLS; c++) {
    for (let r = 0; r < C4_ROWS; r++) {
      if (cells[c]![r] === null) continue;
      const line = winLine(cells, c, r);
      if (line) return line;
    }
  }
  return null;
}
