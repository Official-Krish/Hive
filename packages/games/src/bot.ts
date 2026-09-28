import {
  applyC4Move,
  c4LegalColumns,
  type C4Disc,
  type C4State,
} from "./connect4";
import { applyLudoToken, ludoMovable, type LudoState } from "./ludo";
import {
  UNO_COLORS,
  unoPlayableIndices,
  type UnoCard,
  type UnoColor,
  type UnoState,
} from "./uno";

/** Sentinel the client sends as opponentId; the backend swaps in the bot. */
export const ARCADE_BOT_SENTINEL = "arcade-bot";
export const ARCADE_BOT_EMAIL = "arcade-bot@hive.local";
export const ARCADE_BOT_NAME = "Arcade Bot";

/** Center-first preference when nothing wins or blocks. */
const CENTER_FIRST = [3, 2, 4, 1, 5, 0, 6];

/**
 * Arcade Bot's Connect 4 brain: take a win, block a loss, otherwise take
 * the most central open column. Pure and total — safe to call anywhere.
 * Returns null when the board accepts nothing.
 */
export function chooseC4Column(state: C4State): number | null {
  if (state.status !== "playing") return null;
  const turn: C4Disc = state.turn;
  const legal = c4LegalColumns(state);
  if (legal.length === 0) return null;

  // 1. Take the win.
  for (const col of legal) {
    const tried = applyC4Move(state, { col, by: turn });
    if (!("error" in tried) && tried.state.status === "win") return col;
  }
  // 2. Block the opponent's immediate win.
  const opp: C4Disc = turn === "R" ? "Y" : "R";
  const oppState: C4State = { ...state, turn: opp };
  for (const col of legal) {
    const tried = applyC4Move(oppState, { col, by: opp });
    if (!("error" in tried) && tried.state.status === "win") return col;
  }
  // 3. Central preference.
  for (const col of CENTER_FIRST) {
    if (legal.includes(col)) return col;
  }
  return null;
}

export type LudoBotMove = { roll: true } | { token: number };

/**
 * Arcade Bot's Ludo brain: roll when no pending roll, otherwise move the
 * best token — captures first, then home finishes, base exits, then the
 * furthest token. Returns null when there is nothing to pick (the engine
 * auto-passes on roll in that case).
 */
export function chooseLudoMove(
  state: LudoState,
  seat: number,
): LudoBotMove | null {
  if (state.status !== "playing" || state.turn !== seat) return null;
  if (state.pendingRoll == null) return { roll: true };
  const movables = ludoMovable(state, seat);
  if (movables.length === 0) return null;
  let best = movables[0]!;
  let bestScore = -1;
  for (const t of movables) {
    const tried = applyLudoToken(state, { seat, token: t });
    if ("error" in tried) continue;
    const events = tried.events;
    const progress = tried.state.tokens[seat]?.[t] ?? 0;
    const score = events.includes("win")
      ? 100
      : events.includes("capture")
        ? 50
        : events.includes("home")
          ? 30
          : events.includes("exit-base")
            ? 20
            : 10 + Math.max(0, progress);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return { token: best };
}

export type UnoBotMove =
  { play: number; wildColor?: UnoColor } | { draw: true };

function bestWildColor(state: UnoState, seat: number): UnoColor {
  const counts = new Map<UnoColor, number>();
  for (const c of state.hands[seat] ?? []) {
    if (c.color) counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
  }
  let best: UnoColor = "R";
  let bestCount = -1;
  for (const color of UNO_COLORS) {
    const n = counts.get(color) ?? 0;
    if (n > bestCount) {
      bestCount = n;
      best = color;
    }
  }
  return best;
}

/**
 * Arcade Bot's Uno brain: play the strongest playable card (action cards
 * first, numbers next, wilds last), declaring its most-held color on a
 * wild — otherwise draw. Returns null when it is not this seat's turn.
 */
export function chooseUnoMove(
  state: UnoState,
  seat: number,
): UnoBotMove | null {
  if (state.status !== "playing" || state.turn !== seat) return null;
  const playable = unoPlayableIndices(state, seat);
  if (playable.length === 0) return { draw: true };
  const cardAt = (i: number): UnoCard => state.hands[seat]![i]!;
  const strength = (c: UnoCard): number =>
    c.rank === "W" || c.rank === "F"
      ? 0
      : c.rank === "S" || c.rank === "T"
        ? 2
        : 1;
  const ordered = [...playable].sort(
    (a, b) => strength(cardAt(b)) - strength(cardAt(a)),
  );
  const pick = ordered[0]!;
  const card = cardAt(pick);
  if (card.rank === "W" || card.rank === "F") {
    return { play: pick, wildColor: bestWildColor(state, seat) };
  }
  return { play: pick };
}
