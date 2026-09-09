import type { ChessMove, ChessState } from "./chess";
import type { C4Move, C4State } from "./connect4";
import type { LudoRoll, LudoState } from "./ludo";
import type { UnoMove, UnoState } from "./uno";

export type GameKind = "chess" | "connect4" | "ludo" | "uno";

/** Seat names in turn order — index 0 moves first. */
export const SEAT_NAMES = ["first", "second", "third", "fourth"] as const;
export type GameSeatName = (typeof SEAT_NAMES)[number];

export function seatName(index: number): GameSeatName {
  return SEAT_NAMES[index] ?? "first";
}

/** Classic GameSeat (chess/connect4 only). */
export type GameSeat = "first" | "second";

/** Player-count limits per kind (party games need 2+, cap at 4). */
export const GAME_LIMITS: Record<GameKind, { min: number; max: number }> = {
  chess: { min: 2, max: 2 },
  connect4: { min: 2, max: 2 },
  ludo: { min: 2, max: 4 },
  uno: { min: 2, max: 4 },
};

/** First seat moves first in both games (White in chess, Red in C4). */
export type GameStatus = "waiting" | "playing" | "finished";

export type GameResult =
  | { outcome: "win"; winner: GameSeat }
  | { outcome: "draw"; reason: string }
  | { outcome: "forfeit"; winner: GameSeat; reason: string };

export interface GameMatchMeta {
  id: string;
  kind: GameKind;
  workspaceId: string;
  status: GameStatus;
  seats: { first: string | null; second: string | null };
  result: GameResult | null;
  moveCount: number;
  updatedAt: number;
}

export type GameClientMove =
  | { kind: "chess"; move: ChessMove }
  | { kind: "connect4"; move: C4Move }
  | { kind: "ludo"; move: LudoRoll }
  | { kind: "uno"; move: UnoMove };

export type GameSnapshot =
  | { kind: "chess"; state: ChessState }
  | { kind: "connect4"; state: C4State }
  | { kind: "ludo"; state: LudoState }
  | { kind: "uno"; state: UnoState };

export type GameMoveError =
  "not-your-turn" | "not-seated" | "bad-move" | "game-over" | "unknown-match";

/** Derive the authoritative result from an engine end-state. */
export function resultFromChess(
  status: ChessState["status"],
  winner: ChessState["winner"],
): GameResult | null {
  if (status === "playing") return null;
  if (status === "checkmate" && winner) {
    return { outcome: "win", winner: winner === "w" ? "first" : "second" };
  }
  const reason =
    status === "stalemate"
      ? "stalemate"
      : status === "draw-50"
        ? "fifty-move rule"
        : "insufficient material";
  return { outcome: "draw", reason };
}

export function resultFromC4(state: C4State): GameResult | null {
  if (state.status === "playing") return null;
  if (state.status === "win" && state.winner) {
    return {
      outcome: "win",
      winner: state.winner === "R" ? "first" : "second",
    };
  }
  return { outcome: "draw", reason: "board full" };
}

/** Party-game result: winner is a seat index into the match's seat order. */
export type PartyGameResult = { outcome: "win"; winner: number } | null;

export function resultFromLudo(state: LudoState): PartyGameResult {
  if (state.status !== "win" || state.winner === null) return null;
  return { outcome: "win", winner: state.winner };
}

export function resultFromUno(state: UnoState): PartyGameResult {
  if (state.status !== "win" || state.winner === null) return null;
  return { outcome: "win", winner: state.winner };
}
