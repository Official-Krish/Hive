import { describe, expect, test } from "bun:test";
import {
  applyLudoToken,
  initialLudoState,
  LUDO_HOME,
  ludoMovable,
  ludoStartOffset,
  ludoYard,
  rollLudo,
  rollLudoDice,
  type LudoState,
} from "../index";
import { ludoStateFromString, ludoToString } from "../index";

function roll(s: LudoState, seat: number, dice: number): LudoState {
  const r = rollLudo(s, { seat, roll: dice });
  if ("error" in r) throw new Error(`seat ${seat} roll ${dice}: ${r.error}`);
  return r.state;
}

function move(s: LudoState, seat: number, token: number): LudoState {
  const r = applyLudoToken(s, { seat, token });
  if ("error" in r) {
    throw new Error(`seat ${seat} token ${token}: ${r.error}`);
  }
  return r.state;
}

describe("setup", () => {
  test("2–4 seats, four tokens each in base, seat 0 first", () => {
    for (const seats of [2, 3, 4]) {
      const s = initialLudoState(seats);
      expect(s.tokens).toEqual(
        Array.from({ length: seats }, () => [-1, -1, -1, -1]),
      );
      expect(s.turn).toBe(0);
      expect(s.status).toBe("playing");
      expect(s.pendingRoll).toBeNull();
    }
    expect(() => initialLudoState(1)).toThrow();
    expect(() => initialLudoState(5)).toThrow();
  });

  test("two players sit diagonally, four split quarters", () => {
    expect([0, 1].map((s) => ludoYard(2, s))).toEqual([0, 2]);
    expect(ludoStartOffset(2, 0)).toBe(0);
    expect(ludoStartOffset(2, 1)).toBe(14);
    expect(ludoStartOffset(4, 3)).toBe(21);
  });

  test("dice stays in 1..6", () => {
    for (let i = 0; i < 200; i++) {
      const d = rollLudoDice();
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
  });
});

describe("roll then pick", () => {
  test("needs a 6 to leave base; anything else auto-passes", () => {
    let s = initialLudoState(2);
    s = roll(s, 0, 4);
    expect(s.tokens[0]).toEqual([-1, -1, -1, -1]);
    expect(s.turn).toBe(1);
    expect(s.pendingRoll).toBeNull();
    s = roll(s, 1, 6);
    expect(s.pendingRoll).toBe(6);
    expect(s.turn).toBe(1);
    expect(ludoMovable(s, 1)).toEqual([0, 1, 2, 3]);
  });

  test("token pick is validated — only movable tokens", () => {
    let s = initialLudoState(2);
    s = roll(s, 0, 6);
    expect(applyLudoToken(s, { seat: 0, token: 7 })).toEqual({
      error: "bad-token",
    });
    s = move(s, 0, 2);
    expect(s.tokens[0]).toEqual([-1, -1, 0, -1]);
    expect(s.turn).toBe(0); // extra turn on 6
  });

  test("moving without a roll is rejected", () => {
    const s = initialLudoState(2);
    expect(applyLudoToken(s, { seat: 0, token: 0 })).toEqual({
      error: "no-roll",
    });
  });

  test("double roll without moving is rejected", () => {
    let s = initialLudoState(2);
    s = roll(s, 0, 6);
    expect(rollLudo(s, { seat: 0, roll: 3 })).toEqual({ error: "has-rolled" });
  });

  test("three sixes forfeit the turn", () => {
    let s = initialLudoState(2);
    s = roll(s, 0, 6);
    s = move(s, 0, 0);
    s = roll(s, 0, 6);
    s = move(s, 0, 1);
    const r = rollLudo(s, { seat: 0, roll: 6 });
    if ("error" in r) throw new Error(r.error);
    expect(r.events).toContain("forfeit-sixes");
    expect(r.state.turn).toBe(1);
    expect(r.state.pendingRoll).toBeNull();
  });

  test("overshoot needs exact roll — token stays out, turn passes", () => {
    let s: LudoState = {
      ...initialLudoState(2),
      tokens: [
        [30, -1, -1, -1],
        [-1, -1, -1, -1],
      ],
      turn: 0,
    };
    s = roll(s, 0, 3);
    expect(s.turn).toBe(1); // 30+3 overshoots 32 → auto-pass
    s = roll(s, 1, 2);
    s = roll(s, 0, 2);
    s = move(s, 0, 0);
    expect(s.tokens[0]![0]).toBe(LUDO_HOME);
    expect(s.status).toBe("playing"); // one home isn't a win
  });

  test("all four home wins the match", () => {
    let s: LudoState = {
      ...initialLudoState(2),
      tokens: [
        [32, 32, 32, 30],
        [-1, -1, -1, -1],
      ],
      turn: 0,
    };
    s = roll(s, 0, 2);
    const r = applyLudoToken(s, { seat: 0, token: 3 });
    if ("error" in r) throw new Error(r.error);
    expect(r.events).toContain("win");
    expect(r.state.status).toBe("win");
    expect(r.state.winner).toBe(0);
  });

  test("turn rotates across seats", () => {
    let s = initialLudoState(4);
    for (const seat of [0, 1, 2, 3]) {
      expect(s.turn).toBe(seat);
      s = roll(s, seat, 3);
    }
    expect(s.turn).toBe(0);
  });
});

describe("capture", () => {
  test("landing on a lone opponent sends it to base", () => {
    // Seat 1 token 0 at progress 2 → loop cell 16 (offset 14). Seat 0
    // rolls 6+3... simpler: seat 0 to progress 2 → cell 2? Use direct setup:
    // seat 0 progress 9 → cell 9; seat 1 progress 23 → cell (14+23)%28 = 9.
    let s: LudoState = {
      ...initialLudoState(2),
      tokens: [
        [6, -1, -1, -1],
        [23, -1, -1, -1],
      ],
      turn: 0,
    };
    s = roll(s, 0, 3); // 6→9, shared with seat 1
    s = move(s, 0, 0);
    expect(s.tokens[0]![0]).toBe(9);
    expect(s.tokens[1]![0]).toBe(-1);
  });

  test("start cells are safe — no capture on cell 0", () => {
    // Seat 1 progress 14 → cell (14+14)%28 = 0, same as seat 0 exit.
    let s: LudoState = {
      ...initialLudoState(2),
      tokens: [
        [-1, -1, -1, -1],
        [14, -1, -1, -1],
      ],
      turn: 0,
    };
    s = roll(s, 0, 6);
    s = move(s, 0, 0);
    expect(s.tokens[0]![0]).toBe(0);
    expect(s.tokens[1]![0]).toBe(14);
  });

  test("a blockade of two cannot be captured (goti cover)", () => {
    let s: LudoState = {
      ...initialLudoState(2),
      tokens: [
        [6, 6, -1, -1],
        [23, 23, -1, -1],
      ],
      turn: 0,
    };
    s = roll(s, 0, 3);
    s = move(s, 0, 0);
    expect(s.tokens[1]).toEqual([23, 23, -1, -1]);
  });
});

describe("errors", () => {
  test("wrong turn, bad roll, game over", () => {
    const s = initialLudoState(2);
    expect(rollLudo(s, { seat: 1, roll: 6 })).toEqual({ error: "wrong-turn" });
    expect(rollLudo(s, { seat: 0, roll: 7 })).toEqual({ error: "bad-roll" });
    expect(rollLudo(s, { seat: 5, roll: 6 })).toEqual({ error: "bad-seat" });
    const done: LudoState = { ...s, status: "win", winner: 0 };
    expect(rollLudo(done, { seat: 0, roll: 6 })).toEqual({
      error: "game-over",
    });
  });
});

describe("serialize", () => {
  test("round-trips through string form", () => {
    let s = initialLudoState(3);
    s = roll(s, 0, 6);
    s = move(s, 0, 1);
    const str = ludoToString(s);
    const back = ludoStateFromString(str);
    expect(back.seats).toBe(3);
    expect(back.tokens).toEqual(s.tokens);
    expect(back.turn).toBe(s.turn);
    expect(back.lastRoll).toBe(6);
    expect(back.pendingRoll).toBeNull();
    expect(back.sixes).toBe(1);
    expect(() => ludoStateFromString("bogus")).toThrow();
    expect(() => ludoStateFromString("2:0:0:0:0:-1,-1,-1")).toThrow();
  });
});
