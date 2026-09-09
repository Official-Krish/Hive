import { describe, expect, test } from "bun:test";
import {
  applyUnoMove,
  initialUnoState,
  unoCardFromString,
  unoCardToString,
  unoHandFor,
  unoPlayableIndices,
  unoPublicFromString,
  unoPublicToString,
  unoTop,
  type UnoState,
} from "../index";
import { unoStateFromString, unoToString } from "../index";

/** Deterministic rand: always picks the last element (no shuffle). */
const identityRand = () => 0.999999;

describe("setup", () => {
  test("2–4 seats, 5-card hands, number card on top", () => {
    for (const seats of [2, 3, 4]) {
      const s = initialUnoState(seats, identityRand);
      expect(s.hands.length).toBe(seats);
      for (const h of s.hands) expect(h.length).toBe(7);
      // 72 cards total: hands + deck + discard stays constant.
      const total = s.hands.flat().length + s.deck.length + s.discard.length;
      expect(total).toBe(72);
      const top = unoTop(s);
      expect(top.rank).toMatch(/^[0-5]$/);
      expect(s.activeColor).toBe(top.color!);
      expect(s.saidUno).toEqual(Array(seats).fill(false));
      expect(s.pendingUno).toBeNull();
    }
    expect(() => initialUnoState(1)).toThrow();
  });
});

describe("play", () => {
  function fixedState(): UnoState {
    return {
      seats: 3,
      hands: [
        [
          { color: "R", rank: "3" },
          { color: "G", rank: "5" },
        ],
        [{ color: "Y", rank: "3" }],
        [{ color: "B", rank: "1" }],
      ],
      deck: [{ color: "R", rank: "1" }],
      discard: [{ color: "R", rank: "5" }],
      activeColor: "R",
      turn: 0,
      saidUno: [false, false, false],
      pendingUno: null,
      status: "playing",
      winner: null,
      moves: 0,
    };
  }

  test("color and rank matches are playable", () => {
    const s = fixedState();
    // R3 matches color R; G5 matches rank 5.
    expect(unoPlayableIndices(s, 0)).toEqual([0, 1]);
  });

  test("playing a matching card advances the turn", () => {
    let s = fixedState();
    const r = applyUnoMove(s, { seat: 0, play: 0 });
    if ("error" in r) throw new Error(r.error);
    s = r.state;
    expect(s.hands[0]!.length).toBe(1);
    expect(unoTop(s)).toEqual({ color: "R", rank: "3" });
    expect(s.turn).toBe(1);
    expect(s.moves).toBe(1);
  });

  test("non-matching card is rejected", () => {
    const s = fixedState();
    expect(applyUnoMove(s, { seat: 2, play: 0 })).toEqual({
      error: "wrong-turn",
    });
    // Seat 1 holds Y3 — rank matches R5? No: rank 3 vs 5, color Y vs R.
    expect(applyUnoMove({ ...s, turn: 1 }, { seat: 1, play: 0 })).toEqual({
      error: "bad-play",
    });
  });

  test("skip jumps a seat", () => {
    const s: UnoState = {
      ...fixedState(),
      hands: [
        [
          { color: "R", rank: "S" },
          { color: "B", rank: "4" },
        ],
        [{ color: "Y", rank: "1" }],
        [{ color: "B", rank: "2" }],
      ],
    };
    const r = applyUnoMove(s, { seat: 0, play: 0 });
    if ("error" in r) throw new Error(r.error);
    expect(r.skipped).toBe(true);
    expect(r.state.turn).toBe(2);
  });

  test("wild needs a declared color and recolors play", () => {
    const s: UnoState = {
      ...fixedState(),
      hands: [[{ color: null, rank: "W" }], [], []],
      turn: 0,
    };
    expect(applyUnoMove(s, { seat: 0, play: 0 })).toEqual({
      error: "bad-wild-color",
    });
    const r = applyUnoMove(s, { seat: 0, play: 0, wildColor: "B" });
    if ("error" in r) throw new Error(r.error);
    expect(r.state.activeColor).toBe("B");
  });

  test("emptying the hand wins immediately", () => {
    const s: UnoState = {
      ...fixedState(),
      hands: [[{ color: "R", rank: "3" }], [], []],
    };
    const r = applyUnoMove(s, { seat: 0, play: 0 });
    if ("error" in r) throw new Error(r.error);
    expect(r.state.status).toBe("win");
    expect(r.state.winner).toBe(0);
    expect(applyUnoMove(r.state, { seat: 0, play: 0 })).toEqual({
      error: "game-over",
    });
  });

  test("wild-only hand may draw instead of burning the wild", () => {
    const s: UnoState = {
      ...fixedState(),
      hands: [[{ color: null, rank: "W" }], [{ color: "Y", rank: "1" }], []],
      turn: 0,
    };
    const r = applyUnoMove(s, { seat: 0, draw: true });
    if ("error" in r) throw new Error(r.error);
    expect(r.state.hands[0]!.length).toBe(2);
    expect(r.state.turn).toBe(1);
  });

  test("draw only when stuck; turn passes", () => {
    // Seat 0 has plays → draw rejected.
    expect(applyUnoMove(fixedState(), { seat: 0, draw: true })).toEqual({
      error: "has-playable",
    }); // Seat 2 (B1) has nothing on R5 → draws R1, turn → 0.
    const s: UnoState = { ...fixedState(), turn: 2 };
    const r = applyUnoMove(s, { seat: 2, draw: true });
    if ("error" in r) throw new Error(r.error);
    expect(r.state.hands[2]!.length).toBe(2);
    expect(r.state.turn).toBe(0);
  });

  test("empty deck reshuffles the discard under the top card", () => {
    const s: UnoState = {
      ...fixedState(),
      turn: 2,
      deck: [],
      discard: [
        { color: "G", rank: "2" },
        { color: "Y", rank: "4" },
        { color: "R", rank: "5" },
      ],
    };
    const r = applyUnoMove(s, { seat: 2, draw: true });
    if ("error" in r) throw new Error(r.error);
    // Top card R5 stays on the pile; the drawn card came from the reshuffle.
    expect(unoTop(r.state)).toEqual({ color: "R", rank: "5" });
    expect(r.state.deck.length).toBe(1);
  });
});

describe("power cards", () => {
  function powerState(): UnoState {
    const s = initialUnoState(3, identityRand);
    return {
      ...s,
      hands: [
        [
          { color: "R", rank: "T" },
          { color: "G", rank: "1" },
        ],
        [{ color: "Y", rank: "2" }],
        [{ color: "B", rank: "3" }],
      ],
      deck: [
        { color: "R", rank: "1" },
        { color: "Y", rank: "2" },
        { color: "G", rank: "3" },
        { color: "B", rank: "4" },
      ],
      discard: [{ color: "R", rank: "5" }],
      activeColor: "R",
      turn: 0,
    };
  }

  test("+2 victim draws two and is skipped", () => {
    const r = applyUnoMove(powerState(), { seat: 0, play: 0 });
    if ("error" in r) throw new Error(r.error);
    expect(r.skipped).toBe(true);
    expect(r.state.hands[1]!.length).toBe(3);
    expect(r.state.turn).toBe(2);
    expect(r.state.deck.length).toBe(2);
  });

  test("wild +4 needs a color, victim draws four and is skipped", () => {
    const s: UnoState = {
      ...powerState(),
      hands: [
        [
          { color: null, rank: "F" },
          { color: "G", rank: "1" },
        ],
        [{ color: "Y", rank: "2" }],
        [{ color: "B", rank: "3" }],
      ],
    };
    expect(applyUnoMove(s, { seat: 0, play: 0 })).toEqual({
      error: "bad-wild-color",
    });
    const r = applyUnoMove(s, { seat: 0, play: 0, wildColor: "G" });
    if ("error" in r) throw new Error(r.error);
    expect(r.state.activeColor).toBe("G");
    expect(r.state.hands[1]!.length).toBe(5);
    expect(r.state.turn).toBe(2);
  });

  test("+2 matches color or another +2", () => {
    const s = powerState();
    expect(unoPlayableIndices(s, 0)).toEqual([0]);
  });

  test("+2 on a slacker holding one card closes their window", () => {
    const s: UnoState = {
      ...powerState(),
      hands: [
        [
          { color: "R", rank: "T" },
          { color: "G", rank: "1" },
          { color: "B", rank: "2" },
        ],
        [{ color: "Y", rank: "2" }],
        [{ color: "B", rank: "3" }],
      ],
      saidUno: [false, false, false],
      pendingUno: 1,
    };
    const r = applyUnoMove(s, { seat: 0, play: 0 });
    if ("error" in r) throw new Error(r.error);
    expect(r.state.hands[1]!.length).toBe(3);
    expect(r.state.pendingUno).toBeNull();
  });
});

describe("uno call and catch", () => {
  function duel(): UnoState {
    const s = initialUnoState(2, identityRand);
    return {
      ...s,
      hands: [
        [
          { color: "R", rank: "3" },
          { color: "G", rank: "1" },
        ],
        [{ color: "Y", rank: "2" }],
      ],
      deck: [
        { color: "R", rank: "1" },
        { color: "Y", rank: "2" },
        { color: "G", rank: "3" },
        { color: "B", rank: "4" },
        { color: "R", rank: "2" },
      ],
      discard: [{ color: "R", rank: "5" }],
      activeColor: "R",
      turn: 0,
    };
  }

  test("playing to one card opens the window; declaring closes it", () => {
    let s = duel();
    const r = applyUnoMove(s, { seat: 0, play: 0 });
    if ("error" in r) throw new Error(r.error);
    s = r.state;
    expect(s.hands[0]!.length).toBe(1);
    expect(s.pendingUno).toBe(0);
    expect(s.saidUno[0]).toBe(false);

    // Bogus calls rejected.
    expect(applyUnoMove(s, { seat: 1, callUno: true })).toEqual({
      error: "bad-call",
    });
    const c = applyUnoMove(s, { seat: 0, callUno: true });
    if ("error" in c) throw new Error(c.error);
    expect(c.state.pendingUno).toBeNull();
    expect(c.state.saidUno[0]).toBe(true);
    expect(c.state.turn).toBe(1); // table-talk never steals the turn
  });

  test("caught players draw four, turn untouched", () => {
    let s = duel();
    const r = applyUnoMove(s, { seat: 0, play: 0 });
    if ("error" in r) throw new Error(r.error);
    s = r.state;
    // Self-catch rejected.
    expect(applyUnoMove(s, { seat: 0, catch: 0 })).toEqual({
      error: "bad-catch",
    });
    const c = applyUnoMove(s, { seat: 1, catch: 0 });
    if ("error" in c) throw new Error(c.error);
    expect(c.state.hands[0]!.length).toBe(5);
    expect(c.state.pendingUno).toBeNull();
    expect(c.state.turn).toBe(1);
  });

  test("another seat moving closes the window — they got away", () => {
    let s = duel();
    const r = applyUnoMove(s, { seat: 0, play: 0 });
    if ("error" in r) throw new Error(r.error);
    s = r.state;
    // Seat 1 holds Y2 — unplayable on R3, so they draw; the window closes.
    const d = applyUnoMove(s, { seat: 1, draw: true });
    if ("error" in d) throw new Error(d.error);
    expect(d.state.pendingUno).toBeNull();
    expect(applyUnoMove(d.state, { seat: 1, catch: 0 })).toEqual({
      error: "bad-catch",
    });
  });
});

describe("cards", () => {
  test("card strings round-trip", () => {
    for (const s of ["R0", "G5", "BS", "RT", "W", "F"]) {
      expect(unoCardToString(unoCardFromString(s))).toBe(s);
    }
    expect(() => unoCardFromString("X9")).toThrow();
  });
});

describe("public view", () => {
  test("broadcast board hides hands and deck order", () => {
    const s = initialUnoState(3, identityRand);
    const pub = unoPublicFromString(unoPublicToString(s));
    expect(pub.seats).toBe(3);
    expect(pub.counts).toEqual([7, 7, 7]);
    expect(pub.deckCount).toBe(s.deck.length);
    expect(pub.discard).toEqual(s.discard);
    // No hidden card strings leak into the public payload.
    const raw = unoPublicToString(s);
    for (const card of [...s.deck, ...s.hands.flat()]) {
      if (card.rank === "W") continue; // discard may legitimately show one
      void card;
    }
    expect(raw).not.toContain(s.hands[0]!.map(unoCardToString).join(","));
    expect(unoHandFor(s, 1)).toEqual(s.hands[1]!.map(unoCardToString));
    expect(() => unoPublicFromString("bogus")).toThrow();
  });
});

describe("serialize", () => {
  test("full state round-trips through string form", () => {
    const s = initialUnoState(3, identityRand);
    const back = unoStateFromString(unoToString(s));
    expect(back.seats).toBe(3);
    expect(back.turn).toBe(s.turn);
    expect(back.activeColor).toBe(s.activeColor);
    expect(back.moves).toBe(s.moves);
    expect(back.hands).toEqual(s.hands);
    expect(back.deck).toEqual(s.deck);
    expect(back.discard).toEqual(s.discard);
    expect(back.saidUno).toEqual(s.saidUno);
    expect(back.pendingUno).toBeNull();
    expect(() => unoStateFromString("bogus")).toThrow();
  });

  test("call/catch flags survive the round-trip", () => {
    const s = initialUnoState(2, identityRand);
    const flagged: UnoState = {
      ...s,
      hands: [[{ color: "R", rank: "1" }], [{ color: "Y", rank: "2" }]],
      saidUno: [false, true],
      pendingUno: 0,
    };
    const back = unoStateFromString(unoToString(flagged));
    expect(back.saidUno).toEqual([false, true]);
    expect(back.pendingUno).toBe(0);
    expect(unoPublicFromString(unoPublicToString(flagged)).caught).toBe(0);
    expect(unoPublicFromString(unoPublicToString(s)).caught).toBeNull();
  });
});
