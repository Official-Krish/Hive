import { describe, expect, test } from "bun:test";
import {
  applyBsMove,
  BS_CELLS,
  bsAfloat,
  bsFiredShots,
  initialBsState,
  scatterFleet,
  type BsState,
} from "../index";
import {
  bsFleetFor,
  bsPublicFromString,
  bsPublicToString,
  bsStateFromString,
  bsToString,
} from "../index";

/** Deterministic LCG rand for reproducible fleets. */
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe("setup", () => {
  test("classic fleet per seat, 17 ship cells each", () => {
    const s = initialBsState(seededRand(7));
    for (const fleet of s.fleets) {
      expect(fleet.filter((c) => c === "ship")).toHaveLength(17);
      expect(bsAfloat(fleet).sort((a, b) => a - b)).toEqual([2, 3, 3, 4, 5]);
    }
    expect(s.turn).toBe(0);
    expect(s.status).toBe("playing");
  });

  test("scatter is a valid fleet (no overlaps, in bounds)", () => {
    for (let i = 0; i < 20; i++) {
      const fleet = scatterFleet(Math.random);
      expect(fleet.filter((c) => c === "ship")).toHaveLength(17);
      expect(fleet).toHaveLength(BS_CELLS);
    }
  });
});

describe("firing", () => {
  function duel(): BsState {
    const s = initialBsState(seededRand(7));
    // Rig minimal fleets: seat 1 has a lone destroyer at 0,1.
    s.fleets[0] = Array(BS_CELLS).fill(null);
    s.fleets[0]![99] = "ship";
    s.fleets[1] = Array(BS_CELLS).fill(null);
    s.fleets[1]![0] = "ship";
    s.fleets[1]![1] = "ship";
    return s;
  }

  test("miss passes the turn", () => {
    let s = duel();
    const r = applyBsMove(s, { seat: 0, fire: 50 });
    if ("error" in r) throw new Error(r.error);
    expect(r.result).toEqual({
      hit: false,
      sunk: false,
      sunkLen: 0,
      won: false,
    });
    s = r.state;
    expect(s.turn).toBe(1);
    expect(s.shots[0]![50]).toBe("miss");
  });

  test("hit marks both views, sunk reports length", () => {
    let s = duel();
    const r = applyBsMove(s, { seat: 0, fire: 0 });
    if ("error" in r) throw new Error(r.error);
    expect(r.result.hit).toBe(true);
    expect(r.result.sunk).toBe(false);
    s = r.state;
    expect(s.shots[0]![0]).toBe("hit");
    expect(s.fleets[1]![0]).toBe("hit");
    const r2 = applyBsMove(s, { seat: 1, fire: 50 });
    if ("error" in r2) throw new Error(r2.error);
    const r3 = applyBsMove(r2.state, { seat: 0, fire: 1 });
    if ("error" in r3) throw new Error(r3.error);
    // That was seat 1's entire rigged fleet → sunk AND won.
    expect(r3.result).toEqual({ hit: true, sunk: true, sunkLen: 2, won: true });
    expect(bsAfloat(r3.state.fleets[1]!)).toEqual([]);
  });

  test("sinking the last ship wins", () => {
    const s = duel();
    const r = applyBsMove(s, { seat: 0, fire: 0 });
    if ("error" in r) throw new Error(r.error);
    const r2 = applyBsMove(r.state, { seat: 1, fire: 50 });
    if ("error" in r2) throw new Error(r2.error);
    const r3 = applyBsMove(r2.state, { seat: 0, fire: 1 });
    if ("error" in r3) throw new Error(r3.error);
    // Seat 1 still has... seat 1 fleet was [ship, ship] both hit → all hit → win.
    expect(r3.result.won).toBe(true);
    expect(r3.state.status).toBe("win");
    expect(r3.state.winner).toBe(0);
  });

  test("repeat fire, wrong turn, bad cells rejected", () => {
    const s = duel();
    const r = applyBsMove(s, { seat: 0, fire: 50 });
    if ("error" in r) throw new Error(r.error);
    const r2 = applyBsMove(r.state, { seat: 1, fire: 51 });
    if ("error" in r2) throw new Error(r2.error);
    // Seat 0 refires its own cell.
    expect(applyBsMove(r2.state, { seat: 0, fire: 50 })).toEqual({
      error: "already-fired",
    });
    expect(applyBsMove(s, { seat: 1, fire: 51 })).toEqual({
      error: "wrong-turn",
    });
    expect(applyBsMove(s, { seat: 0, fire: 100 })).toEqual({
      error: "bad-cell",
    });
    expect(applyBsMove(s, { seat: 5, fire: 0 })).toEqual({ error: "bad-seat" });
  });

  test("fired list tracks shots", () => {
    const s = duel();
    const r = applyBsMove(s, { seat: 0, fire: 50 });
    if ("error" in r) throw new Error(r.error);
    expect(bsFiredShots(r.state, 0)).toEqual([50]);
    expect(bsFiredShots(r.state, 1)).toEqual([]);
  });
});

describe("serialize + privacy", () => {
  test("full state round-trips", () => {
    const s = initialBsState(seededRand(7));
    const back = bsStateFromString(bsToString(s));
    expect(back.fleets).toEqual(s.fleets);
    expect(back.shots).toEqual(s.shots);
    expect(back.turn).toBe(s.turn);
    expect(() => bsStateFromString("bogus")).toThrow();
  });

  test("public board hides ships but reveals sunk cells", () => {
    const s = initialBsState(seededRand(7));
    // Sink seat 1's destroyer at 0,1 (rigged duel fleets).
    s.fleets[0] = Array(BS_CELLS).fill(null);
    s.fleets[0]![99] = "ship";
    s.fleets[1] = Array(BS_CELLS).fill(null);
    s.fleets[1]![0] = "ship";
    s.fleets[1]![1] = "ship";
    const a = applyBsMove(s, { seat: 0, fire: 0 });
    if ("error" in a) throw new Error(a.error);
    const b = applyBsMove(a.state, { seat: 1, fire: 50 });
    if ("error" in b) throw new Error(b.error);
    const c = applyBsMove(b.state, { seat: 0, fire: 1 });
    if ("error" in c) throw new Error(c.error);
    const pub = bsPublicFromString(bsPublicToString(c.state));
    expect(pub.sunk[1].sort()).toEqual([0, 1]);
    expect(pub.sunk[0]).toEqual([]);
    // No ship positions leak.
    expect(bsPublicToString(c.state)).not.toContain("S");
    // Private fleet travels separately.
    expect(bsFleetFor(c.state, 1).slice(0, 2)).toBe("HH");
    expect(() => bsPublicFromString("bogus")).toThrow();
  });
});
