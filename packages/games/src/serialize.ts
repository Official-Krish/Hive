// ============================================================================
// SERIALIZE — FEN for chess, compact strings for Connect 4.
// The backend stores these in Postgres and broadcasts them over WS; both
// sides rehydrate with the rules engines, so validation always agrees.
// ============================================================================

import {
  initialChessState,
  type ChessPiece,
  type ChessPieceType,
  type ChessState,
} from "./chess";
import { initialC4State, type C4Cell, type C4State } from "./connect4";

/** Full state → Forsyth–Edwards Notation (status/winner travel separately). */
export function chessToFen(state: ChessState): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = state.board[r * 8 + f]!;
      if (!p) {
        empty++;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      row += p.color === "w" ? p.type.toUpperCase() : p.type;
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  const c = state.castling;
  const castling =
    `${c.wK ? "K" : ""}${c.wQ ? "Q" : ""}${c.bK ? "k" : ""}${c.bQ ? "q" : ""}` ||
    "-";
  const ep =
    state.enPassant === null
      ? "-"
      : `${"abcdefgh"[state.enPassant % 8]}${Math.floor(state.enPassant / 8) + 1}`;
  return `${rows.join("/")} ${state.turn} ${castling} ${ep} ${state.halfmove} ${state.fullmove}`;
}

/** FEN → state (status reset to playing/winner null — set by the caller). */
export function chessFromFen(fen: string): ChessState {
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) throw new Error(`Bad FEN: ${fen}`);
  const [placement, turn, castling, ep, half, full] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new Error(`Bad FEN ranks: ${fen}`);
  const board: (ChessPiece | null)[] = Array(64).fill(null);
  const valid: Record<string, ChessPieceType> = {
    p: "p",
    n: "n",
    b: "b",
    r: "r",
    q: "q",
    k: "k",
  };
  ranks.forEach((rank, ri) => {
    const r = 7 - ri;
    let f = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        f += parseInt(ch, 10);
      } else {
        const type = valid[ch.toLowerCase()];
        if (!type || f > 7) throw new Error(`Bad FEN piece: ${fen}`);
        board[r * 8 + f] = {
          type,
          color: ch === ch.toUpperCase() ? "w" : "b",
        };
        f++;
      }
    }
    if (f !== 8) throw new Error(`Bad FEN rank width: ${fen}`);
  });
  if (turn !== "w" && turn !== "b") throw new Error(`Bad FEN turn: ${fen}`);
  for (const ch of castling) {
    if (!"KQkq-".includes(ch)) throw new Error(`Bad FEN castling: ${fen}`);
  }
  let enPassant: number | null = null;
  if (ep !== "-") {
    if (!/^[a-h][36]$/.test(ep)) throw new Error(`Bad FEN en passant: ${fen}`);
    enPassant = "abcdefgh".indexOf(ep[0]!) + (parseInt(ep[1]!, 10) - 1) * 8;
  }
  const halfmove = parseInt(half, 10);
  const fullmove = parseInt(full, 10);
  if (!Number.isInteger(halfmove) || halfmove < 0) {
    throw new Error(`Bad FEN halfmove: ${fen}`);
  }
  if (!Number.isInteger(fullmove) || fullmove < 1) {
    throw new Error(`Bad FEN fullmove: ${fen}`);
  }
  const base = initialChessState();
  return {
    ...base,
    board,
    turn,
    castling: {
      wK: castling.includes("K"),
      wQ: castling.includes("Q"),
      bK: castling.includes("k"),
      bQ: castling.includes("q"),
    },
    enPassant,
    halfmove,
    fullmove,
  };
}

/** C4 grid → 42-char string, top row first (`.` empty). */
export function c4ToString(state: C4State): string {
  let out = "";
  for (let r = 5; r >= 0; r--) {
    for (let c = 0; c < 7; c++) {
      out += state.cells[c]![r] ?? ".";
    }
  }
  return out;
}

/** 42-char string → cell grid (turn/status set by the caller). */
export function c4CellsFromString(s: string): C4Cell[][] {
  if (!/^[.RY]{42}$/.test(s)) throw new Error(`Bad C4 string: ${s}`);
  const cells: C4Cell[][] = Array.from({ length: 7 }, () =>
    Array<C4Cell>(6).fill(null),
  );
  for (let r = 5; r >= 0; r--) {
    for (let c = 0; c < 7; c++) {
      const ch = s[(5 - r) * 7 + c]!;
      cells[c]![r] = ch === "." ? null : (ch as "R" | "Y");
    }
  }
  // gravity check: no floating discs
  for (let c = 0; c < 7; c++) {
    let seenEmpty = false;
    for (let r = 0; r < 6; r++) {
      if (cells[c]![r] === null) seenEmpty = true;
      else if (seenEmpty) throw new Error(`Floating disc in column ${c}`);
    }
  }
  return cells;
}

export function c4StateFromString(s: string, turn: "R" | "Y"): C4State {
  const base = initialC4State();
  const cells = c4CellsFromString(s);
  const moves = cells.flat().filter((c) => c !== null).length;
  return { ...base, cells, turn, moves };
}
