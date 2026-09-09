// ============================================================================
// LUDO — 2–4 seats, four tokens each, classic rules.
// Loop of 28 shared cells + 4-cell home stretch per seat. Roll 6 to leave
// base, exact roll to finish, roll-6 rolls again (three 6s in a row forfeits
// the turn), landing on a lone opponent (off safe cells and blockades)
// sends it home. All four tokens home wins.
//
// Two seats sit diagonally (yards 0 + 2). Seats map to classic yard colors:
// green, yellow, blue, red.
//
// Flow is two-step and server-driven: `rollLudo` produces a dice value plus
// the movable token options; `applyLudoToken` moves the chosen token. The
// dice value lives in `pendingRoll` between the steps.
// ============================================================================

export const LUDO_LOOP = 28;
export const LUDO_STRETCH = 4;
export const LUDO_HOME = LUDO_LOOP + LUDO_STRETCH; // progress value when finished
export const LUDO_BASE = -1;
export const LUDO_TOKENS = 4;

/** Shared-loop cells where captures never happen (the four start cells). */
export const LUDO_SAFE = [0, 7, 14, 21];

/** Classic yard colors: green, yellow, blue, red. */
export const LUDO_YARD_COLORS = ["#16a34a", "#eab308", "#2563eb", "#dc2626"];
export const LUDO_YARD_DARK = ["#166534", "#a16207", "#1e40af", "#991b1b"];
export const LUDO_YARD_LIGHT = ["#bbf7d0", "#fef08a", "#bfdbfe", "#fecaca"];

/** Classic-path start cells by yard (52-cell ring). */
export const LUDO_CLASSIC_START = [0, 13, 26, 39];

/**
 * Yard index for a seat — two players sit diagonally (yards 0 + 2),
 * three take the first three corners, four fill the board.
 */
export function ludoYard(seats: number, seat: number): number {
  if (seats === 2) return seat === 0 ? 0 : 2;
  return seat;
}

/** Classic-path start cell for a seat. */
export function ludoClassicStart(seats: number, seat: number): number {
  return LUDO_CLASSIC_START[ludoYard(seats, seat)]!;
}

/**
 * Loop offset for a seat on the 28-cell ring. Two players start opposite,
 * three split thirds, four split quarters.
 */
export function ludoStartOffset(seats: number, seat: number): number {
  if (seats === 2) return seat === 0 ? 0 : 14;
  if (seats === 3) return [0, 9, 18][seat]!;
  return seat * (LUDO_LOOP / 4);
}

export type LudoStatus = "playing" | "win";

export interface LudoState {
  seats: number;
  /**
   * Progress per seat per token: -1 base, 0..27 loop, 28..31 stretch,
   * 32 home.
   */
  tokens: number[][];
  turn: number;
  lastRoll: number | null;
  /** Dice value awaiting a token pick (null outside a pick). */
  pendingRoll: number | null;
  /** Consecutive sixes this turn (three forfeits). */
  sixes: number;
  status: LudoStatus;
  winner: number | null;
  moves: number;
}

export type LudoMoveError =
  | "bad-seat"
  | "wrong-turn"
  | "bad-roll"
  | "bad-token"
  | "no-roll"
  | "has-rolled"
  | "game-over";

export type LudoEvent =
  | "exit-base"
  | "capture"
  | "extra-turn"
  | "forfeit-sixes"
  | "no-move"
  | "home"
  | "win";

export function initialLudoState(seats: number): LudoState {
  if (!Number.isInteger(seats) || seats < 2 || seats > 4) {
    throw new Error(`Ludo needs 2–4 seats, got ${seats}`);
  }
  return {
    seats,
    tokens: Array.from({ length: seats }, () =>
      Array(LUDO_TOKENS).fill(LUDO_BASE),
    ),
    turn: 0,
    lastRoll: null,
    pendingRoll: null,
    sixes: 0,
    status: "playing",
    winner: null,
    moves: 0,
  };
}

/** Shared-loop cell for a seat at a loop progress (0..27). */
export function ludoLoopCell(
  seat: number,
  seats: number,
  progress: number,
): number {
  return (
    (((ludoStartOffset(seats, seat) + progress) % LUDO_LOOP) + LUDO_LOOP) %
    LUDO_LOOP
  );
}

export function rollLudoDice(rand: () => number = Math.random): number {
  return 1 + Math.floor(rand() * 6);
}

/** Can token `t` of `seat` legally move under the pending roll? */
export function ludoMovable(state: LudoState, seat: number): number[] {
  if (state.status !== "playing") return [];
  if (state.pendingRoll === null) return [];
  const roll = state.pendingRoll;
  const out: number[] = [];
  state.tokens[seat]!.forEach((pos, t) => {
    if (pos === LUDO_BASE) {
      if (roll === 6) out.push(t);
    } else if (pos < LUDO_HOME && pos + roll <= LUDO_HOME) {
      out.push(t);
    }
  });
  return out;
}

export interface LudoRoll {
  seat: number;
  roll: number;
}

export interface LudoTokenMove {
  seat: number;
  token: number;
}

/**
 * Step 1: roll the dice. Returns the value, the movable token options, and
 * UI events. No options (or three sixes) passes the turn immediately.
 */
export function rollLudo(
  state: LudoState,
  move: LudoRoll,
): { state: LudoState; events: LudoEvent[] } | { error: LudoMoveError } {
  if (state.status !== "playing") return { error: "game-over" };
  if (move.seat < 0 || move.seat >= state.seats) return { error: "bad-seat" };
  if (move.seat !== state.turn) return { error: "wrong-turn" };
  if (state.pendingRoll !== null) return { error: "has-rolled" };
  if (!Number.isInteger(move.roll) || move.roll < 1 || move.roll > 6) {
    return { error: "bad-roll" };
  }

  const sixes = move.roll === 6 ? state.sixes + 1 : 0;
  // Three sixes in a row: turn forfeited, no move.
  if (sixes >= 3) {
    return {
      state: {
        ...state,
        lastRoll: move.roll,
        pendingRoll: null,
        sixes: 0,
        turn: (state.turn + 1) % state.seats,
        moves: state.moves + 1,
      },
      events: ["forfeit-sixes"],
    };
  }

  const withRoll: LudoState = {
    ...state,
    lastRoll: move.roll,
    pendingRoll: move.roll,
    sixes,
  };
  if (ludoMovable(withRoll, move.seat).length === 0) {
    return {
      state: {
        ...withRoll,
        pendingRoll: null,
        sixes: 0,
        turn: (state.turn + 1) % state.seats,
        moves: state.moves + 1,
      },
      events: ["no-move"],
    };
  }
  return {
    state: { ...withRoll, moves: state.moves + 1 },
    events: [],
  };
}

/**
 * Step 2: move the chosen token under the pending roll.
 */
export function applyLudoToken(
  state: LudoState,
  move: LudoTokenMove,
): { state: LudoState; events: LudoEvent[] } | { error: LudoMoveError } {
  if (state.status !== "playing") return { error: "game-over" };
  if (move.seat < 0 || move.seat >= state.seats) return { error: "bad-seat" };
  if (move.seat !== state.turn) return { error: "wrong-turn" };
  if (state.pendingRoll === null) return { error: "no-roll" };
  const roll = state.pendingRoll;
  if (
    move.token < 0 ||
    move.token >= LUDO_TOKENS ||
    !ludoMovable(state, move.seat).includes(move.token)
  ) {
    return { error: "bad-token" };
  }

  const events: LudoEvent[] = [];
  const tokens = state.tokens.map((row) => row.slice());
  const pos = tokens[move.seat]![move.token]!;

  if (pos === LUDO_BASE) {
    tokens[move.seat]![move.token] = 0;
    events.push("exit-base");
    captureOn(tokens, state.seats, move.seat, 0, events);
  } else {
    const next = pos + roll;
    tokens[move.seat]![move.token] = next;
    if (next === LUDO_HOME) {
      events.push("home");
    } else if (next < LUDO_LOOP) {
      captureOn(tokens, state.seats, move.seat, next, events);
    }
  }

  const won = tokens[move.seat]!.every((t) => t === LUDO_HOME);
  if (won) events.push("win");
  const extraTurn = roll === 6 && !won;
  if (extraTurn) events.push("extra-turn");
  return {
    state: {
      seats: state.seats,
      tokens,
      turn: won
        ? state.turn
        : extraTurn
          ? state.turn
          : (state.turn + 1) % state.seats,
      lastRoll: roll,
      pendingRoll: null,
      sixes: extraTurn ? state.sixes : 0,
      status: won ? "win" : "playing",
      winner: won ? move.seat : null,
      moves: state.moves + 1,
    },
    events,
  };
}

/**
 * Send lone opponents sharing `mover`'s loop cell back to base — unless the
 * cell is safe or the victim holds it with 2+ tokens (blockade, goti cover).
 */
function captureOn(
  tokens: number[][],
  seats: number,
  mover: number,
  progress: number,
  events: LudoEvent[],
): void {
  const cell = ludoLoopCell(mover, seats, progress);
  if (LUDO_SAFE.includes(cell)) return;
  let captured = false;
  for (let s = 0; s < seats; s++) {
    if (s === mover) continue;
    const holders = tokens[s]!.map((p, t) => ({ p, t })).filter(
      ({ p }) => p >= 0 && p < LUDO_LOOP && ludoLoopCell(s, seats, p) === cell,
    );
    if (holders.length === 1) {
      tokens[s]![holders[0]!.t] = LUDO_BASE;
      captured = true;
    }
    // 2+ holders: blockade — the cell holds, no capture (goti cover).
  }
  if (captured) events.push("capture");
}
