import { describe, expect, test } from "bun:test";
import {
  c4CellsFromString,
  c4StateFromString,
  c4ToString,
  chessFromFen,
  chessToFen,
  initialC4State,
  initialChessState,
} from "../index";

describe("chess FEN", () => {
  test("start position round-trips the classic FEN", () => {
    expect(chessToFen(initialChessState())).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });
  test("mid-game state round-trips", () => {
    const fen =
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const s = chessFromFen(fen);
    expect(s.turn).toBe("w");
    expect(s.fullmove).toBe(3);
    expect(chessToFen(s)).toBe(fen);
  });
  test("rejects malformed FEN", () => {
    expect(() => chessFromFen("nope")).toThrow();
    expect(() =>
      chessFromFen(chessToFen(initialChessState()).slice(0, 20)),
    ).toThrow();
  });
});

describe("c4 strings", () => {
  test("empty board is 42 dots", () => {
    expect(c4ToString(initialC4State())).toBe(".".repeat(42));
  });
  test("grid round-trips", () => {
    const s = c4StateFromString(`${".".repeat(35)}RYRYRYR`, "Y");
    expect(s.moves).toBe(7);
    expect(c4ToString(s)).toBe(`${".".repeat(35)}RYRYRYR`);
  });
  test("rejects bad strings and floating discs", () => {
    expect(() => c4CellsFromString("short")).toThrow();
    expect(() => c4CellsFromString(`R${".".repeat(41)}`)).toThrow(); // top-row disc floats
  });
});
