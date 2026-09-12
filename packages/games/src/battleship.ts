// ============================================================================
// BATTLESHIP — 2 seats, classic fleet each (5/4/3/3/2), 10×10 waters.
// Server-scattered placement (no placement phase — games start instantly).
// Fire one shot per turn; hit/miss/sunk reported; fleet sunk loses. No
// extra turn on hit (keeps it lite).
//
// Hidden info like Uno: the stored board holds both fleets, broadcasts use
// the redacted public form, and a seat's own fleet travels per-viewer only.
// Cells are 0..99 (row-major, row 0 at the top).
// ============================================================================

export const BS_SIZE = 10;
export const BS_CELLS = 100;

/** Classic fleet: lengths in placement order. */
export const BS_FLEET = [5, 4, 3, 3, 2];

export type BsCell = "ship" | "hit" | "miss" | null;

export type BsStatus = "playing" | "win";

export interface BsState {
  seats: 2;
  /** Private ship grids (never broadcast). */
  fleets: BsCell[][];
  /** Public shot maps: hits/misses each seat has FIRED. */
  shots: BsCell[][];
  turn: number;
  status: BsStatus;
  winner: number | null;
  moves: number;
}

export type BsMoveError =
  "bad-seat" | "wrong-turn" | "bad-cell" | "already-fired" | "game-over";

function emptyGrid(): BsCell[] {
  return Array<BsCell>(BS_CELLS).fill(null);
}

/** Scatter the classic fleet with an injectable rand (for tests). */
export function scatterFleet(rand: () => number = Math.random): BsCell[] {
  const grid = emptyGrid();
  // Classic no-touch rule: ships may not border each other, not even
  // diagonally — otherwise components fuse and sunk detection breaks.
  const crowded = (r: number, c: number): boolean => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (
          rr >= 0 &&
          rr < BS_SIZE &&
          cc >= 0 &&
          cc < BS_SIZE &&
          grid[rr * BS_SIZE + cc] !== null
        ) {
          return true;
        }
      }
    }
    return false;
  };
  for (const len of BS_FLEET) {
    let placed = false;
    for (let tries = 0; tries < 500 && !placed; tries++) {
      const horiz = rand() < 0.5;
      const r = Math.floor(rand() * BS_SIZE);
      const c = Math.floor(rand() * BS_SIZE);
      const cells: number[] = [];
      let fits = true;
      for (let k = 0; k < len; k++) {
        const rr = horiz ? r : r + k;
        const cc = horiz ? c + k : c;
        if (rr >= BS_SIZE || cc >= BS_SIZE || crowded(rr, cc)) {
          fits = false;
          break;
        }
      }
      if (fits) {
        for (let k = 0; k < len; k++) {
          const rr = horiz ? r : r + k;
          const cc = horiz ? c + k : c;
          cells.push(rr * BS_SIZE + cc);
        }
        for (const i of cells) grid[i] = "ship";
        placed = true;
      }
    }
    if (!placed) throw new Error("fleet scatter failed");
  }
  return grid;
}

export function initialBsState(rand: () => number = Math.random): BsState {
  return {
    seats: 2,
    fleets: [scatterFleet(rand), scatterFleet(rand)],
    shots: [emptyGrid(), emptyGrid()],
    turn: 0,
    status: "playing",
    winner: null,
    moves: 0,
  };
}

export interface BsMove {
  seat: number;
  fire: number;
}

export interface BsResult {
  hit: boolean;
  sunk: boolean;
  /** Length of the sunk ship (0 when nothing sank). */
  sunkLen: number;
  won: boolean;
}

/** Ship cells connected to `cell` (orthogonal flood fill on the fleet). */
function shipCells(fleet: BsCell[], cell: number): number[] {
  if (fleet[cell] !== "ship" && fleet[cell] !== "hit") return [];
  const seen = new Set<number>([cell]);
  const stack = [cell];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const r = Math.floor(cur / BS_SIZE);
    const c = cur % BS_SIZE;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= BS_SIZE || cc < 0 || cc >= BS_SIZE) continue;
      const n = rr * BS_SIZE + cc;
      if (!seen.has(n) && (fleet[n] === "ship" || fleet[n] === "hit")) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return [...seen];
}

/**
 * Fire one shot. Hit/miss marks BOTH the shooter's shot map and the
 * victim's fleet (so each side renders correctly from its own view).
 */
export function applyBsMove(
  state: BsState,
  move: BsMove,
): { state: BsState; result: BsResult } | { error: BsMoveError } {
  if (state.status !== "playing") return { error: "game-over" };
  if (move.seat !== 0 && move.seat !== 1) return { error: "bad-seat" };
  if (move.seat !== state.turn) return { error: "wrong-turn" };
  if (!Number.isInteger(move.fire) || move.fire < 0 || move.fire >= BS_CELLS) {
    return { error: "bad-cell" };
  }
  if (state.shots[move.seat]![move.fire] !== null) {
    return { error: "already-fired" };
  }

  const victim = ((move.seat + 1) % 2) as 0 | 1;
  const shots = state.shots.map((g) => g.slice());
  const fleets = state.fleets.map((g) => g.slice());
  const hit = fleets[victim]![move.fire] === "ship";
  shots[move.seat]![move.fire] = hit ? "hit" : "miss";
  let sunk = false;
  let sunkLen = 0;
  if (hit) {
    fleets[victim]![move.fire] = "hit";
    const ship = shipCells(fleets[victim]!, move.fire);
    if (ship.every((i) => fleets[victim]![i] === "hit")) {
      sunk = true;
      sunkLen = ship.length;
    }
  }
  const won = fleets[victim]!.every((c) => c !== "ship");
  return {
    state: {
      seats: 2,
      fleets,
      shots,
      turn: won ? state.turn : victim,
      status: won ? "win" : "playing",
      winner: won ? move.seat : null,
      moves: state.moves + 1,
    },
    result: { hit, sunk, sunkLen, won },
  };
}

/** Lengths of still-afloat ships on a fleet (for the sunk tracker). */
export function bsAfloat(fleet: BsCell[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (let i = 0; i < BS_CELLS; i++) {
    if ((fleet[i] === "ship" || fleet[i] === "hit") && !seen.has(i)) {
      const ship = shipCells(fleet, i);
      for (const c of ship) seen.add(c);
      if (ship.some((c) => fleet[c] === "ship")) {
        out.push(ship.length);
      }
    }
  }
  return out.sort((a, b) => b - a);
}

/** Cells this seat has already fired at (for UI disabling). */
export function bsFiredShots(state: BsState, seat: number): number[] {
  const out: number[] = [];
  state.shots[seat]!.forEach((c, i) => {
    if (c !== null) out.push(i);
  });
  return out;
}
