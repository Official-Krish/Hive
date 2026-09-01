import { DESKS, L2_DESKS, POD_DESKS, type Vec2 } from "./office/layout";

export type InteractableKind = "coffee" | "cooler" | "monitor" | "whiteboard";

export type InteractableIcon = "coffee" | "water" | "monitor" | "board";

export interface Interactable {
  id: string;
  kind: InteractableKind;
  /** World x/z of the standing point. */
  x: number;
  z: number;
  /** Floor level the player's feet must match (L2_Y for the upper deck). */
  y: number;
  radius: number;
  prompt: string;
  icon: InteractableIcon;
}

/** Water dispenser against the cafeteria east wall. */
export const WATER_COOLER: Vec2 = [32.9, 7.0];

/** Level 1 standing in front of the coffee-bar island (cafeteria). */
const COFFEE: Interactable = {
  id: "coffee-bar",
  kind: "coffee",
  x: 28.5,
  z: 6.6,
  y: 0,
  radius: 2.2,
  prompt: "Grab a coffee",
  icon: "coffee",
};

const COOLER: Interactable = {
  id: "water-cooler",
  kind: "cooler",
  x: WATER_COOLER[0] - 0.5,
  z: WATER_COOLER[1],
  y: 0,
  radius: 2.2,
  prompt: "Get some water",
  icon: "water",
};

/** Whiteboards hang on walls; the standing point sits ~1.2m off the face. */
const WHITEBOARD_SPOTS: Array<[number, number]> = [
  [11.5, 0.55], // meeting room divider (north face)
  [26.5, 0.55], // meeting room divider (north face)
  [-2.7, 10], // corridor west wall
  [-2.7, -13], // corridor west wall (south)
];

/** Every desk gets a "workspace" monitor you can lean in and use. */
function monitorSpots(): Interactable[] {
  return [...DESKS, ...L2_DESKS, ...POD_DESKS].map((d, i) => {
    const facing = d.rotation ? d.rotation[1] : 0;
    const dz = facing === 0 ? 1.05 : -1.05;
    return {
      id: `monitor-${i}`,
      kind: "monitor" as const,
      x: d.position[0],
      z: d.position[2] + dz,
      y: d.position[1],
      radius: 2.0,
      prompt: "Open workspace",
      icon: "monitor",
    };
  });
}

export const INTERACTABLES: Interactable[] = [
  COFFEE,
  COOLER,
  ...WHITEBOARD_SPOTS.map(([x, z], i): Interactable => ({
    id: `whiteboard-${i}`,
    kind: "whiteboard",
    x,
    z,
    y: 0,
    radius: 2.3,
    prompt: "Draw on whiteboard",
    icon: "board",
  })),
  ...monitorSpots(),
];

export function interactableById(id: string): Interactable | undefined {
  return INTERACTABLES.find((it) => it.id === id);
}
