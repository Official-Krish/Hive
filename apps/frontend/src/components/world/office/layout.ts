// ============================================================================
// OFFICE WORLD LAYOUT — single source of truth
// ----------------------------------------------------------------------------
// Coordinate system: Y up, meters. Floor at y = 0.
//   X: west (-) .. east (+)          Z: north (-) .. south (+)
// The player spawns in the COURTYARD (south) and walks NORTH (-Z) through the
// glass facade into the LOBBY, then explores the wings.
//
// Everything downstream (walls, glass, floors, colliders, lights, furniture)
// reads from the exports here so visuals and collision never drift.
// ============================================================================

import type { TransformData } from "../InstancedFurniture";
import type { FloorKind } from "./materials";

// --- Primitive types --------------------------------------------------------
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** Axis-aligned box in XZ, with the vertical band it actually blocks. */
export interface AABB {
  min: Vec2;
  max: Vec2;
  /** Bottom of the blocking band (default 0). */
  y0?: number;
  /** Top of the blocking band (default: effectively infinite). */
  y1?: number;
}

/** Full 3D axis-aligned box — used for camera obstruction tests. */
export interface Box3Spec {
  min: Vec3;
  max: Vec3;
}

export type WallKind = "solid" | "glass" | "hedge";

/** A wall segment defined by two endpoints on the floor plus height + thickness. */
export interface Wall {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
  t: number;
  kind: WallKind;
  /** Height the wall starts at — non-zero for everything on level 2. */
  base?: number;
}

// --- Global dimensions ------------------------------------------------------
// The building is TWO storeys. Vertical stack, bottom-up:
//   0.00  level 1 walkable floor
//   3.60  CEILING_Y     — level 1 suspended ceiling (wings + corridor only)
//   3.90  L2_Y - SLAB_T — underside of the level 2 slab
//   4.30  L2_Y          — level 2 walkable floor
//   7.90  CEILING_Y2    — level 2 suspended ceiling
//   8.50  EXT_H         — top of the facade
// NOTE: CEILING_Y2 must stay BELOW EXT_H, otherwise the level 2 ceiling pokes
// above the exterior walls and the building reads as roofless.
export const EXT_H = 8.5; // exterior wall / facade height (both storeys)
export const ROOF_T = 0.34; // roof slab thickness (sits on top of EXT_H)
export const PARAPET_H = 0.95; // parapet above the roof slab
export const SLAB_T = 0.4; // thickness of the level 2 floor slab
export const L2_Y = 4.3; // walkable top surface of level 2
export const CEILING_Y = 3.6; // suspended ceiling on level 1
export const CEILING_Y2 = 7.9; // suspended ceiling on level 2
export const INT_H = 3.1; // interior partitions
export const GLASS_H = 3.1; // interior glazed partitions
export const POD_H = 2.75; // glazed pod / private office enclosure height
export const BALUSTRADE_H = 1.15; // guarding to open edges on level 2
export const HEDGE_H = 0.85;
export const WALL_T = 0.26;

// Interior footprint.
export const INTERIOR = { minX: -34, maxX: 34, minZ: -20, maxZ: 22 };

// Courtyard extends south of the facade (flat, paved — no terrain).
export const COURTYARD = { minX: -34, maxX: 34, minZ: 22, maxZ: 46 };

// Entrance gap in the south glass facade (open x range).
export const DOOR = { x0: -4, x1: 4 };

/** Glass roof lantern over the lobby (the rest of the roof is solid). */
export const SKYLIGHT = { x0: -28, x1: 28, z0: 13.5, z1: 20.5 };

/** Player spawn — out in the courtyard, facing the entrance (north / -Z). */
export const SPAWN: Vec3 = [0, 0, 36];

// --- Wall constructor -------------------------------------------------------
const W = (
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  kind: WallKind = "solid",
  h?: number,
  t: number = WALL_T,
  base = 0,
): Wall => ({
  x0,
  z0,
  x1,
  z1,
  kind,
  h: h ?? (kind === "glass" ? GLASS_H : kind === "hedge" ? HEDGE_H : INT_H),
  t,
  base,
});

const { minX, maxX, minZ, maxZ } = INTERIOR;

// ============================================================================
// WALLS — explicit segments (each wall line written once, with door gaps).
// ============================================================================
export const WALLS: Wall[] = [
  // --- Perimeter shell (tall) ----------------------------------------------
  W(minX, minZ, maxX, minZ, "solid", EXT_H, 0.4), // north (back)
  W(minX, minZ, minX, maxZ, "solid", EXT_H, 0.4), // west
  W(maxX, minZ, maxX, maxZ, "solid", EXT_H, 0.4), // east
  // South facade = full-height glazing, split around the entrance door gap.
  W(minX, maxZ, DOOR.x0, maxZ, "glass", EXT_H),
  W(DOOR.x1, maxZ, maxX, maxZ, "glass", EXT_H),

  // --- West corridor wall (x = -4, z: -20..12) -----------------------------
  // Doorways: lounge z[-10,-6], workspace z[4,8].
  W(-4, minZ, -4, -10),
  W(-4, -6, -4, 4),
  W(-4, 8, -4, 12),

  // --- East corridor wall (x = 4, z: -20..12) ------------------------------
  // Doorways: ai-lab z[-15,-11], meeting z[-3,1] (glazed), cafeteria z[5,9].
  W(4, minZ, 4, -15),
  W(4, -11, 4, -8),
  W(4, -8, 4, -3, "glass"),
  W(4, 1, 4, 2, "glass"),
  W(4, 2, 4, 5),
  W(4, 9, 4, 12),

  // --- West wing divider: Workspace | Lounge (z = 0, x: -34..-4) -----------
  W(minX, 0, -22, 0),
  W(-16, 0, -4, 0),

  // --- East wing dividers ---------------------------------------------------
  // Cafeteria | Meeting (z = 2), opening x[18,24].
  W(4, 2, 18, 2),
  W(24, 2, maxX, 2),
  // Meeting | AI Lab (z = -8), opening x[18,24].
  W(4, -8, 18, -8),
  W(24, -8, maxX, -8),
  // Meeting internal split (x = 19) glazed, gap z[-4,-1].
  W(19, -8, 19, -4, "glass"),
  W(19, -1, 19, 2, "glass"),
];

// Low hedges / planter walls ringing the courtyard so the player stays on the
// paved plaza. Rendered in Courtyard.tsx.
export const COURTYARD_BARRIERS: Wall[] = [
  W(COURTYARD.minX, COURTYARD.maxZ, COURTYARD.maxX, COURTYARD.maxZ, "hedge"), // south
  W(COURTYARD.minX, COURTYARD.minZ, COURTYARD.minX, COURTYARD.maxZ, "hedge"), // west
  W(COURTYARD.maxX, COURTYARD.minZ, COURTYARD.maxX, COURTYARD.maxZ, "hedge"), // east
];

// ============================================================================
// LEVEL 2 — deck, mezzanine, feature stair, walkable-surface sampling.
// ============================================================================

/** Mezzanine walkway: level 2 continues over the lobby up to this z. */
export const MEZZ = { x0: minX, x1: maxX, z0: 12, z1: 15.9 };

/** Straight monumental flight, rising west→east across the atrium. */
export const STAIR = { x0: -28, x1: -19, z0: 17.2, z1: 20.6 };
export const STAIR_TREADS = 13;

/** Arrival balcony at the top of the flight; overlaps the mezzanine edge. */
export const STAIR_LANDING = { x0: -19, x1: -14, z0: 15.6, z1: 20.6 };

/** A flat walkable slab. */
export interface Deck {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
}

/** A sloped walkable surface; height lerps along `axis` from min to max edge. */
export interface Ramp {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  axis: "x" | "z";
  yAtMin: number;
  yAtMax: number;
}

/**
 * Every flat surface the player can stand on above the ground plane. Level 1
 * is implicit (y = 0 everywhere), so this only lists the upper deck.
 */
export const DECKS: Deck[] = [
  // Full upper floor over both wings + the corridor.
  { x0: minX, x1: maxX, z0: minZ, z1: MEZZ.z0, y: L2_Y },
  // Mezzanine walkway overlooking the atrium.
  { x0: MEZZ.x0, x1: MEZZ.x1, z0: MEZZ.z0, z1: MEZZ.z1, y: L2_Y },
  // Stair arrival balcony.
  {
    x0: STAIR_LANDING.x0,
    x1: STAIR_LANDING.x1,
    z0: STAIR_LANDING.z0,
    z1: STAIR_LANDING.z1,
    y: L2_Y,
  },
];

export const RAMPS: Ramp[] = [
  {
    x0: STAIR.x0,
    x1: STAIR.x1,
    z0: STAIR.z0,
    z1: STAIR.z1,
    axis: "x",
    yAtMin: 0,
    yAtMax: L2_Y,
  },
];

/** How high a step the player can absorb without jumping. */
export const STEP_UP = 0.62;

/**
 * Height of the surface under (x, z) that the player's feet can rest on.
 * Picks the highest candidate at or below `feetY + STEP_UP`, so walking under
 * the stair or the upper deck keeps you on the ground plane, and walking off
 * the mezzanine drops you (gravity in the controller does the rest).
 */
export function supportAt(x: number, z: number, feetY: number): number {
  const limit = feetY + STEP_UP;
  let best = 0; // the ground plane exists everywhere
  for (const d of DECKS) {
    if (x < d.x0 || x > d.x1 || z < d.z0 || z > d.z1) continue;
    if (d.y <= limit && d.y > best) best = d.y;
  }
  for (const r of RAMPS) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    const t =
      r.axis === "x" ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
    const y = r.yAtMin + (r.yAtMax - r.yAtMin) * t;
    if (y <= limit && y > best) best = y;
  }
  return best;
}

// --- Level 2 partitions, balustrades and stair guarding ---------------------

/** Glazed spine either side of the level 2 corridor, with mid-wing openings. */
export const WALLS_L2: Wall[] = [
  W(-4, minZ, -4, -6, "glass", POD_H, 0.1, L2_Y),
  W(-4, -2, -4, MEZZ.z0, "glass", POD_H, 0.1, L2_Y),
  W(4, minZ, 4, -6, "glass", POD_H, 0.1, L2_Y),
  W(4, -2, 4, MEZZ.z0, "glass", POD_H, 0.1, L2_Y),
];

/** Glass guarding to every open edge of the upper deck. */
export const BALUSTRADES: Wall[] = [
  // Mezzanine edge onto the atrium, split around the stair landing.
  W(minX, MEZZ.z1, STAIR_LANDING.x0, MEZZ.z1, "glass", BALUSTRADE_H, 0.1, L2_Y),
  W(STAIR_LANDING.x1, MEZZ.z1, maxX, MEZZ.z1, "glass", BALUSTRADE_H, 0.1, L2_Y),
  // Stair landing: south and east edges (west edge is the stair arrival).
  W(
    STAIR_LANDING.x0,
    STAIR_LANDING.z1,
    STAIR_LANDING.x1,
    STAIR_LANDING.z1,
    "glass",
    BALUSTRADE_H,
    0.1,
    L2_Y,
  ),
  W(
    STAIR_LANDING.x1,
    STAIR_LANDING.z0,
    STAIR_LANDING.x1,
    STAIR_LANDING.z1,
    "glass",
    BALUSTRADE_H,
    0.1,
    L2_Y,
  ),
];

/**
 * Collider-only guards flanking the flight. Rendered separately (sloped) by
 * Stairs.tsx, so these are deliberately NOT in any drawn wall list.
 */
export const STAIR_GUARDS: Wall[] = [
  W(STAIR.x0, STAIR.z0, STAIR.x1, STAIR.z0, "glass", L2_Y + BALUSTRADE_H, 0.1),
  W(STAIR.x0, STAIR.z1, STAIR.x1, STAIR.z1, "glass", L2_Y + BALUSTRADE_H, 0.1),
];

// ============================================================================
// PODS — glazed private rooms. Level 1 gets focus/huddle boxes, level 2 the
// leadership suite (manager offices, corner office, boardroom).
// ============================================================================
export type PodKind = "manager" | "corner" | "board" | "huddle" | "focus";

export interface Pod {
  id: string;
  name: string;
  level: 1 | 2;
  /** x0, x1, z0, z1 */
  rect: [number, number, number, number];
  door: { side: "n" | "s" | "e" | "w"; at: number; width: number };
  kind: PodKind;
  accent: string;
}

export const PODS: Pod[] = [
  // --- Level 1: huddle boxes in the lounge, focus rooms off the meeting wing
  {
    id: "huddle-a",
    name: "Huddle A",
    level: 1,
    rect: [-33.4, -28.6, -8.4, -4.8],
    door: { side: "e", at: -6.6, width: 1.1 },
    kind: "huddle",
    accent: "#f59e0b",
  },
  {
    id: "huddle-b",
    name: "Huddle B",
    level: 1,
    rect: [-33.4, -28.6, -4.4, -0.8],
    door: { side: "e", at: -2.6, width: 1.1 },
    kind: "huddle",
    accent: "#f59e0b",
  },
  {
    id: "focus-1",
    name: "Focus 1:1",
    level: 1,
    rect: [29.6, 33.4, -7.4, -4.2],
    door: { side: "w", at: -5.8, width: 1.0 },
    kind: "focus",
    accent: "#34d399",
  },
  {
    id: "focus-2",
    name: "Focus 1:1",
    level: 1,
    rect: [29.6, 33.4, -3.8, -0.6],
    door: { side: "w", at: -2.2, width: 1.0 },
    kind: "focus",
    accent: "#34d399",
  },
  // --- Level 2: manager offices along the north wall of the west wing
  {
    id: "mgr-1",
    name: "Eng Manager",
    level: 2,
    rect: [-33.4, -27.4, -19.4, -14.4],
    door: { side: "s", at: -30.4, width: 1.1 },
    kind: "manager",
    accent: "#818cf8",
  },
  {
    id: "mgr-2",
    name: "Design Manager",
    level: 2,
    rect: [-27.0, -21.0, -19.4, -14.4],
    door: { side: "s", at: -24.0, width: 1.1 },
    kind: "manager",
    accent: "#818cf8",
  },
  {
    id: "mgr-3",
    name: "Product Manager",
    level: 2,
    rect: [-20.6, -14.6, -19.4, -14.4],
    door: { side: "s", at: -17.6, width: 1.1 },
    kind: "manager",
    accent: "#818cf8",
  },
  {
    id: "mgr-4",
    name: "Research Lead",
    level: 2,
    rect: [-14.2, -8.2, -19.4, -14.4],
    door: { side: "s", at: -11.2, width: 1.1 },
    kind: "manager",
    accent: "#818cf8",
  },
  {
    id: "board",
    name: "Boardroom",
    level: 2,
    rect: [8.0, 22.0, -19.4, -12.4],
    door: { side: "s", at: 15.0, width: 1.9 },
    kind: "board",
    accent: "#22d3ee",
  },
  {
    id: "corner",
    name: "Director's Office",
    level: 2,
    rect: [25.6, 33.4, -19.4, -12.4],
    door: { side: "s", at: 29.5, width: 1.2 },
    kind: "corner",
    accent: "#f472b6",
  },
  {
    id: "priv-1",
    name: "People & Culture",
    level: 2,
    rect: [8.0, 13.4, -8.0, -3.2],
    door: { side: "n", at: 10.7, width: 1.0 },
    kind: "manager",
    accent: "#fb923c",
  },
  {
    id: "priv-2",
    name: "Finance",
    level: 2,
    rect: [15.4, 20.8, -8.0, -3.2],
    door: { side: "n", at: 18.1, width: 1.0 },
    kind: "manager",
    accent: "#fb923c",
  },
  {
    id: "huddle-c",
    name: "Huddle C",
    level: 2,
    rect: [26.4, 33.4, -8.0, -3.2],
    door: { side: "w", at: -5.6, width: 1.1 },
    kind: "huddle",
    accent: "#a78bfa",
  },
];

/** Glazed enclosure for one pod: four sides, split around the door gap. */
function podWalls(p: Pod): Wall[] {
  const [x0, x1, z0, z1] = p.rect;
  const base = p.level === 2 ? L2_Y : 0;
  const out: Wall[] = [];
  const seg = (ax0: number, az0: number, ax1: number, az1: number) => {
    if (Math.hypot(ax1 - ax0, az1 - az0) < 0.06) return;
    out.push(W(ax0, az0, ax1, az1, "glass", POD_H, 0.09, base));
  };
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  const split = (lo: number, hi: number, at: number, w: number) =>
    [
      [lo, clamp(at - w / 2, lo, hi)],
      [clamp(at + w / 2, lo, hi), hi],
    ] as [number, number][];

  for (const [side, z] of [
    ["n", z0],
    ["s", z1],
  ] as const) {
    const parts =
      p.door.side === side
        ? split(x0, x1, p.door.at, p.door.width)
        : ([[x0, x1]] as [number, number][]);
    for (const [a, b] of parts) seg(a, z, b, z);
  }
  for (const [side, x] of [
    ["w", x0],
    ["e", x1],
  ] as const) {
    const parts =
      p.door.side === side
        ? split(z0, z1, p.door.at, p.door.width)
        : ([[z0, z1]] as [number, number][]);
    for (const [a, b] of parts) seg(x, a, x, b);
  }
  return out;
}

export const POD_WALLS: Wall[] = PODS.flatMap(podWalls);

export interface Room {
  id: string;
  name: string;
  rect: [number, number, number, number]; // x0, x1, z0, z1
  floor: FloorKind;
  accent: string;
}

export const ROOMS: Room[] = [
  {
    id: "lobby",
    name: "Reception & Lobby",
    rect: [minX, maxX, 12, maxZ],
    floor: "lobby",
    accent: "#38bdf8",
  },
  {
    id: "corridor",
    name: "Central Atrium",
    rect: [-4, 4, minZ, 12],
    floor: "corridor",
    accent: "#94a3b8",
  },
  {
    id: "workspace",
    name: "Engineering Floor",
    rect: [minX, -4, 0, 12],
    floor: "workspace",
    accent: "#818cf8",
  },
  {
    id: "lounge",
    name: "Lounge & Breakout",
    rect: [minX, -4, minZ, 0],
    floor: "lounge",
    accent: "#f59e0b",
  },
  {
    id: "cafeteria",
    name: "Cafeteria",
    rect: [4, maxX, 2, 12],
    floor: "cafeteria",
    accent: "#fb923c",
  },
  {
    id: "meeting",
    name: "Meeting Rooms",
    rect: [4, maxX, -8, 2],
    floor: "wood",
    accent: "#34d399",
  },
  {
    id: "ailab",
    name: "AI Lab",
    rect: [4, maxX, minZ, -8],
    floor: "ailab",
    accent: "#22d3ee",
  },
];

/** Level 2 zones — same rectangle scheme, used for floors and the HUD label. */
export const ROOMS_L2: Room[] = [
  {
    id: "l2-mezz",
    name: "Mezzanine",
    rect: [minX, maxX, MEZZ.z0, MEZZ.z1],
    floor: "wood",
    accent: "#38bdf8",
  },
  {
    id: "l2-corridor",
    name: "Upper Gallery",
    rect: [-4, 4, minZ, MEZZ.z0],
    floor: "corridor",
    accent: "#94a3b8",
  },
  {
    id: "l2-west",
    name: "Leadership — West",
    rect: [minX, -4, minZ, MEZZ.z0],
    floor: "wood",
    accent: "#818cf8",
  },
  {
    id: "l2-east",
    name: "Executive — East",
    rect: [4, maxX, minZ, MEZZ.z0],
    floor: "lounge",
    accent: "#22d3ee",
  },
];

/**
 * Which room (name) a world position is in — used for the HUD label. `y` picks
 * the storey; pods win over the zone they sit inside.
 */
export function roomAt(x: number, z: number, y = 0): string {
  if (z > INTERIOR.maxZ) return "Courtyard";
  const level: 1 | 2 = y > L2_Y - 1.2 ? 2 : 1;
  for (const p of PODS) {
    if (p.level !== level) continue;
    const [x0, x1, z0, z1] = p.rect;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return p.name;
  }
  for (const r of level === 2 ? ROOMS_L2 : ROOMS) {
    const [x0, x1, z0, z1] = r.rect;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return r.name;
  }
  return "Hive Campus";
}

// ============================================================================
// STRUCTURE — columns
// ============================================================================
/** Structural columns (also colliders). Placed clear of desks and tables. */
export const COLUMNS: Vec2[] = [
  [-18, 16],
  [18, 16],
  [-18, 20.5],
  [18, 20.5],
  [-20, 0],
  [21, 2],
  [21, -8],
];
export const COLUMN_W = 0.52;

// ============================================================================
// FURNITURE PLACEMENT
// ============================================================================

// --- Engineering workspace: rows of desks (x[-34,-4] z[0,12]) --------------
export const DESKS: TransformData[] = (() => {
  const out: TransformData[] = [];
  const rows = [3, 6.5, 10];
  const cols = [-30, -26, -22, -18, -12, -8];
  rows.forEach((z, r) => {
    cols.forEach((x) => {
      out.push({
        position: [x, 0, z],
        rotation: [0, r % 2 === 0 ? 0 : Math.PI, 0],
      });
    });
  });
  return out;
})();

export const DESK_CHAIRS: TransformData[] = DESKS.map((d) => {
  const facing = d.rotation ? d.rotation[1] : 0;
  const dz = facing === 0 ? 0.85 : -0.85;
  return {
    position: [d.position[0], 0, d.position[2] + dz],
    rotation: d.rotation,
  };
});

export const MONITORS: TransformData[] = DESKS.map((d) => {
  const facing = d.rotation ? d.rotation[1] : 0;
  const dz = facing === 0 ? -0.28 : 0.28;
  return {
    position: [d.position[0], 0, d.position[2] + dz],
    rotation: d.rotation,
  };
});

// --- Cafeteria dining tables (round) + stools ------------------------------
export const CAFE_TABLES: TransformData[] = (() => {
  const out: TransformData[] = [];
  for (const x of [14, 19, 24, 30]) {
    for (const z of [8.5, 11]) out.push({ position: [x, 0, z] });
  }
  return out;
})();

export const CAFE_STOOLS: TransformData[] = CAFE_TABLES.flatMap((t) => {
  const [x, , z] = t.position;
  return [
    { position: [x - 0.95, 0, z] as Vec3 },
    { position: [x + 0.95, 0, z] as Vec3 },
  ];
});

/** Long communal bench table in the cafeteria. */
export const CAFE_BENCH_TABLES: TransformData[] = [
  { position: [22, 0, 4.5], rotation: [0, 0, 0] },
];

// --- Meeting rooms: two conference tables (split at x = 19) -----------------
export const MEETING_TABLES: TransformData[] = [
  { position: [11.5, 0, -3], rotation: [0, Math.PI / 2, 0] },
  { position: [26.5, 0, -3], rotation: [0, Math.PI / 2, 0] },
];

export const MEETING_CHAIRS: TransformData[] = MEETING_TABLES.flatMap((t) => {
  const [x, , z] = t.position;
  const out: TransformData[] = [];
  for (const dz of [-1.6, 0, 1.6]) {
    out.push({ position: [x - 1.4, 0, z + dz], rotation: [0, Math.PI / 2, 0] });
    out.push({
      position: [x + 1.4, 0, z + dz],
      rotation: [0, -Math.PI / 2, 0],
    });
  }
  return out;
});

// --- Lounge: sofas + coffee tables (x[-34,-4] z[-20,0]) --------------------
export const LOUNGE_SOFAS: TransformData[] = [
  { position: [-28, 0, -10], rotation: [0, 0, 0] },
  { position: [-28, 0, -13.5], rotation: [0, Math.PI, 0] },
  { position: [-13, 0, -6], rotation: [0, -Math.PI / 2, 0] },
  { position: [-13, 0, -12], rotation: [0, -Math.PI / 2, 0] },
  { position: [-21, 0, -17.5], rotation: [0, Math.PI, 0] },
];
export const LOUNGE_TABLES: TransformData[] = [
  { position: [-28, 0, -11.75] },
  { position: [-15.5, 0, -9] },
  { position: [-21, 0, -16] },
];

/** Soft rugs anchoring the lounge seating clusters: [x, z, w, d]. */
export const RUGS: [number, number, number, number][] = [
  [-28, -11.75, 6.5, 5.5],
  [-14.5, -9, 5.5, 8],
  [-21, -16.6, 6, 4.5],
];

// --- Server racks (AI lab) --------------------------------------------------
export const SERVER_RACKS: TransformData[] = (() => {
  const out: TransformData[] = [];
  for (const z of [-17.6, -11.6]) {
    for (let i = 0; i < 8; i++)
      out.push({ position: [9 + i * 2.7, 0, z], rotation: [0, 0, 0] });
  }
  return out;
})();

// --- Greenery: potted plants throughout ------------------------------------
export const PLANTS: TransformData[] = [
  { position: [-32, 0, 20] },
  { position: [32, 0, 20] },
  { position: [-6, 0, 19] },
  { position: [6, 0, 19] },
  { position: [-4.8, 0, 6] },
  { position: [4.8, 0, 6] },
  { position: [-4.8, 0, -6] },
  { position: [4.8, 0, -6] },
  { position: [-33, 0, 2] },
  { position: [-33, 0, -2] },
  { position: [12, 0, 5.5] },
  { position: [32, 0, 10.5] },
  { position: [-13, 0, 11] },
  { position: [-31, 0, 11] },
  { position: [1.5, 0, 11] },
  { position: [-1.5, 0, 11] },
  { position: [-33, 0, -19] },
  { position: [33, 0, -19] },
  { position: [16, 0, 1] },
  { position: [31, 0, 1] },
];

// --- Wall-mounted displays --------------------------------------------------
export interface WallPanel {
  position: Vec3;
  rotation: Vec3;
  size: [number, number]; // width, height
  variant: "a" | "b" | "c";
}

export const TV_PANELS: WallPanel[] = [
  // Reception video wall (faces the entrance, +Z)
  {
    position: [10.5, 1.95, 17.72],
    rotation: [0, 0, 0],
    size: [6, 2.7],
    variant: "a",
  },
  // Meeting rooms — screen on the north end wall, facing +Z into the room
  {
    position: [11.5, 1.7, -7.7],
    rotation: [0, 0, 0],
    size: [3.4, 1.9],
    variant: "b",
  },
  {
    position: [26.5, 1.7, -7.7],
    rotation: [0, 0, 0],
    size: [3.4, 1.9],
    variant: "c",
  },
  // AI lab mission-control wall on the north exterior wall
  {
    position: [11, 2.25, -19.6],
    rotation: [0, 0, 0],
    size: [4.2, 2.3],
    variant: "c",
  },
  {
    position: [17.5, 2.25, -19.6],
    rotation: [0, 0, 0],
    size: [4.2, 2.3],
    variant: "a",
  },
  {
    position: [24, 2.25, -19.6],
    rotation: [0, 0, 0],
    size: [4.2, 2.3],
    variant: "b",
  },
  // Cafeteria
  {
    position: [29, 2.05, 2.25],
    rotation: [0, 0, 0],
    size: [2.9, 1.7],
    variant: "a",
  },
  // Workspace: west wall + divider
  {
    position: [-33.65, 1.95, 6],
    rotation: [0, Math.PI / 2, 0],
    size: [3.2, 1.8],
    variant: "b",
  },
  {
    position: [-28, 1.8, 0.2],
    rotation: [0, 0, 0],
    size: [3, 1.7],
    variant: "c",
  },
  // Lounge
  {
    position: [-33.65, 1.85, -10],
    rotation: [0, Math.PI / 2, 0],
    size: [3.4, 1.9],
    variant: "a",
  },
];

export const WHITEBOARDS: WallPanel[] = [
  {
    position: [11.5, 1.65, 1.78],
    rotation: [0, Math.PI, 0],
    size: [3.2, 1.7],
    variant: "a",
  },
  {
    position: [26.5, 1.65, 1.78],
    rotation: [0, Math.PI, 0],
    size: [3.2, 1.7],
    variant: "a",
  },
  {
    position: [-4.25, 1.65, 10],
    rotation: [0, -Math.PI / 2, 0],
    size: [3, 1.6],
    variant: "a",
  },
  {
    position: [-4.25, 1.65, -13],
    rotation: [0, -Math.PI / 2, 0],
    size: [3, 1.6],
    variant: "a",
  },
];

/** Backlit room signage: position, facing, label colour. */
export interface RoomSign {
  position: Vec3;
  rotation: Vec3;
  accent: string;
}
// Signs sit on the corridor face of the corridor walls, beside each doorway.
export const ROOM_SIGNS: RoomSign[] = [
  {
    position: [-3.8, 2.45, 3.4],
    rotation: [0, Math.PI / 2, 0],
    accent: "#818cf8",
  }, // workspace
  {
    position: [-3.8, 2.45, -5.4],
    rotation: [0, Math.PI / 2, 0],
    accent: "#f59e0b",
  }, // lounge
  {
    position: [3.8, 2.45, 4.4],
    rotation: [0, -Math.PI / 2, 0],
    accent: "#fb923c",
  }, // cafeteria
  {
    position: [3.8, 2.45, -3.6],
    rotation: [0, -Math.PI / 2, 0],
    accent: "#34d399",
  }, // meeting
  {
    position: [3.8, 2.45, -10.4],
    rotation: [0, -Math.PI / 2, 0],
    accent: "#22d3ee",
  }, // ai lab
];

// --- Acoustic ceiling baffles (workspace + lounge) --------------------------
export interface Baffle {
  position: Vec3;
  length: number;
  axis: "x" | "z";
}
export const BAFFLES: Baffle[] = (() => {
  const out: Baffle[] = [];
  // Hung just under the level 1 suspended ceiling (CEILING_Y = 3.6).
  for (const z of [1.6, 4.6, 8, 11.4])
    out.push({ position: [-19, 3.18, z], length: 28, axis: "x" });
  for (const z of [-4, -8, -14, -18])
    out.push({ position: [-19, 3.18, z], length: 28, axis: "x" });
  return out;
})();

// --- Timber slat feature walls: [x, z, length, axis, facing] ----------------
export interface SlatWall {
  position: Vec3;
  length: number;
  axis: "x" | "z";
}
// Mounted on the thick exterior side walls (surface at x = ±33.8).
export const SLAT_WALLS: SlatWall[] = [
  { position: [-33.74, 0, -15], length: 8, axis: "z" }, // lounge west
  { position: [-33.74, 0, 7], length: 7, axis: "z" }, // workspace west
  { position: [-33.74, 0, 17], length: 8, axis: "z" }, // lobby west
  { position: [33.74, 0, 17], length: 8, axis: "z" }, // lobby east
];

// --- Phone booths (small glass focus pods) ----------------------------------
export const PHONE_BOOTHS: TransformData[] = [
  { position: [-5.6, 0, -18.4], rotation: [0, 0, 0] },
  { position: [-5.6, 0, -15.9], rotation: [0, 0, 0] },
  { position: [5.6, 0, -18.4], rotation: [0, 0, 0] },
];

// --- Storage / equipment ---------------------------------------------------
/** Low credenza / shelving runs: [x, z, width, depth, rotationY]. */
export const CREDENZAS: [number, number, number, number, number][] = [
  [-20, 11.4, 8, 0.55, 0], // workspace, backs onto the lobby edge
  [-30, -19.4, 6, 0.55, 0], // lounge, against the north wall
  [14, 2.45, 6, 0.55, 0], // cafeteria, against the z=2 divider
];
/** Printer / utility stations (against the corridor wall). */
export const PRINTERS: Vec2[] = [
  [-4.8, 9.4],
  [-4.8, 3.2],
];
/** Cafeteria tall units / fridges against the east wall: [x, z, rotationY]. */
export const FRIDGES: [number, number, number][] = [
  [33.3, 8, -Math.PI / 2],
  [33.3, 9.1, -Math.PI / 2],
];

/** Water dispenser against the cafeteria east wall: [x, z]. */
export const WATER_COOLER: Vec2 = [32.9, 7.0];

// --- Courtyard -------------------------------------------------------------
export const COURT_TREES: TransformData[] = [
  { position: [-26, 0, 27] },
  { position: [26, 0, 27] },
  { position: [-26, 0, 34] },
  { position: [26, 0, 34] },
  { position: [-26, 0, 41] },
  { position: [26, 0, 41] },
  { position: [-14, 0, 43] },
  { position: [14, 0, 43] },
];
export const COURT_BENCHES: TransformData[] = [
  { position: [-10, 0, 30], rotation: [0, Math.PI / 2, 0] },
  { position: [10, 0, 30], rotation: [0, -Math.PI / 2, 0] },
  { position: [-10, 0, 38], rotation: [0, Math.PI / 2, 0] },
  { position: [10, 0, 38], rotation: [0, -Math.PI / 2, 0] },
];
/** Raised planting beds: [x, z, w, d]. */
export const COURT_PLANTERS: [number, number, number, number][] = [
  [-18, 28, 8, 3],
  [18, 28, 8, 3],
  [-18, 40, 8, 3],
  [18, 40, 8, 3],
];
/** Lamp posts (also emit a small point light). */
export const COURT_LAMPS: Vec2[] = [
  [-12, 26],
  [12, 26],
  [-12, 34],
  [12, 34],
  [-12, 42],
  [12, 42],
];

// ============================================================================
// NEIGHBOURHOOD — facade-only mid-rise blocks filling the land around us.
// Sealed (never enterable), but modelled with real glazing, entrances,
// setbacks and signage so the block reads as a city, not a backdrop.
// ============================================================================
export interface Neighbor {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Facade glazing density (picks one of three window textures). */
  style: 0 | 1 | 2;
  ry: number;
  /** Which face carries the entrance + canopy. */
  entrance: "n" | "s" | "e" | "w";
  /** Inset of the upper volume; 0 means a single extruded mass. */
  setback: number;
  /** Fraction of the height where the setback happens. */
  setbackAt: number;
}

const N = (
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  style: 0 | 1 | 2,
  entrance: "n" | "s" | "e" | "w",
  ry = 0,
  setback = 0,
  setbackAt = 0.62,
): Neighbor => ({ x, z, w, d, h, style, ry, entrance, setback, setbackAt });

export const NEIGHBORS: Neighbor[] = [
  // --- Across the service road, facing our plaza ---------------------------
  N(-96, 80, 30, 26, 34, 0, "n", 0, 3.5),
  N(-56, 78, 26, 24, 26, 1, "n"),
  N(-18, 83, 32, 28, 47, 2, "n", 0, 4.5, 0.58),
  N(22, 78, 28, 24, 31, 0, "n"),
  N(62, 82, 34, 30, 41, 1, "n", 0, 4),
  N(100, 78, 26, 24, 23, 2, "n"),
  // --- Flanking the block, west -------------------------------------------
  N(-72, 30, 26, 34, 29, 1, "e"),
  N(-72, -8, 26, 32, 22, 2, "e"),
  N(-77, -50, 30, 34, 33, 0, "e", 0, 3),
  // --- Flanking the block, east -------------------------------------------
  N(72, 30, 26, 34, 26, 2, "w"),
  N(72, -8, 26, 32, 31, 0, "w"),
  N(77, -50, 30, 34, 24, 1, "w"),
  // --- Behind us, north ----------------------------------------------------
  N(-24, -68, 34, 28, 37, 2, "s", 0, 4),
  N(20, -70, 30, 26, 29, 0, "s"),
  N(58, -72, 26, 24, 21, 1, "s"),
  // --- Further out, blending into the skyline ------------------------------
  N(-132, 20, 34, 38, 63, 1, "e", 0, 5, 0.55),
  N(132, 8, 34, 38, 57, 2, "w", 0, 5, 0.55),
  N(-140, -84, 38, 34, 52, 0, "s"),
  N(140, -90, 38, 34, 46, 1, "s"),
];

/** Street centre-lines, so paving and neighbours agree on the block layout. */
export const STREETS = {
  /** East–west service road in front of the plaza. */
  frontZ: 60,
  /** North–south side streets flanking the block. */
  sideX: 48,
  width: 9,
};

// ============================================================================
// LIGHTING PLACEMENT
// ============================================================================
/** Recessed linear ceiling runs — flush with the suspended ceiling. */
export interface CeilingRun {
  position: Vec3;
  length: number;
  axis: "x" | "z";
  warm: boolean;
}
const CY = CEILING_Y - 0.04;
export const CEILING_RUNS: CeilingRun[] = [
  // Workspace
  { position: [-20, CY, 3], length: 26, axis: "x", warm: false },
  { position: [-20, CY, 6.5], length: 26, axis: "x", warm: false },
  { position: [-20, CY, 10], length: 26, axis: "x", warm: false },
  // Lounge
  { position: [-19, CY, -5], length: 28, axis: "x", warm: true },
  { position: [-19, CY, -11], length: 28, axis: "x", warm: true },
  { position: [-19, CY, -17], length: 28, axis: "x", warm: true },
  // Corridor / atrium
  { position: [0, CY, -4], length: 30, axis: "z", warm: false },
  // Cafeteria
  { position: [19, CY, 5], length: 28, axis: "x", warm: true },
  { position: [19, CY, 9.5], length: 28, axis: "x", warm: true },
  // Meeting rooms
  { position: [11.5, CY, -3], length: 7, axis: "z", warm: false },
  { position: [26.5, CY, -3], length: 7, axis: "z", warm: false },
  // AI lab
  { position: [19, CY, -10.5], length: 28, axis: "x", warm: false },
  { position: [19, CY, -14.5], length: 28, axis: "x", warm: false },
  { position: [19, CY, -18.5], length: 28, axis: "x", warm: false },
];

/** Pendant fixtures suspended from the roof in the double-height lobby. */
export const LOBBY_PENDANTS: Vec3[] = [
  [-24, 0, 16],
  [-12, 0, 16],
  [0, 0, 16],
  [12, 0, 16],
  [24, 0, 16],
  [-24, 0, 20.5],
  [-12, 0, 20.5],
  [0, 0, 20.5],
  [12, 0, 20.5],
  [24, 0, 20.5],
];

/** Pendants over cafeteria tables + coffee island. */
export const CAFE_PENDANTS: Vec3[] = [
  ...CAFE_TABLES.map((t) => [t.position[0], 0, t.position[2]] as Vec3),
  [28.5, 0, 5.2],
  [22, 0, 4.5],
];

// --- Accent point lights (warm/cool pools) ---------------------------------
export interface AccentLight {
  position: Vec3;
  color: string;
  intensity: number;
  distance: number;
}
export const ACCENT_LIGHTS: AccentLight[] = [
  { position: [0, 5.6, 18], color: "#fff2d6", intensity: 40, distance: 26 }, // lobby warm (double height)
  { position: [22, 3.3, 8], color: "#ffe4bf", intensity: 24, distance: 16 }, // cafeteria
  { position: [-22, 3.3, -10], color: "#ffdca8", intensity: 22, distance: 16 }, // lounge
  { position: [16, 3.3, -14], color: "#8fd8ff", intensity: 28, distance: 19 }, // ai lab cool
  { position: [11.5, 2.9, -3], color: "#eaf2ff", intensity: 16, distance: 12 }, // meeting
  { position: [26.5, 2.9, -3], color: "#eaf2ff", intensity: 16, distance: 12 }, // meeting
  { position: [-20, 3.3, 6], color: "#eef4ff", intensity: 18, distance: 16 }, // workspace
  { position: [0, 3.2, 0], color: "#f4f7ff", intensity: 14, distance: 14 }, // atrium
];

// ============================================================================
// LEVEL 2 FURNITURE + LIGHTING
// ============================================================================

/** Open-plan senior desks on the upper deck (west wing + east strip). */
export const L2_DESKS: TransformData[] = (() => {
  const out: TransformData[] = [];
  const push = (x: number, z: number, r: number) =>
    out.push({ position: [x, L2_Y, z], rotation: [0, r, 0] });
  // West wing, south of the manager offices.
  [-11.8, -8.4].forEach((z, r) =>
    [-31, -27, -23, -19, -15, -11].forEach((x) =>
      push(x, z, r % 2 === 0 ? 0 : Math.PI),
    ),
  );
  // West wing, open collaboration bay.
  [4.5, 8].forEach((z, r) =>
    [-31, -27, -23, -19, -15, -11].forEach((x) =>
      push(x, z, r % 2 === 0 ? 0 : Math.PI),
    ),
  );
  // East wing, between the boardroom and the private offices.
  [-10.4].forEach(() =>
    [9, 13, 17, 21, 25, 29].forEach((x) => push(x, -10.4, 0)),
  );
  // East wing, south open bay.
  [1.5, 5].forEach((z, r) =>
    [9, 13, 17, 21, 25, 29].forEach((x) =>
      push(x, z, r % 2 === 0 ? 0 : Math.PI),
    ),
  );
  return out;
})();

export const L2_DESK_CHAIRS: TransformData[] = L2_DESKS.map((d) => {
  const facing = d.rotation ? d.rotation[1] : 0;
  return {
    position: [
      d.position[0],
      L2_Y,
      d.position[2] + (facing === 0 ? 0.85 : -0.85),
    ],
    rotation: d.rotation,
  };
});

export const L2_MONITORS: TransformData[] = L2_DESKS.map((d) => {
  const facing = d.rotation ? d.rotation[1] : 0;
  return {
    position: [
      d.position[0],
      L2_Y,
      d.position[2] + (facing === 0 ? -0.28 : 0.28),
    ],
    rotation: d.rotation,
  };
});

/** One executive desk per private office, centred in the pod's north half. */
export const POD_DESKS: TransformData[] = PODS.filter(
  (p) => p.kind === "manager" || p.kind === "corner",
).map((p) => {
  const [x0, x1, z0, z1] = p.rect;
  const flip = p.door.side === "n";
  return {
    position: [
      (x0 + x1) / 2,
      p.level === 2 ? L2_Y : 0,
      flip ? z1 - (z1 - z0) * 0.32 : z0 + (z1 - z0) * 0.32,
    ],
    rotation: [0, flip ? Math.PI : 0, 0],
  };
});

/** Boardroom / huddle tables, derived so they always sit inside their pod. */
export const POD_TABLES: { pod: Pod; center: Vec3; size: Vec2 }[] = PODS.filter(
  (p) => p.kind === "board" || p.kind === "huddle" || p.kind === "focus",
).map((p) => {
  const [x0, x1, z0, z1] = p.rect;
  const w = x1 - x0;
  const d = z1 - z0;
  return {
    pod: p,
    center: [(x0 + x1) / 2, p.level === 2 ? L2_Y : 0, (z0 + z1) / 2],
    size: [Math.min(w - 1.6, d > w ? w - 1.6 : 6.4), Math.min(d - 1.6, 1.6)],
  };
});

/** Mezzanine breakout: soft seating looking down into the atrium. */
export const L2_SOFAS: TransformData[] = [
  { position: [-9, L2_Y, 14.2], rotation: [0, Math.PI, 0] },
  { position: [9, L2_Y, 14.2], rotation: [0, Math.PI, 0] },
  { position: [22, L2_Y, 14.2], rotation: [0, Math.PI, 0] },
];
export const L2_TABLES: TransformData[] = L2_SOFAS.map((s) => ({
  position: [s.position[0], L2_Y, s.position[2] - 1.5],
}));
export const L2_PLANTS: TransformData[] = [
  { position: [-4.9, L2_Y, 14.6] },
  { position: [4.9, L2_Y, 14.6] },
  { position: [-33, L2_Y, 10.6] },
  { position: [33, L2_Y, 10.6] },
  { position: [-5.2, L2_Y, -1] },
  { position: [5.2, L2_Y, -1] },
  { position: [33, L2_Y, -10.4] },
  { position: [-33, L2_Y, -11.6] },
];

const CY2 = CEILING_Y2 - 0.04;
export const CEILING_RUNS_L2: CeilingRun[] = [
  { position: [-20, CY2, -11.8], length: 26, axis: "x", warm: false },
  { position: [-20, CY2, -8.4], length: 26, axis: "x", warm: false },
  { position: [-20, CY2, 4.5], length: 26, axis: "x", warm: false },
  { position: [-20, CY2, 8], length: 26, axis: "x", warm: false },
  { position: [0, CY2, -4], length: 30, axis: "z", warm: false },
  { position: [19, CY2, -10.4], length: 28, axis: "x", warm: false },
  { position: [19, CY2, 1.5], length: 28, axis: "x", warm: true },
  { position: [19, CY2, 5], length: 28, axis: "x", warm: true },
  { position: [0, CY2, 14], length: 64, axis: "x", warm: true },
];

/** One recessed downlight strip per pod, at that pod's ceiling. */
export const POD_LIGHTS: { position: Vec3; length: number; warm: boolean }[] =
  PODS.map((p) => {
    const [x0, x1, z0, z1] = p.rect;
    const base = p.level === 2 ? L2_Y : 0;
    return {
      position: [(x0 + x1) / 2, base + POD_H - 0.12, (z0 + z1) / 2],
      length: Math.max(1.2, (x1 - x0) * 0.7),
      warm: p.kind === "corner" || p.kind === "huddle",
    };
  });

export const ACCENT_LIGHTS_L2: AccentLight[] = [
  {
    position: [-20, L2_Y + 2.6, -10],
    color: "#eef4ff",
    intensity: 22,
    distance: 17,
  },
  {
    position: [-20, L2_Y + 2.6, 6],
    color: "#eef4ff",
    intensity: 22,
    distance: 17,
  },
  {
    position: [15, L2_Y + 2.6, -16],
    color: "#cfeaff",
    intensity: 20,
    distance: 17,
  },
  {
    position: [19, L2_Y + 2.6, 3],
    color: "#ffe8c6",
    intensity: 20,
    distance: 17,
  },
  {
    position: [29.5, L2_Y + 2.2, -16],
    color: "#ffd9e6",
    intensity: 14,
    distance: 12,
  },
  {
    position: [0, L2_Y + 2.2, 14],
    color: "#fff2d6",
    intensity: 22,
    distance: 18,
  },
];

// ============================================================================
// COLLIDER DERIVATION
// ============================================================================
export function wallBox(w: Wall): Box3Spec {
  const horizontal = Math.abs(w.z1 - w.z0) < 1e-6;
  let xmin: number, xmax: number, zmin: number, zmax: number;
  if (horizontal) {
    xmin = Math.min(w.x0, w.x1);
    xmax = Math.max(w.x0, w.x1);
    zmin = w.z0 - w.t / 2;
    zmax = w.z0 + w.t / 2;
  } else {
    xmin = w.x0 - w.t / 2;
    xmax = w.x0 + w.t / 2;
    zmin = Math.min(w.z0, w.z1);
    zmax = Math.max(w.z0, w.z1);
  }
  const y0 = w.base ?? 0;
  return { min: [xmin, y0, zmin], max: [xmax, y0 + w.h, zmax] };
}

/** Flattens to XZ but keeps the vertical band, so storeys don't block each other. */
const box2 = (b: Box3Spec): AABB => ({
  min: [b.min[0], b.min[2]],
  max: [b.max[0], b.max[2]],
  y0: b.min[1],
  y1: b.max[1],
});

const rect = (
  cx: number,
  cz: number,
  hw: number,
  hd: number,
  y0?: number,
  y1?: number,
): AABB => ({
  min: [cx - hw, cz - hd],
  max: [cx + hw, cz + hd],
  y0,
  y1,
});

/**
 * Big furniture footprints the player should not walk through. Each carries the
 * vertical band it blocks, so level 1 furniture never obstructs level 2.
 */
export const SOLID_PROPS: AABB[] = [
  // Reception desk (east side of lobby — central path stays clear)
  { min: [5.5, 15.2], max: [15.5, 17], y0: 0, y1: 1.2 },
  // Reception backdrop wall
  { min: [4.6, 17.9], max: [16.4, 18.5], y0: 0, y1: 3.6 },
  // Cafeteria service counter
  { min: [6, 3], max: [9, 11], y0: 0, y1: 1.2 },
  // Coffee-bar island
  { min: [26, 4.2], max: [31, 6.2], y0: 0, y1: 1.1 },
  // Communal bench table
  rect(22, 4.5, 1.5, 0.9, 0, 0.8),
  // Server racks (AI lab) — two rows
  { min: [8, -18.4], max: [28.6, -16.8], y0: 0, y1: 2.1 },
  { min: [8, -12.4], max: [28.6, -10.8], y0: 0, y1: 2.1 },
];

function propBoxes(
  items: TransformData[],
  hw: number,
  hd: number,
  base = 0,
  top = 1.2,
): AABB[] {
  return items.map((it) =>
    rect(it.position[0], it.position[2], hw, hd, base, base + top),
  );
}

// ============================================================================
// DERIVED COLLIDER LISTS (consumed by controller + camera)
// ============================================================================
const interiorWallBoxes = WALLS.map(wallBox);
const l2WallBoxes = [
  ...WALLS_L2,
  ...POD_WALLS,
  ...BALUSTRADES,
  ...STAIR_GUARDS,
].map(wallBox);
const barrierBoxes = COURTYARD_BARRIERS.map(wallBox);

const columnBoxes: AABB[] = COLUMNS.map(([x, z]) =>
  rect(x, z, COLUMN_W / 2 + 0.05, COLUMN_W / 2 + 0.05, 0, EXT_H),
);
const boothBoxes: AABB[] = PHONE_BOOTHS.map((b) =>
  rect(b.position[0], b.position[2], 0.75, 0.75, 0, 2.3),
);
const credenzaBoxes: AABB[] = CREDENZAS.map(([x, z, w, d]) =>
  rect(x, z, w / 2, d / 2, 0, 0.8),
);
const planterBoxes: AABB[] = COURT_PLANTERS.map(([x, z, w, d]) =>
  rect(x, z, w / 2, d / 2, 0, 0.6),
);
const fridgeBoxes: AABB[] = FRIDGES.map(([x, z]) =>
  rect(x, z, 0.4, 0.5, 0, 1.9),
);
const coolerBoxes: AABB[] = [
  rect(WATER_COOLER[0], WATER_COOLER[1], 0.28, 0.34, 0, 1.7),
];
const podTableBoxes: AABB[] = POD_TABLES.map((t) =>
  rect(
    t.center[0],
    t.center[2],
    t.size[0] / 2,
    t.size[1] / 2 + 0.7,
    t.center[1],
    t.center[1] + 0.9,
  ),
);

/**
 * XZ boxes the player capsule cannot pass through. Each carries the vertical
 * band it blocks (`y0`/`y1`), so the controller can ignore level 1 partitions
 * while the player is walking around upstairs and vice versa.
 */
export const PLAYER_COLLIDERS: AABB[] = [
  ...interiorWallBoxes.map(box2),
  ...l2WallBoxes.map(box2),
  ...barrierBoxes.map(box2),
  ...SOLID_PROPS,
  ...columnBoxes,
  ...boothBoxes,
  ...credenzaBoxes,
  ...planterBoxes,
  ...fridgeBoxes,
  ...coolerBoxes,
  ...podTableBoxes,
  ...propBoxes(MEETING_TABLES, 1.5, 2.5),
  ...propBoxes(DESKS, 1.0, 0.55),
  ...propBoxes(LOUNGE_TABLES, 0.8, 0.5),
  ...propBoxes(CAFE_TABLES, 0.85, 0.85),
  ...propBoxes(LOUNGE_SOFAS, 1.0, 0.5),
  ...propBoxes(L2_DESKS, 1.0, 0.55, L2_Y),
  ...propBoxes(POD_DESKS, 1.0, 0.55, L2_Y),
  ...propBoxes(L2_SOFAS, 1.0, 0.5, L2_Y),
  ...propBoxes(L2_TABLES, 0.8, 0.5, L2_Y),
];

/** Full-height boxes the camera should not clip through (interior walls only). */
export const CAMERA_COLLIDERS: Box3Spec[] = [
  ...interiorWallBoxes,
  ...COLUMNS.map(([x, z]) => ({
    min: [x - COLUMN_W / 2, 0, z - COLUMN_W / 2] as Vec3,
    max: [x + COLUMN_W / 2, EXT_H, z + COLUMN_W / 2] as Vec3,
  })),
  // The level 2 slab, so the camera can't drop through the floor upstairs.
  ...DECKS.map((d) => ({
    min: [d.x0, d.y - SLAB_T, d.z0] as Vec3,
    max: [d.x1, d.y, d.z1] as Vec3,
  })),
];
