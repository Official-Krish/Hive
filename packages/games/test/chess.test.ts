import { describe, expect, test } from "bun:test";
import {
  allLegalMoves,
  applyMove,
  inCheck,
  initialChessState,
  legalMoves,
  positionKey,
  squareIndex,
  squareName,
  type ChessState,
} from "../index";

const mv = (from: string, to: string, promote?: "n" | "b" | "r" | "q") => ({
  from: squareIndex(from),
  to: squareIndex(to),
  ...(promote ? { promote } : {}),
});

function play(moves: [string, string][]): ChessState {
  let s = initialChessState();
  for (const [f, t] of moves) {
    const r = applyMove(s, mv(f, t));
    if ("error" in r) throw new Error(`${f}-${t}: ${r.error}`);
    s = r.state;
  }
  return s;
}

describe("setup", () => {
  test("white has 20 legal moves from the start", () => {
    expect(allLegalMoves(initialChessState(), "w")).toHaveLength(20);
  });
  test("square helpers round-trip", () => {
    expect(squareName(28)).toBe("e4");
    expect(squareIndex("e4")).toBe(28);
    expect(() => squareIndex("z9")).toThrow();
  });
  test("knight hints from b1", () => {
    const targets = legalMoves(initialChessState(), squareIndex("b1"))
      .map((m) => squareName(m.to))
      .sort();
    expect(targets).toEqual(["a3", "c3"]);
  });
});

describe("fool's mate", () => {
  test("black mates in 2", () => {
    const s = play([
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"],
      ["d8", "h4"],
    ]);
    expect(s.status).toBe("checkmate");
    expect(s.winner).toBe("b");
    expect(inCheck(s, "b")).toBe(false);
    expect(applyMove(s, mv("e2", "e4"))).toEqual({ error: "game-over" });
  });
});

describe("scholar's mate", () => {
  test("white mates in 4", () => {
    const s = play([
      ["e2", "e4"],
      ["e7", "e5"],
      ["d1", "h5"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["g8", "f6"],
      ["h5", "f7"],
    ]);
    expect(s.status).toBe("checkmate");
    expect(s.winner).toBe("w");
    expect(inCheck(s, "b")).toBe(true);
  });
});

describe("castling", () => {
  test("white castles kingside", () => {
    const s = play([
      ["e2", "e4"],
      ["e7", "e5"],
      ["g1", "f3"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["f8", "c5"],
      ["e1", "g1"],
    ]);
    expect(s.board[squareIndex("g1")]?.type).toBe("k");
    expect(s.board[squareIndex("f1")]?.type).toBe("r");
  });
  test("king move kills the right", () => {
    const s = play([
      ["e2", "e4"],
      ["e7", "e5"],
      ["e1", "e2"],
      ["b8", "c6"],
      ["e2", "e1"],
      ["d7", "d6"],
    ]);
    const kingside = legalMoves(s, squareIndex("e1")).map((m) =>
      squareName(m.to),
    );
    expect(kingside).not.toContain("g1");
  });
});

describe("en passant", () => {
  test("white captures en passant", () => {
    const s = play([
      ["e2", "e4"],
      ["a7", "a6"],
      ["e4", "e5"],
      ["d7", "d5"],
      ["e5", "d6"],
    ]);
    expect(s.board[squareIndex("d6")]?.type).toBe("p");
    expect(s.board[squareIndex("d6")]?.color).toBe("w");
    expect(s.board[squareIndex("d5")]).toBeNull();
  });
});

describe("promotion", () => {
  const promo: ChessState = {
    ...initialChessState(),
    board: (() => {
      const b = Array(64).fill(null);
      b[squareIndex("a7")] = { type: "p", color: "w" };
      b[squareIndex("e1")] = { type: "k", color: "w" };
      b[squareIndex("e8")] = { type: "k", color: "b" };
      return b;
    })(),
  };
  test("requires a choice on the last rank", () => {
    expect(applyMove(promo, mv("a7", "a8"))).toEqual({
      error: "promotion-required",
    });
    expect(applyMove(promo, mv("a7", "a8", "k" as never))).toEqual({
      error: "invalid-promotion",
    });
  });
  test("promotes to the chosen piece", () => {
    const r = applyMove(promo, mv("a7", "a8", "q"));
    if ("error" in r) throw new Error(r.error);
    expect(r.state.board[squareIndex("a8")]).toEqual({
      type: "q",
      color: "w",
    });
  });
});

describe("stalemate", () => {
  test("queen traps a cornered king", () => {
    // White: Kf7 Qf6, Black: Kh8, white to move — Qf6-g6 is stalemate.
    const board = Array(64).fill(null);
    board[squareIndex("f7")] = { type: "k", color: "w" };
    board[squareIndex("f6")] = { type: "q", color: "w" };
    board[squareIndex("h8")] = { type: "k", color: "b" };
    const s: ChessState = { ...initialChessState(), board, turn: "w" };
    // Black's only escape is h7 — g7/g8 are covered by the white king.
    expect(allLegalMoves(s, "b")).toHaveLength(1);
    const r = applyMove(s, mv("f6", "g6"));
    if ("error" in r) throw new Error(r.error);
    expect(r.state.status).toBe("stalemate");
    expect(r.state.winner).toBeNull();
  });
});

describe("draws", () => {
  const bareKings = (): ChessState => {
    const board = Array(64).fill(null);
    board[squareIndex("e1")] = { type: "k", color: "w" };
    board[squareIndex("e8")] = { type: "k", color: "b" };
    return { ...initialChessState(), board, turn: "w" as const };
  };
  test("fifty-move rule", () => {
    const s: ChessState = { ...bareKings(), halfmove: 99 };
    const r = applyMove(s, mv("e1", "e2"));
    if ("error" in r) throw new Error(r.error);
    expect(r.state.status).toBe("draw-50");
  });
  test("insufficient material (K+B vs K)", () => {
    const s = bareKings();
    s.board[squareIndex("c4")] = { type: "b", color: "w" };
    const r = applyMove(s, mv("e1", "d1"));
    if ("error" in r) throw new Error(r.error);
    expect(r.state.status).toBe("draw-material");
  });
});

describe("errors", () => {
  test("empty square, wrong turn, blocked path", () => {
    const s = initialChessState();
    expect(applyMove(s, mv("e4", "e5"))).toEqual({ error: "no-piece" });
    expect(applyMove(s, mv("e7", "e6"))).toEqual({ error: "wrong-turn" });
    expect(applyMove(s, mv("a2", "a5"))).toEqual({ error: "illegal-move" });
  });
  test("king cannot stay in check", () => {
    let s = play([
      ["e2", "e4"],
      ["e7", "e5"],
      ["d1", "h5"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["g7", "g6"],
    ]);
    const check = applyMove(s, mv("h5", "e5"));
    if ("error" in check) throw new Error(check.error);
    s = check.state;
    expect(inCheck(s, "b")).toBe(true);
    // e7 is covered by the checking queen — stepping there stays in check.
    expect(applyMove(s, mv("e8", "e7"))).toEqual({ error: "illegal-move" });
  });
});

describe("attack detection", () => {
  test("slider finds the queen past empty rays blocked by other pieces", () => {
    // Regression: the ray scan used to return on the first piece met in the
    // first direction, missing a queen down another ray (Qe5+ not detected
    // because Bf8 sat on the +file ray from the black king).
    const s = play([
      ["e2", "e4"],
      ["e7", "e5"],
      ["d1", "h5"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["g7", "g6"],
      ["h5", "e5"],
    ]);
    expect(inCheck(s, "b")).toBe(true);
  });
});

describe("positionKey", () => {
  test("distinguishes turn and castling rights", () => {
    const a = initialChessState();
    const b: ChessState = { ...a, turn: "b" };
    const c: ChessState = {
      ...a,
      castling: { ...a.castling, wK: false },
    };
    expect(positionKey(a)).not.toBe(positionKey(b));
    expect(positionKey(a)).not.toBe(positionKey(c));
    expect(positionKey(a)).toBe(positionKey(initialChessState()));
  });
});
