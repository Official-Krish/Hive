import { ASSET_BASE_URL } from "@/lib/config";

/**
 * Kenney Furniture Kit (CC0) — model manifest.
 * Files are served from the CDN (`public/furniture-kit/` is the local
 * upload source, kept for reference — nothing loads from local public/).
 *
 * TO SERVE FROM LOCAL INSTEAD: flip KIT_BASE back to
 * "/furniture-kit/models_glb" (dev route in src/index.ts + dist copy in
 * build.ts still exist for that).
 *
 * Bounds were measured from the GLB accessor min/max (Y-up, meters):
 * the kit is dollhouse-scale (~0.5x our 1.8m desks), origins are inconsistent
 * (corner vs center, some Y offsets), so `KitInstances` auto-centers XZ and
 * auto-grounds Y at runtime. `scale` below brings each category up to office
 * scale; `yaw` fixes models that face away from the desk convention.
 */
export const KIT_BASE = `${ASSET_BASE_URL}/assets/furniture-kit/models_glb`;

export const KIT_MODELS = {
  desk: "desk.glb",
  taskChair: "chairDesk.glb",
  meetingChair: "chairModernFrameCushion.glb",
  screen: "computerScreen.glb",
  keyboard: "computerKeyboard.glb",
  mouse: "computerMouse.glb",
  cafeTable: "tableRound.glb",
  stool: "stoolBar.glb",
  coffeeTable: "tableCoffee.glb",
  coffeeTableAlt: "tableCoffeeSquare.glb",
  sideTable: "sideTable.glb",
  sofa: "loungeSofa.glb",
  sofaDesign: "loungeDesignSofa.glb",
  plant: "pottedPlant.glb",
  plantSmall: "plantSmall1.glb",
  bench: "bench.glb",
  fridgeLarge: "kitchenFridgeLarge.glb",
  fridgeSmall: "kitchenFridgeSmall.glb",
  coffeeMachine: "kitchenCoffeeMachine.glb",
  bookcaseLow: "bookcaseOpenLow.glb",
  trashcan: "trashcan.glb",
  floorLamp: "lampSquareFloor.glb",
  coatRack: "coatRackStanding.glb",
} as const;

export type KitModelKey = keyof typeof KIT_MODELS;

export const kitUrl = (key: KitModelKey): string =>
  `${KIT_BASE}/${KIT_MODELS[key]}`;

/** Uniform (or XYZ) scale bringing each kit model to office scale. */
export const KIT_SCALE: Record<KitModelKey, [number, number, number]> = {
  desk: [2.0, 2.0, 2.0],
  taskChair: [1.9, 1.9, 1.9],
  meetingChair: [2.2, 2.2, 2.2],
  screen: [1.4, 1.4, 1.4],
  keyboard: [1.4, 1.4, 1.4],
  mouse: [1.6, 1.6, 1.6],
  cafeTable: [2.0, 2.0, 2.0],
  stool: [1.6, 1.6, 1.6],
  coffeeTable: [1.8, 1.8, 1.8],
  coffeeTableAlt: [1.8, 1.8, 1.8],
  sideTable: [1.6, 1.6, 1.6],
  sofa: [1.8, 1.8, 1.8],
  sofaDesign: [1.8, 1.8, 1.8],
  plant: [1.6, 1.6, 1.6],
  plantSmall: [1.6, 1.6, 1.6],
  bench: [5.0, 1.4, 2.4],
  fridgeLarge: [1.4, 1.4, 1.4],
  fridgeSmall: [1.4, 1.4, 1.4],
  coffeeMachine: [1.6, 1.6, 1.6],
  bookcaseLow: [2.0, 1.8, 1.5],
  trashcan: [0.6, 0.6, 0.6],
  floorLamp: [1.8, 1.8, 1.8],
  coatRack: [1.6, 1.6, 1.6],
};

/**
 * Extra yaw (radians) applied on top of the layout rotation.
 * 0 until visually verified — if a category faces away from desks,
 * flip just that entry to Math.PI here (single-constant fix).
 */
export const KIT_YAW: Record<KitModelKey, number> = {
  desk: 0,
  // Kit chairs face away from desks at rest — flip them toward the desk.
  taskChair: Math.PI,
  meetingChair: Math.PI,
  screen: 0,
  keyboard: 0,
  mouse: 0,
  cafeTable: 0,
  stool: 0,
  coffeeTable: 0,
  coffeeTableAlt: 0,
  sideTable: 0,
  sofa: 0,
  sofaDesign: 0,
  plant: 0,
  plantSmall: 0,
  bench: 0,
  fridgeLarge: 0,
  fridgeSmall: 0,
  coffeeMachine: 0,
  bookcaseLow: 0,
  trashcan: 0,
  floorLamp: 0,
  coatRack: 0,
};

/** Every model preloaded at world start (all tiny, ~4–40KB each). */
export const KIT_PRELOAD: KitModelKey[] = [
  "desk",
  "taskChair",
  "meetingChair",
  "screen",
  "keyboard",
  "mouse",
  "cafeTable",
  "stool",
  "coffeeTable",
  "sideTable",
  "sofa",
  "sofaDesign",
  "plant",
  "plantSmall",
  "bench",
  "fridgeLarge",
  "fridgeSmall",
  "coffeeMachine",
  "bookcaseLow",
  "trashcan",
  "floorLamp",
  "coatRack",
];
