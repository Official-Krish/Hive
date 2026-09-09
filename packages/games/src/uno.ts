export const UNO_COLORS = ["R", "Y", "G", "B"] as const;
export type UnoColor = (typeof UNO_COLORS)[number];
/** 0–5 numbers, S skip, T draw-two, W wild, F wild draw-four. */
export type UnoRank = "0" | "1" | "2" | "3" | "4" | "5" | "S" | "T" | "W" | "F";

/** Penalty drawn for getting caught on an undeclared UNO. */
export const UNO_CATCH_PENALTY = 4;

export interface UnoCard {
  /** Null for Wild. */
  color: UnoColor | null;
  rank: UnoRank;
}

export type UnoStatus = "playing" | "win";

export interface UnoState {
  seats: number;
  hands: UnoCard[][];
  /** Draw pile, top is the last element. */
  deck: UnoCard[];
  /** Discard pile, top is the last element. */
  discard: UnoCard[];
  /** Effective color (tracks Wild declarations). */
  activeColor: UnoColor;
  turn: number;
  /** Per-seat UNO declaration (meaningful while holding 1 card). */
  saidUno: boolean[];
  /** Seat sitting on 1 undeclared card — anyone else may catch them. */
  pendingUno: number | null;
  status: UnoStatus;
  winner: number | null;
  moves: number;
}

export type UnoMoveError =
  | "bad-seat"
  | "wrong-turn"
  | "bad-card"
  | "bad-play"
  | "bad-wild-color"
  | "bad-call"
  | "bad-catch"
  | "has-playable"
  | "deck-empty"
  | "game-over";

export function unoCardToString(c: UnoCard): string {
  return c.rank === "W" || c.rank === "F" ? c.rank : `${c.color}${c.rank}`;
}

export function unoCardFromString(s: string): UnoCard {
  if (s === "W") return { color: null, rank: "W" };
  if (s === "F") return { color: null, rank: "F" };
  if (/^[RYGB][0-5ST]$/.test(s)) {
    return { color: s[0] as UnoColor, rank: s.slice(1) as UnoRank };
  }
  throw new Error(`Bad Uno card: ${s}`);
}

/** Cards dealt per hand — classic 7 makes games last. */
export const UNO_DEAL = 7;

function buildDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    deck.push({ color, rank: "0" });
    for (const rank of ["1", "2", "3", "4", "5", "S", "T"] as const) {
      deck.push({ color, rank });
      deck.push({ color, rank });
    }
  }
  // Generous wilds — they keep tables lively.
  for (let i = 0; i < 6; i++) {
    deck.push({ color: null, rank: "W" });
    deck.push({ color: null, rank: "F" });
  }
  return deck;
}

export function shuffleUno<T>(
  items: T[],
  rand: () => number = Math.random,
): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function initialUnoState(
  seats: number,
  rand: () => number = Math.random,
): UnoState {
  if (!Number.isInteger(seats) || seats < 2 || seats > 4) {
    throw new Error(`Uno needs 2–4 seats, got ${seats}`);
  }
  const deck = shuffleUno(buildDeck(), rand);
  const hands: UnoCard[][] = Array.from({ length: seats }, () => []);
  for (let r = 0; r < UNO_DEAL; r++) {
    for (let s = 0; s < seats; s++) hands[s]!.push(deck.pop()!);
  }
  // Open on a number card so no effect fires on deal.
  let top = deck.pop()!;
  while (!/^[0-5]$/.test(top.rank)) {
    deck.unshift(top);
    top = deck.pop()!;
  }
  return {
    seats,
    hands,
    deck,
    discard: [top],
    activeColor: top.color!,
    turn: 0,
    saidUno: Array(seats).fill(false),
    pendingUno: null,
    status: "playing",
    winner: null,
    moves: 0,
  };
}

export function unoTop(state: UnoState): UnoCard {
  return state.discard[state.discard.length - 1]!;
}

/** Is `card` legally playable onto `top` under `activeColor`? */
export function unoPlayable(
  card: UnoCard,
  top: UnoCard,
  activeColor: UnoColor,
): boolean {
  if (card.rank === "W" || card.rank === "F") return true;
  if (card.color === activeColor) return true;
  // Onto a wild top only the live color (or another wild) plays.
  if (top.rank === "W" || top.rank === "F") return false;
  return card.rank === top.rank;
}

export function unoPlayableIndices(state: UnoState, seat: number): number[] {
  const top = unoTop(state);
  const out: number[] = [];
  state.hands[seat]!.forEach((c, i) => {
    if (unoPlayable(c, top, state.activeColor)) out.push(i);
  });
  return out;
}

export type UnoMove =
  | { seat: number; play: number; wildColor?: UnoColor }
  | { seat: number; draw: true }
  | { seat: number; callUno: true }
  | { seat: number; catch: number };

/**
 * Play a card by hand index, or draw-1 (only when nothing is playable —
 * the drawn card stays for next turn, keeping the engine to one step).
 *
 * `callUno`/`catch` are table-talk: they ignore turn order. Playing down to
 * 1 card opens a catch window (`pendingUno`); declaring first closes it,
 * getting caught draws 4. The window also closes once another seat completes
 * a play/draw.
 *
 * +2 / +4 resolve immediately (no stacking): the victim draws and is
 * skipped in the same step.
 */
export function applyUnoMove(
  state: UnoState,
  move: UnoMove,
): { state: UnoState; skipped: boolean } | { error: UnoMoveError } {
  if (state.status !== "playing") return { error: "game-over" };
  if (move.seat < 0 || move.seat >= state.seats) return { error: "bad-seat" };

  // Table-talk moves work out of turn.
  if ("callUno" in move) {
    if (
      state.hands[move.seat]!.length !== 1 ||
      state.pendingUno !== move.seat
    ) {
      return { error: "bad-call" };
    }
    const saidUno = state.saidUno.slice();
    saidUno[move.seat] = true;
    return {
      state: { ...state, saidUno, pendingUno: null, moves: state.moves + 1 },
      skipped: false,
    };
  }
  if ("catch" in move) {
    const target = move.catch;
    if (
      target === move.seat ||
      target < 0 ||
      target >= state.seats ||
      state.pendingUno !== target
    ) {
      return { error: "bad-catch" };
    }
    const drawn = drawN(state.deck, state.discard, UNO_CATCH_PENALTY);
    if (!drawn) return { error: "deck-empty" };
    const hands = state.hands.map((h) => h.slice());
    hands[target]!.push(...drawn.cards);
    const saidUno = state.saidUno.slice();
    saidUno[target] = true;
    return {
      state: {
        ...state,
        hands,
        deck: drawn.deck,
        discard: drawn.discard,
        saidUno,
        pendingUno: null,
        moves: state.moves + 1,
      },
      skipped: false,
    };
  }

  if (move.seat !== state.turn) return { error: "wrong-turn" };

  const top = unoTop(state);
  const hands = state.hands.map((h) => h.slice());
  let deck = state.deck.slice();
  const discard = state.discard.slice();
  const saidUno = state.saidUno.slice();
  const playable = unoPlayableIndices(state, move.seat);

  if ("draw" in move) {
    // Wilds never force your hand — a wild-only hand may always draw
    // (and a mixed hand may dodge playing its wild by drawing instead).
    const forced = playable.filter((i) => {
      const r = state.hands[move.seat]![i]!.rank;
      return r !== "W" && r !== "F";
    });
    if (forced.length > 0) return { error: "has-playable" };
    const refill = drawFrom(deck, discard);
    if (!refill) return { error: "deck-empty" };
    deck = refill.deck;
    hands[move.seat]!.push(refill.card);
    // Drawing grows past 1 card or lets someone else off the hook.
    if (state.pendingUno === move.seat) saidUno[move.seat] = false;
    return {
      state: {
        ...state,
        hands,
        deck,
        discard: refill.discard,
        saidUno,
        pendingUno: null,
        turn: (state.turn + 1) % state.seats,
        moves: state.moves + 1,
      },
      skipped: false,
    };
  }

  const card = hands[move.seat]![move.play];
  if (!card) return { error: "bad-card" };
  if (!unoPlayable(card, top, state.activeColor)) return { error: "bad-play" };
  if (card.rank === "W" || card.rank === "F") {
    if (!move.wildColor || !UNO_COLORS.includes(move.wildColor)) {
      return { error: "bad-wild-color" };
    }
  }
  hands[move.seat]!.splice(move.play, 1);
  discard.push(card);

  const won = hands[move.seat]!.length === 0;
  const power = card.rank === "T" ? 2 : card.rank === "F" ? 4 : 0;
  const skipped = card.rank === "S" || power > 0;
  // Victims draw immediately (no stacking); skipped on a win since the game
  // is over anyway.
  if (power > 0 && !won) {
    const victim = (move.seat + 1) % state.seats;
    const drawn = drawN(deck, discard, power);
    if (!drawn) return { error: "deck-empty" };
    deck = drawn.deck;
    // Take the reshuffled pile too — dealt cards must leave the discard,
    // otherwise they exist twice and totals drift.
    discard.length = 0;
    discard.push(...drawn.discard);
    hands[victim]!.push(...drawn.cards);
    // Growing past 1 card closes any open window on the victim.
    if (state.pendingUno === victim) {
      saidUno[victim] = false;
      state = { ...state, pendingUno: null };
    }
  }
  const advance = skipped ? 2 : 1;

  // Catch window bookkeeping.
  let pendingUno = state.pendingUno;
  if (!won && hands[move.seat]!.length === 1) {
    saidUno[move.seat] = false;
    pendingUno = move.seat;
  } else if (pendingUno !== null && pendingUno !== move.seat) {
    pendingUno = null; // someone else moved — they got away with it
  } else if (pendingUno === move.seat) {
    pendingUno = null;
  }

  return {
    state: {
      seats: state.seats,
      hands,
      deck,
      discard,
      activeColor:
        card.rank === "W" || card.rank === "F" ? move.wildColor! : card.color!,
      saidUno,
      pendingUno,
      turn: won ? state.turn : (state.turn + advance) % state.seats,
      status: won ? "win" : "playing",
      winner: won ? move.seat : null,
      moves: state.moves + 1,
    },
    skipped: skipped && !won,
  };
}

/**
 * Pop the top card, reshuffling the discard (minus its top) when the deck
 * runs out. Returns null only when no cards exist anywhere (unreachable in
 * real games — hands always hold cards until someone wins).
 */
function drawFrom(
  deck: UnoCard[],
  discard: UnoCard[],
  rand: () => number = Math.random,
): { card: UnoCard; deck: UnoCard[]; discard: UnoCard[] } | null {
  if (deck.length > 0) {
    const next = deck.slice();
    return { card: next.pop()!, deck: next, discard };
  }
  if (discard.length <= 1) return null;
  const top = discard[discard.length - 1]!;
  const rest = shuffleUno(discard.slice(0, -1), rand);
  const next = rest.slice();
  return { card: next.pop()!, deck: next, discard: [top] };
}

/**
 * Draw up to `n` cards, reshuffling as needed. Null when the well runs dry.
 */
function drawN(
  deck: UnoCard[],
  discard: UnoCard[],
  n: number,
  rand: () => number = Math.random,
): { cards: UnoCard[]; deck: UnoCard[]; discard: UnoCard[] } | null {
  let d = deck.slice();
  let p = discard.slice();
  const cards: UnoCard[] = [];
  for (let i = 0; i < n; i++) {
    const one = drawFrom(d, p, rand);
    if (!one) return null;
    d = one.deck;
    p = one.discard;
    cards.push(one.card);
  }
  return { cards, deck: d, discard: p };
}

/** Remove a seat that left mid-game (backend forfeit path). */
export function unoRemoveSeat(state: UnoState, seat: number): UnoState {
  if (seat < 0 || seat >= state.seats) return state;
  const hands = state.hands.map((h, i) => (i === seat ? [] : h.slice()));
  // Leaver's cards return to the deck so totals stay consistent.
  const deck = shuffleUno([...state.deck, ...state.hands[seat]!]);
  const saidUno = state.saidUno.filter((_, i) => i !== seat);
  const pendingUno =
    state.pendingUno === null
      ? null
      : state.pendingUno === seat
        ? null
        : state.pendingUno > seat
          ? state.pendingUno - 1
          : state.pendingUno;
  const turn = state.turn === seat ? (seat + 1) % state.seats : state.turn;
  return { ...state, hands, deck, saidUno, pendingUno, turn };
}

/**
 * Broadcast-safe board: hand sizes + deck size stay, but no hidden cards.
 * Format: `seats:turn:activeColor:moves:counts|deckCount|discard|catch`
 * (e.g. `3:1:R:12:5,1,4|22|R5|1` — seat 1 is catchable; empty when none).
 * Hands travel only via per-viewer `hand`.
 */
export function unoPublicToString(state: UnoState): string {
  const counts = state.hands.map((h) => h.length).join(",");
  const discard = state.discard.map(unoCardToString).join(",");
  const caught = state.pendingUno === null ? "" : String(state.pendingUno);
  return (
    `${state.seats}:${state.turn}:${state.activeColor}:${state.moves}:` +
    `${counts}|${state.deck.length}|${discard}|${caught}`
  );
}

/** Parse an `unoPublicToString` board (hands/deck empty — counts only). */
export function unoPublicFromString(s: string): {
  seats: number;
  turn: number;
  activeColor: UnoColor;
  moves: number;
  counts: number[];
  deckCount: number;
  discard: UnoCard[];
  /** Seat with 1 undeclared card (null when nobody is catchable). */
  caught: number | null;
} {
  const m = s.match(
    /^([2-4]):([0-3]):([RYGB]):(\d+):([\d,]*)\|(\d+)\|([^|]*)\|([0-3]?)$/,
  );
  if (!m) throw new Error(`Bad Uno public string: ${s}`);
  const seats = parseInt(m[1]!, 10);
  const counts = m[5]! === "" ? [] : m[5]!.split(",").map(Number);
  if (counts.length !== seats) throw new Error(`Bad Uno counts: ${s}`);
  const discard = m[7]! === "" ? [] : m[7]!.split(",").map(unoCardFromString);
  const caught = m[8]! === "" ? null : parseInt(m[8]!, 10);
  if (caught !== null && (caught < 0 || caught >= seats)) {
    throw new Error(`Bad Uno caught: ${s}`);
  }
  return {
    seats,
    turn: parseInt(m[2]!, 10) % seats,
    activeColor: m[3] as UnoColor,
    moves: parseInt(m[4]!, 10),
    counts,
    deckCount: parseInt(m[6]!, 10),
    discard,
    caught,
  };
}

/** One viewer's hand as card strings (unicast only — never broadcast). */
export function unoHandFor(state: UnoState, seat: number): string[] {
  return (state.hands[seat] ?? []).map(unoCardToString);
}
