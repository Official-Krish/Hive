import { describe, expect, test } from "bun:test";
import {
  applyCheckerMove,
  checkerCaptures,
  checkerHasCapture,
  checkerMovesFor,
  initialCheckerState,
  type CheckerState,
} from "../index";
import {
  checkerBoardFromString,
  checkerStateFromString,
  checkersToString,
} from "../index";

function play(s: CheckerState, from: number, to: number): CheckerState {
  const r = applyCheckerMove(s, { from, to });
  if ("error" in r) throw new Error(`${from}→${to}: ${r.error}`);
  return r.state;
}

const sq = (f: string): number =>
  "abcdefgh".indexOf(f[0]!) + (parseInt(f[1]!, 10) - 1) * 8;

describe("setup", () => {
  test("12 men each, red first, dark squares only", () => {
    const s = initialCheckerState();
    expect(s.board.filter((p) => p?.color === "R")).toHaveLength(12);
    expect(s.board.filter((p) => p?.color === "B")).toHaveLength(12);
    expect(s.turn).toBe("R");
    for (let i = 0; i < 64; i++) {
      if (s.board[i]) {
        const occupied = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        expect(occupied).toBe(true);
      }
    }
  });
});

describe("movement", () => {
  test("red man steps forward diagonally", () => {
    let s = initialCheckerState();
    // d3 (19) → e4 (28) or c4 (26).
    expect(checkerMovesFor(s.board, sq("d3"))).toEqual([sq("c4"), sq("e4")]);
    s = play(s, sq("d3"), sq("e4"));
    expect(s.board[sq("e4")]?.color).toBe("R");
    expect(s.turn).toBe("B");
  });

  test("cannot move backwards or sideways", () => {
    const s = initialCheckerState();
    expect(applyCheckerMove(s, { from: sq("d3"), to: sq("d4") })).toEqual({
      error: "illegal-move",
    });
    expect(applyCheckerMove(s, { from: sq("d3"), to: sq("c2") })).toEqual({
      error: "illegal-move",
    });
  });

  test("wrong color and empty squares rejected", () => {
    const s = initialCheckerState();
    expect(applyCheckerMove(s, { from: sq("c7"), to: sq("d6") })).toEqual({
      error: "no-piece",
    });
    expect(applyCheckerMove(s, { from: sq("e5"), to: sq("f6") })).toEqual({
      error: "no-piece",
    });
  });
});

describe("captures", () => {
  function captureSetup(): CheckerState {
    const s = initialCheckerState();
    s.board = Array(64).fill(null);
    // Red man d4 (27), black man e5 (36) → red jumps to f6 (45).
    s.board[sq("d4")] = { color: "R", rank: "man" };
    s.board[sq("e5")] = { color: "B", rank: "man" };
    s.turn = "R";
    return s;
  }

  test("single jump removes the victim", () => {
    let s = captureSetup();
    expect(checkerCaptures(s.board, sq("d4"))).toEqual([sq("f6")]);
    s = play(s, sq("d4"), sq("f6"));
    expect(s.board[sq("e5")]).toBeNull();
    expect(s.turn).toBe("B");
  });

  test("captures are mandatory", () => {
    const s = captureSetup();
    // Another red man with a quiet move available.
    s.board[sq("a3")] = { color: "R", rank: "man" };
    expect(checkerHasCapture(s.board, "R")).toBe(true);
    expect(applyCheckerMove(s, { from: sq("a3"), to: sq("b4") })).toEqual({
      error: "must-capture",
    });
  });

  test("multi-jump chains hold the turn", () => {
    const s = captureSetup();
    s.board[sq("g7")] = { color: "B", rank: "man" };
    let next = play(s, sq("d4"), sq("f6"));
    // f6 (45) jumps g7 (54) landing h8 (63).
    expect(next.turn).toBe("R");
    expect(next.chainFrom).toBe(sq("f6"));
    expect(checkerCaptures(next.board, sq("f6"))).toEqual([sq("h8")]);
    // Must continue with the same piece.
    expect(applyCheckerMove(next, { from: sq("a3"), to: sq("b4") })).toEqual({
      error: "no-piece",
    });
    next = play(next, sq("f6"), sq("h8"));
    expect(next.turn).toBe("B");
    expect(next.chainFrom).toBeNull();
  });

  test("crowning ends the move and the piece becomes king", () => {
    const s = initialCheckerState();
    s.board = Array(64).fill(null);
    // Red man f6 (45) jumps g7 (54) to h8 (63) → crowns.
    s.board[sq("f6")] = { color: "R", rank: "man" };
    s.board[sq("g7")] = { color: "B", rank: "man" };
    s.turn = "R";
    const next = play(s, sq("f6"), sq("h8"));
    expect(next.board[sq("h8")]).toEqual({ color: "R", rank: "king" });
    expect(next.turn).toBe("B");
  });
});

describe("endings", () => {
  test("wiping the opponent wins", () => {
    const s = initialCheckerState();
    s.board = Array(64).fill(null);
    s.board[sq("d4")] = { color: "R", rank: "man" };
    s.board[sq("e5")] = { color: "B", rank: "man" };
    s.turn = "R";
    const next = play(s, sq("d4"), sq("f6"));
    expect(next.status).toBe("win");
    expect(next.winner).toBe("R");
  });

  test("blocked opponent with pieces loses", () => {
    const s = initialCheckerState();
    s.board = Array(64).fill(null);
    // Black king a1 boxed by red pieces — no legal moves.
    s.board[sq("a1")] = { color: "B", rank: "king" };
    s.board[sq("b2")] = { color: "R", rank: "man" };
    s.board[sq("c3")] = { color: "R", rank: "man" };
    s.board[sq("d4")] = { color: "R", rank: "man" };
    s.turn = "R";
    // Red quiet move anywhere passes the turn into a stuck black.
    s.board[sq("h6")] = { color: "R", rank: "man" };
    const next = play(s, sq("h6"), sq("g7"));
    expect(next.status).toBe("win");
    expect(next.winner).toBe("R");
  });

  test("game over rejects moves", () => {
    const s: CheckerState = {
      ...initialCheckerState(),
      status: "win",
      winner: "R",
    };
    expect(applyCheckerMove(s, { from: 0, to: 1 })).toEqual({
      error: "game-over",
    });
  });
});

describe("serialize", () => {
  test("round-trips through string form", () => {
    const s = initialCheckerState();
    const str = checkersToString(s);
    expect(str).toHaveLength(64);
    const back = checkerStateFromString(str, "B");
    expect(back.board).toEqual(s.board);
    expect(back.turn).toBe("B");
    expect(() => checkerBoardFromString("bogus")).toThrow();
  });
});
