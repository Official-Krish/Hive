export type ChessColor = "w" | "b";
export type ChessPieceType = "p" | "n" | "b" | "r" | "q" | "k";

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessColor;
}

export type ChessSquare = ChessPiece | null;

export type ChessStatus =
  "playing" | "checkmate" | "stalemate" | "draw-50" | "draw-material";

export interface ChessCastling {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface ChessState {
  board: ChessSquare[];
  turn: ChessColor;
  castling: ChessCastling;
  /** Square index behind a just-double-pushed pawn (en passant target). */
  enPassant: number | null;
  halfmove: number;
  fullmove: number;
  status: ChessStatus;
  winner: ChessColor | null;
}

export interface ChessMove {
  from: number;
  to: number;
  /** Required when a pawn reaches the last rank (n | b | r | q). */
  promote?: ChessPieceType;
}

export type ChessMoveError =
  | "no-piece"
  | "wrong-turn"
  | "illegal-move"
  | "promotion-required"
  | "invalid-promotion"
  | "game-over";

const opp = (c: ChessColor): ChessColor => (c === "w" ? "b" : "w");
const fileOf = (i: number): number => i % 8;
const rankOf = (i: number): number => Math.floor(i / 8);
const at = (
  board: ChessSquare[],
  f: number,
  r: number,
): ChessSquare | undefined =>
  f < 0 || f > 7 || r < 0 || r > 7 ? undefined : board[r * 8 + f];

/** "e4" <-> 28 helpers (for tests, logs, and protocol debugging). */
export function squareName(i: number): string {
  return `${"abcdefgh"[fileOf(i)]}${rankOf(i) + 1}`;
}

export function squareIndex(name: string): number {
  const f = "abcdefgh".indexOf(name[0]!.toLowerCase());
  const r = parseInt(name[1]!, 10) - 1;
  if (f < 0 || r < 0 || r > 7 || name.length !== 2) {
    throw new Error(`Bad square: ${name}`);
  }
  return r * 8 + f;
}

export function initialChessState(): ChessState {
  const back: ChessPieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board: ChessSquare[] = Array(64).fill(null);
  for (let f = 0; f < 8; f++) {
    board[f] = { type: back[f]!, color: "w" };
    board[8 + f] = { type: "p", color: "w" };
    board[48 + f] = { type: "p", color: "b" };
    board[56 + f] = { type: back[f]!, color: "b" };
  }
  return {
    board,
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    status: "playing",
    winner: null,
  };
}

// --- Attack detection ---------------------------------------------------------

const KNIGHT_D = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;
const KING_D = [
  [1, 1],
  [1, 0],
  [1, -1],
  [0, 1],
  [0, -1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const;
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const STRAIGHT = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** True when square `sq` is attacked by color `by`. */
export function isAttacked(
  board: ChessSquare[],
  sq: number,
  by: ChessColor,
): boolean {
  const f = fileOf(sq);
  const r = rankOf(sq);
  // pawns
  const pr = by === "w" ? r - 1 : r + 1;
  for (const df of [-1, 1]) {
    const p = at(board, f + df, pr);
    if (p?.type === "p" && p.color === by) return true;
  }
  // knights
  for (const [df, dr] of KNIGHT_D) {
    const p = at(board, f + df, r + dr);
    if (p?.type === "n" && p.color === by) return true;
  }
  // king
  for (const [df, dr] of KING_D) {
    const p = at(board, f + df, r + dr);
    if (p?.type === "k" && p.color === by) return true;
  }
  // sliders
  const ray = (
    dirs: readonly (readonly [number, number])[],
    types: ChessPieceType[],
  ): boolean => {
    for (const [df, dr] of dirs) {
      let cf = f + df;
      let cr = r + dr;
      while (cf >= 0 && cf < 8 && cr >= 0 && cr < 8) {
        const p = board[cr * 8 + cf]!;
        if (p) {
          // First piece on this ray decides it — then move to the next ray.
          if (p.color === by && types.includes(p.type)) return true;
          break;
        }
        cf += df;
        cr += dr;
      }
    }
    return false;
  };
  return ray(DIAG, ["b", "q"]) || ray(STRAIGHT, ["r", "q"]);
}

function kingSquare(board: ChessSquare[], color: ChessColor): number {
  const i = board.findIndex((p) => p?.type === "k" && p.color === color);
  if (i < 0) throw new Error(`No ${color} king on board`);
  return i;
}

// --- Move generation (pseudo-legal, then filtered by king safety) -------------

interface PseudoMove {
  from: number;
  to: number;
  /** Double pawn push (sets en passant square). */
  double?: boolean;
  /** En passant capture: remove pawn at this square. */
  epCapture?: number;
  /** Castling rook movement [from, to]. */
  castle?: [number, number];
}

function pseudoMoves(state: ChessState, sq: number): PseudoMove[] {
  const { board, turn, castling, enPassant } = state;
  const piece = board[sq];
  if (!piece || piece.color !== turn) return [];
  const f = fileOf(sq);
  const r = rankOf(sq);
  const out: PseudoMove[] = [];
  const slide = (dirs: readonly (readonly [number, number])[]) => {
    for (const [df, dr] of dirs) {
      let cf = f + df;
      let cr = r + dr;
      while (cf >= 0 && cf < 8 && cr >= 0 && cr < 8) {
        const t = cr * 8 + cf;
        const target = board[t]!;
        if (!target) {
          out.push({ from: sq, to: t });
        } else {
          if (target.color !== turn) out.push({ from: sq, to: t });
          break;
        }
        cf += df;
        cr += dr;
      }
    }
  };

  switch (piece.type) {
    case "n":
      for (const [df, dr] of KNIGHT_D) {
        const cf = f + df;
        const cr = r + dr;
        if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue;
        const t = cr * 8 + cf;
        const target = board[t]!;
        if (!target || target.color !== turn) out.push({ from: sq, to: t });
      }
      break;
    case "b":
      slide(DIAG);
      break;
    case "r":
      slide(STRAIGHT);
      break;
    case "q":
      slide(DIAG);
      slide(STRAIGHT);
      break;
    case "k": {
      for (const [df, dr] of KING_D) {
        const cf = f + df;
        const cr = r + dr;
        if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue;
        const t = cr * 8 + cf;
        const target = board[t]!;
        if (!target || target.color !== turn) out.push({ from: sq, to: t });
      }
      // castling: king + rook unmoved, squares empty, king not in/through check
      const home = turn === "w" ? 0 : 7;
      if (r === home && f === 4) {
        const rights =
          turn === "w"
            ? [castling.wK, castling.wQ]
            : [castling.bK, castling.bQ];
        const enemy = opp(turn);
        if (rights[0] && !board[home * 8 + 5] && !board[home * 8 + 6]) {
          const rook = board[home * 8 + 7];
          if (
            rook?.type === "r" &&
            rook.color === turn &&
            !isAttacked(board, sq, enemy) &&
            !isAttacked(board, home * 8 + 5, enemy) &&
            !isAttacked(board, home * 8 + 6, enemy)
          ) {
            out.push({
              from: sq,
              to: home * 8 + 6,
              castle: [home * 8 + 7, home * 8 + 5],
            });
          }
        }
        if (rights[1] && !board[home * 8 + 3] && !board[home * 8 + 2]) {
          const rook = board[home * 8 + 0];
          if (
            rook?.type === "r" &&
            rook.color === turn &&
            !isAttacked(board, sq, enemy) &&
            !isAttacked(board, home * 8 + 3, enemy) &&
            !isAttacked(board, home * 8 + 2, enemy)
          ) {
            out.push({
              from: sq,
              to: home * 8 + 2,
              castle: [home * 8 + 0, home * 8 + 3],
            });
          }
        }
      }
      break;
    }
    case "p": {
      const dir = turn === "w" ? 1 : -1;
      const start = turn === "w" ? 1 : 6;
      const one = at(board, f, r + dir);
      if (one === null) {
        out.push({ from: sq, to: (r + dir) * 8 + f });
        if (r === start && at(board, f, r + 2 * dir) === null) {
          out.push({ from: sq, to: (r + 2 * dir) * 8 + f, double: true });
        }
      }
      for (const df of [-1, 1]) {
        const cf = f + df;
        const cr = r + dir;
        if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue;
        const t = cr * 8 + cf;
        const target = board[t]!;
        if (target && target.color !== turn) {
          out.push({ from: sq, to: t });
        } else if (!target && enPassant === t) {
          out.push({ from: sq, to: t, epCapture: r * 8 + cf });
        }
      }
      break;
    }
  }
  return out;
}

/** Apply a pseudo-move to a board copy (no legality checks, no status update). */
function makeMove(
  board: ChessSquare[],
  pm: PseudoMove,
  promote?: ChessPieceType,
): void {
  const piece = board[pm.from]!;
  board[pm.to] = piece;
  board[pm.from] = null;
  if (pm.epCapture !== undefined) board[pm.epCapture] = null;
  if (pm.castle) {
    const [rf, rt] = pm.castle;
    board[rt] = board[rf]!;
    board[rf] = null;
  }
  const lastRank = piece.color === "w" ? 7 : 0;
  if (piece.type === "p" && rankOf(pm.to) === lastRank && promote) {
    board[pm.to] = { type: promote, color: piece.color };
  }
}

/** All fully-legal moves for `color` (king-safety filtered). */
export function allLegalMoves(
  state: ChessState,
  color?: ChessColor,
): ChessMove[] {
  const side = color ?? state.turn;
  const out: ChessMove[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq];
    if (!p || p.color !== side) continue;
    // generate as `side` to move regardless of state's turn
    const asTurn: ChessState =
      side === state.turn ? state : { ...state, turn: side };
    for (const pm of pseudoMoves(asTurn, sq)) {
      const copy = state.board.slice();
      makeMove(copy, pm, "q");
      let ks: number;
      try {
        ks = kingSquare(copy, side);
      } catch {
        continue;
      }
      if (isAttacked(copy, ks, opp(side))) continue;
      const lastRank = side === "w" ? 7 : 0;
      if (p.type === "p" && rankOf(pm.to) === lastRank) {
        for (const promote of ["n", "b", "r", "q"] as const) {
          out.push({ from: sq, to: pm.to, promote });
        }
      } else {
        out.push({ from: sq, to: pm.to });
      }
    }
  }
  return out;
}

/** Legal destinations for one square (for UI hints). */
export function legalMoves(state: ChessState, sq: number): ChessMove[] {
  const piece = state.board[sq];
  if (!piece || piece.color !== state.turn) return [];
  const all = allLegalMoves(state, state.turn);
  return all.filter((m) => m.from === sq);
}

// --- Status -------------------------------------------------------------------

function insufficientMaterial(board: ChessSquare[]): boolean {
  const pieces = board.filter((p): p is ChessPiece => !!p && p.type !== "k");
  if (pieces.length === 0) return true; // bare kings
  if (
    pieces.length === 1 &&
    (pieces[0]!.type === "b" || pieces[0]!.type === "n")
  ) {
    return true; // king + single minor vs bare king
  }
  return false;
}

/** Position key for threefold-repetition counting (managed by the match layer). */
export function positionKey(state: ChessState): string {
  const b = state.board.map((p) => (p ? `${p.color}${p.type}` : "..")).join("");
  const c =
    `${state.castling.wK ? "K" : ""}${state.castling.wQ ? "Q" : ""}${state.castling.bK ? "k" : ""}${state.castling.bQ ? "q" : ""}` ||
    "-";
  return `${b} ${state.turn} ${c} ${state.enPassant ?? "-"}`;
}

/**
 * Apply a move. Returns the new state, or an `error` (state unchanged).
 * Promotion choice is required when a pawn reaches the last rank.
 */
export function applyMove(
  state: ChessState,
  move: ChessMove,
): { state: ChessState } | { error: ChessMoveError } {
  if (state.status !== "playing") return { error: "game-over" };
  const piece = state.board[move.from];
  if (!piece) return { error: "no-piece" };
  if (piece.color !== state.turn) return { error: "wrong-turn" };

  const lastRank = state.turn === "w" ? 7 : 0;
  const isPromo = piece.type === "p" && rankOf(move.to) === lastRank;
  if (isPromo && !move.promote) return { error: "promotion-required" };
  if (move.promote && !["n", "b", "r", "q"].includes(move.promote)) {
    return { error: "invalid-promotion" };
  }
  if (move.promote && !isPromo) return { error: "invalid-promotion" };

  const legal = allLegalMoves(state, state.turn).some(
    (m) =>
      m.from === move.from &&
      m.to === move.to &&
      (m.promote ?? null) === (move.promote ?? null),
  );
  if (!legal) return { error: "illegal-move" };

  const board = state.board.slice();
  const pm: PseudoMove = { from: move.from, to: move.to };
  // re-derive flags for the chosen move (double push / en passant / castle)
  const f = fileOf(move.from);
  const r = rankOf(move.from);
  const tf = fileOf(move.to);
  const tr = rankOf(move.to);
  if (piece.type === "p") {
    if (Math.abs(tr - r) === 2) pm.double = true;
    if (state.enPassant === move.to && !board[move.to]) {
      pm.epCapture = r * 8 + tf;
    }
  }
  if (piece.type === "k" && Math.abs(tf - f) === 2) {
    const home = state.turn === "w" ? 0 : 7;
    pm.castle =
      tf > f ? [home * 8 + 7, home * 8 + 5] : [home * 8 + 0, home * 8 + 3];
  }
  const captured =
    board[move.to] || (pm.epCapture !== undefined ? board[pm.epCapture] : null);
  makeMove(board, pm, move.promote);

  // castling rights decay
  const castling = { ...state.castling };
  if (piece.type === "k") {
    if (state.turn === "w") {
      castling.wK = false;
      castling.wQ = false;
    } else {
      castling.bK = false;
      castling.bQ = false;
    }
  }
  const touch = (sq: number, key: keyof ChessCastling) => {
    if (move.from === sq || move.to === sq) castling[key] = false;
  };
  touch(0, "wQ");
  touch(7, "wK");
  touch(56, "bQ");
  touch(63, "bK");
  // Note: a rook captured on its home square is covered by `touch` above.

  const next: ChessState = {
    board,
    turn: opp(state.turn),
    castling,
    enPassant: pm.double ? ((r + tr) / 2) * 8 + f : null,
    halfmove: piece.type === "p" || captured ? 0 : state.halfmove + 1,
    fullmove: state.fullmove + (state.turn === "b" ? 1 : 0),
    status: "playing",
    winner: null,
  };

  if (next.halfmove >= 100) {
    next.status = "draw-50";
  } else if (insufficientMaterial(board)) {
    next.status = "draw-material";
  } else {
    const enemyMoves = allLegalMoves(next, next.turn);
    if (enemyMoves.length === 0) {
      let ks = -1;
      try {
        ks = kingSquare(board, next.turn);
      } catch {
        /* no king — treated as stalemate below */
      }
      if (ks >= 0 && isAttacked(board, ks, state.turn)) {
        next.status = "checkmate";
        next.winner = state.turn;
      } else {
        next.status = "stalemate";
      }
    }
  }
  return { state: next };
}

/** True when `color` is currently in check. */
export function inCheck(state: ChessState, color?: ChessColor): boolean {
  const side = color ?? state.turn;
  try {
    return isAttacked(state.board, kingSquare(state.board, side), opp(side));
  } catch {
    return false;
  }
}
