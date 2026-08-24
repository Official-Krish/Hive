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

/** Axis-aligned box in XZ only — used for player movement collision. */
export interface AABB {
  min: Vec2;
  max: Vec2;
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
}

// --- Global dimensions ------------------------------------------------------
// NOTE: CEILING_Y must stay BELOW EXT_H, otherwise the suspended ceiling pokes
// above the exterior walls and the building reads as roofless.
export const EXT_H = 5.4; // exterior wall / facade height
export const ROOF_T = 0.34; // roof slab thickness (sits on top of EXT_H)
export const PARAPET_H = 0.95; // parapet above the roof slab
export const CEILING_Y = 5.05; // suspended ceiling in the wings + corridor
export const INT_H = 3.4; // interior partitions
export const GLASS_H = 3.4; // interior glazed partitions
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
): Wall => ({
  x0,
  z0,
  x1,
  z1,
  kind,
  h: h ?? (kind === "glass" ? GLASS_H : kind === "hedge" ? HEDGE_H : INT_H),
  t,
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
// ROOMS — rectangles for floors, room detection and signage.
// ============================================================================
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

/** Which room (name) a world XZ position is in — used for the HUD label. */
export function roomAt(x: number, z: number): string {
  if (z > INTERIOR.maxZ) return "Courtyard";
  for (const r of ROOMS) {
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
  for (const z of [1.6, 4.6, 8, 11.4])
    out.push({ position: [-19, 4.35, z], length: 28, axis: "x" });
  for (const z of [-4, -8, -14, -18])
    out.push({ position: [-19, 4.35, z], length: 28, axis: "x" });
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
  { position: [0, 4.2, 18], color: "#fff2d6", intensity: 30, distance: 20 }, // lobby warm
  { position: [22, 3.6, 8], color: "#ffe4bf", intensity: 24, distance: 16 }, // cafeteria
  { position: [-22, 3.6, -10], color: "#ffdca8", intensity: 22, distance: 16 }, // lounge
  { position: [16, 3.6, -14], color: "#8fd8ff", intensity: 28, distance: 19 }, // ai lab cool
  { position: [11.5, 3.1, -3], color: "#eaf2ff", intensity: 16, distance: 12 }, // meeting
  { position: [26.5, 3.1, -3], color: "#eaf2ff", intensity: 16, distance: 12 }, // meeting
  { position: [-20, 3.6, 6], color: "#eef4ff", intensity: 18, distance: 16 }, // workspace
  { position: [0, 3.4, 0], color: "#f4f7ff", intensity: 14, distance: 14 }, // atrium
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
  return { min: [xmin, 0, zmin], max: [xmax, w.h, zmax] };
}

const box2 = (b: Box3Spec): AABB => ({
  min: [b.min[0], b.min[2]],
  max: [b.max[0], b.max[2]],
});

const rect = (cx: number, cz: number, hw: number, hd: number): AABB => ({
  min: [cx - hw, cz - hd],
  max: [cx + hw, cz + hd],
});

/** Big furniture footprints the player should not walk through (XZ AABBs). */
export const SOLID_PROPS: AABB[] = [
  // Reception desk (east side of lobby — central path stays clear)
  { min: [5.5, 15.2], max: [15.5, 17] },
  // Reception backdrop wall
  { min: [4.6, 17.9], max: [16.4, 18.5] },
  // Cafeteria service counter
  { min: [6, 3], max: [9, 11] },
  // Coffee-bar island
  { min: [26, 4.2], max: [31, 6.2] },
  // Communal bench table
  rect(22, 4.5, 1.5, 0.9),
  // Server racks (AI lab) — two rows
  { min: [8, -18.4], max: [28.6, -16.8] },
  { min: [8, -12.4], max: [28.6, -10.8] },
];

function propBoxes(items: TransformData[], hw: number, hd: number): AABB[] {
  return items.map((it) => rect(it.position[0], it.position[2], hw, hd));
}

// ============================================================================
// DERIVED COLLIDER LISTS (consumed by controller + camera)
// ============================================================================
const interiorWallBoxes = WALLS.map(wallBox);
const barrierBoxes = COURTYARD_BARRIERS.map(wallBox);

const columnBoxes: AABB[] = COLUMNS.map(([x, z]) =>
  rect(x, z, COLUMN_W / 2 + 0.05, COLUMN_W / 2 + 0.05),
);
const boothBoxes: AABB[] = PHONE_BOOTHS.map((b) =>
  rect(b.position[0], b.position[2], 0.75, 0.75),
);
const credenzaBoxes: AABB[] = CREDENZAS.map(([x, z, w, d]) =>
  rect(x, z, w / 2, d / 2),
);
const planterBoxes: AABB[] = COURT_PLANTERS.map(([x, z, w, d]) =>
  rect(x, z, w / 2, d / 2),
);
const fridgeBoxes: AABB[] = FRIDGES.map(([x, z]) => rect(x, z, 0.4, 0.5));

/** XZ boxes the player capsule cannot pass through. */
export const PLAYER_COLLIDERS: AABB[] = [
  ...interiorWallBoxes.map(box2),
  ...barrierBoxes.map(box2),
  ...SOLID_PROPS,
  ...columnBoxes,
  ...boothBoxes,
  ...credenzaBoxes,
  ...planterBoxes,
  ...fridgeBoxes,
  ...propBoxes(MEETING_TABLES, 1.5, 2.5),
  ...propBoxes(DESKS, 1.0, 0.55),
  ...propBoxes(LOUNGE_TABLES, 0.8, 0.5),
  ...propBoxes(CAFE_TABLES, 0.85, 0.85),
  ...propBoxes(LOUNGE_SOFAS, 1.0, 0.5),
];

/** Full-height boxes the camera should not clip through (interior walls only). */
export const CAMERA_COLLIDERS: Box3Spec[] = [
  ...interiorWallBoxes,
  ...COLUMNS.map(([x, z]) => ({
    min: [x - COLUMN_W / 2, 0, z - COLUMN_W / 2] as Vec3,
    max: [x + COLUMN_W / 2, CEILING_Y, z + COLUMN_W / 2] as Vec3,
  })),
];
