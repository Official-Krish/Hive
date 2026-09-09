import { describe, expect, test } from "bun:test";
import {
  applyC4Move,
  c4LegalColumns,
  c4RowFor,
  initialC4State,
  type C4State,
} from "../index";

function play(cols: number[]): C4State {
  let s = initialC4State();
  for (const col of cols) {
    const r = applyC4Move(s, { col });
    if ("error" in r) throw new Error(`col ${col}: ${r.error}`);
    s = r.state;
  }
  return s;
}

describe("setup", () => {
  test("red first, all columns open, bottom row empty", () => {
    const s = initialC4State();
    expect(s.turn).toBe("R");
    expect(s.status).toBe("playing");
    expect(c4LegalColumns(s)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(c4RowFor(s.cells, 0)).toBe(0);
  });
});

describe("vertical win", () => {
  test("red stacks four in column 0", () => {
    const s = play([0, 1, 0, 1, 0, 1, 0]);
    expect(s.status).toBe("win");
    expect(s.winner).toBe("R");
    expect(s.line).toHaveLength(4);
    expect(applyC4Move(s, { col: 2 })).toEqual({ error: "game-over" });
  });
});

describe("horizontal win", () => {
  test("red takes the bottom row", () => {
    const s = play([0, 6, 1, 6, 2, 6, 3]);
    expect(s.status).toBe("win");
    expect(s.winner).toBe("R");
  });
});

describe("diagonal win", () => {
  test("red climbs a / diagonal", () => {
    // R(0,0) R(1,1) R(2,2) R(3,3) with matching supports, no early win.
    const s = play([0, 1, 1, 2, 5, 2, 2, 3, 4, 3, 6, 3, 3]);
    expect(s.status).toBe("win");
    expect(s.winner).toBe("R");
  });
});

describe("draw", () => {
  test("full board with no line is a draw", () => {
    const s = play([
      0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 4, 3, 3, 3, 3, 3, 3,
      4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6,
    ]);
    expect(s.moves).toBe(42);
    expect(s.status).toBe("draw");
    expect(s.winner).toBeNull();
    expect(c4LegalColumns(s)).toEqual([]);
  });
});

describe("errors", () => {
  test("column fills up, then rejects", () => {
    const s = play([0, 0, 0, 0, 0, 0]);
    expect(c4RowFor(s.cells, 0)).toBe(-1);
    expect(c4LegalColumns(s)).not.toContain(0);
    expect(applyC4Move(s, { col: 0 })).toEqual({ error: "column-full" });
  });
  test("bad column and wrong turn", () => {
    const s = initialC4State();
    expect(applyC4Move(s, { col: 7 })).toEqual({ error: "bad-column" });
    expect(applyC4Move(s, { col: 0, by: "Y" })).toEqual({
      error: "wrong-turn",
    });
  });
});
