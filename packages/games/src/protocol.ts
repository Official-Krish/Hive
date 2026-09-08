import type { ChessMove, ChessState } from "./chess";
import type { C4Move, C4State } from "./connect4";

export type GameKind = "chess" | "connect4";

export type GameSeat = "first" | "second";

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
  { kind: "chess"; move: ChessMove } | { kind: "connect4"; move: C4Move };

export type GameSnapshot =
  { kind: "chess"; state: ChessState } | { kind: "connect4"; state: C4State };

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
