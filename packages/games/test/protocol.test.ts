import { describe, expect, test } from "bun:test";
import { resultFromC4, resultFromChess } from "../index";

describe("resultFromChess", () => {
  test("checkmate maps the winning color to its seat", () => {
    expect(resultFromChess("checkmate", "w")).toEqual({
      outcome: "win",
      winner: "first",
    });
    expect(resultFromChess("checkmate", "b")).toEqual({
      outcome: "win",
      winner: "second",
    });
  });
  test("stalemate and fifty-move rule are draws", () => {
    expect(resultFromChess("stalemate", null)).toEqual({
      outcome: "draw",
      reason: "stalemate",
    });
    expect(resultFromChess("draw-50", null)).toEqual({
      outcome: "draw",
      reason: "fifty-move rule",
    });
  });
  test("playing has no result", () => {
    expect(resultFromChess("playing", null)).toBeNull();
  });
});

describe("resultFromC4", () => {
  test("red win goes to the first seat", () => {
    expect(
      resultFromC4({
        cells: [],
        turn: "Y",
        status: "win",
        winner: "R",
        line: [],
        moves: 7,
      }),
    ).toEqual({ outcome: "win", winner: "first" });
  });
  test("full board is a draw, playing is null", () => {
    expect(
      resultFromC4({
        cells: [],
        turn: "R",
        status: "draw",
        winner: null,
        line: null,
        moves: 42,
      }),
    ).toEqual({ outcome: "draw", reason: "board full" });
    expect(
      resultFromC4({
        cells: [],
        turn: "R",
        status: "playing",
        winner: null,
        line: null,
        moves: 3,
      }),
    ).toBeNull();
  });
});
