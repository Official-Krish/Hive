// ============================================================================
// CHECKERS — American/English draughts, 2 seats (red first).
// 8×8, men move/capture diagonally forward, kings both ways. Captures are
// mandatory incl. multi-jump chains (turn held mid-chain). Men crown on the
// far rank (move ends, even mid-chain). Win when the opponent has no pieces
// or no legal moves; 40 quiet half-moves without a capture crown draws.
// Squares are 0..63 like chess (a1 = 0); only dark squares play.
// ============================================================================

export type CheckerColor = "R" | "B";
export type CheckerRank = "man" | "king";

export interface CheckerPiece {
  color: CheckerColor;
  rank: CheckerRank;
}

export type CheckerSquare = CheckerPiece | null;

export type CheckerStatus = "playing" | "win" | "draw";

export interface CheckerState {
  board: CheckerSquare[];
  turn: CheckerColor;
  /** Square of the jumping piece mid-chain (null outside a chain). */
  chainFrom: number | null;
  /** Half-moves since the last capture or crowning. */
  quiet: number;
  status: CheckerStatus;
  winner: CheckerColor | null;
  moves: number;
}

export type CheckerMoveError =
  | "no-piece"
  | "wrong-turn"
  | "must-capture"
  | "must-continue"
  | "illegal-move"
  | "game-over";

const DIRS: Record<CheckerColor, Array<[number, number]>> = {
  R: [
    [-1, 1],
    [1, 1],
  ],
  B: [
    [-1, -1],
    [1, -1],
  ],
};
const KING_DIRS: Array<[number, number]> = [
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, -1],
];

const fileOf = (i: number): number => i % 8;
const rankOf = (i: number): number => Math.floor(i / 8);
const onBoard = (f: number, r: number): boolean =>
  f >= 0 && f < 8 && r >= 0 && r < 8;
const idx = (f: number, r: number): number => r * 8 + f;

export function initialCheckerState(): CheckerState {
  const board: CheckerSquare[] = Array(64).fill(null);
  for (let r = 0; r < 3; r++) {
    for (let f = 0; f < 8; f++) {
      if ((r + f) % 2 === 1) board[idx(f, r)] = { color: "R", rank: "man" };
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if ((r + f) % 2 === 1) board[idx(f, r)] = { color: "B", rank: "man" };
    }
  }
  return {
    board,
    turn: "R",
    chainFrom: null,
    quiet: 0,
    status: "playing",
    winner: null,
    moves: 0,
  };
}

function dirsFor(p: CheckerPiece): Array<[number, number]> {
  return p.rank === "king" ? KING_DIRS : DIRS[p.color];
}

/** All capture landing squares for the piece at `from`. */
export function checkerCaptures(
  board: CheckerSquare[],
  from: number,
): number[] {
  const p = board[from];
  if (!p) return [];
  const out: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);
  for (const [df, dr] of dirsFor(p)) {
    const mf = f + df;
    const mr = r + dr;
    const lf = f + 2 * df;
    const lr = r + 2 * dr;
    if (!onBoard(lf, lr)) continue;
    const mid = board[idx(mf, mr)];
    if (mid && mid.color !== p.color && board[idx(lf, lr)] === null) {
      out.push(idx(lf, lr));
    }
  }
  return out;
}

/** All quiet landing squares for the piece at `from`. */
export function checkerQuiets(board: CheckerSquare[], from: number): number[] {
  const p = board[from];
  if (!p) return [];
  const out: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);
  for (const [df, dr] of dirsFor(p)) {
    const tf = f + df;
    const tr = r + dr;
    if (onBoard(tf, tr) && board[idx(tf, tr)] === null) {
      out.push(idx(tf, tr));
    }
  }
  return out;
}

/** Any capture available to `color` anywhere? (drives must-capture). */
export function checkerHasCapture(
  board: CheckerSquare[],
  color: CheckerColor,
): boolean {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && checkerCaptures(board, i).length > 0) {
      return true;
    }
  }
  return false;
}

/** All legal destinations for the piece at `from` (captures preferred). */
export function checkerMovesFor(
  board: CheckerSquare[],
  from: number,
): number[] {
  const caps = checkerCaptures(board, from);
  return caps.length > 0 ? caps : checkerQuiets(board, from);
}

function anyLegalMove(board: CheckerSquare[], color: CheckerColor): boolean {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && checkerMovesFor(board, i).length > 0) {
      return true;
    }
  }
  return false;
}

function countPieces(board: CheckerSquare[], color: CheckerColor): number {
  return board.filter((p) => p?.color === color).length;
}

export interface CheckersMove {
  from: number;
  to: number;
  /** Expected turn (server checks the seat; engine double-checks). */
  by?: CheckerColor;
}

/** Apply one step (a jump or a quiet move). Chains hold the turn. */
export function applyCheckerMove(
  state: CheckerState,
  move: CheckersMove,
): { state: CheckerState } | { error: CheckerMoveError } {
  if (state.status !== "playing") return { error: "game-over" };
  if (move.from < 0 || move.from > 63 || move.to < 0 || move.to > 63) {
    return { error: "illegal-move" };
  }
  if (move.by && move.by !== state.turn) return { error: "wrong-turn" };
  const piece = state.board[move.from];
  if (!piece || piece.color !== state.turn) return { error: "no-piece" };

  const inChain = state.chainFrom !== null;
  if (inChain && move.from !== state.chainFrom) {
    return { error: "must-continue" };
  }
  const caps = checkerCaptures(state.board, move.from);
  if (
    !inChain &&
    caps.length === 0 &&
    checkerHasCapture(state.board, state.turn)
  ) {
    return { error: "must-capture" };
  }
  const legal = inChain ? caps : checkerMovesFor(state.board, move.from);
  if (!legal.includes(move.to)) return { error: "illegal-move" };

  const board = state.board.slice();
  const df = Math.abs(fileOf(move.to) - fileOf(move.from));
  const isCapture = df === 2;
  if (isCapture) {
    const mf = (fileOf(move.from) + fileOf(move.to)) / 2;
    const mr = (rankOf(move.from) + rankOf(move.to)) / 2;
    board[idx(mf, mr)] = null;
  }
  board[move.to] = piece;
  board[move.from] = null;

  // Crowning ends the move even mid-chain.
  let crowned = false;
  if (piece.rank === "man") {
    const lastRank = piece.color === "R" ? 7 : 0;
    if (rankOf(move.to) === lastRank) {
      board[move.to] = { color: piece.color, rank: "king" };
      crowned = true;
    }
  }

  const moves = state.moves + 1;
  const quiet = isCapture || crowned ? 0 : state.quiet + 1;
  const continues =
    isCapture && !crowned && checkerCaptures(board, move.to).length > 0;

  const nextTurn = state.turn === "R" ? "B" : "R";
  let status: CheckerStatus = "playing";
  let winner: CheckerColor | null = null;
  if (countPieces(board, nextTurn) === 0 || !anyLegalMove(board, nextTurn)) {
    // Opponent wiped or stuck — but only when the turn actually passes.
    if (!continues) {
      status = "win";
      winner = state.turn;
    }
  }
  if (status === "playing" && quiet >= 40) status = "draw";

  return {
    state: {
      board,
      turn: continues ? state.turn : nextTurn,
      chainFrom: continues ? move.to : null,
      quiet,
      status,
      winner,
      moves,
    },
  };
}
