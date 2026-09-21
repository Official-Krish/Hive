import {
  DESKS,
  L2_DESKS,
  POD_DESKS,
  DESK_CHAIRS,
  MEETING_CHAIRS,
  L2_DESK_CHAIRS,
  WATER_COOLER,
  WALL_ART,
  GALLERY_FRAMES,
  PODIUM_MIC,
  L2_Y,
  PODIUM_STAGE,
  PODIUM_SCREEN_SPOT,
} from "./office/layout";
import { KIT_YAW } from "./office/kitManifest";
import type { TransformData } from "./InstancedFurniture";

export type InteractableKind =
  | "coffee"
  | "cooler"
  | "monitor"
  | "whiteboard"
  | "ci"
  | "chill-screen"
  | "arcade"
  | "vending"
  | "reviewer"
  | "fleet"
  | "reviewer-console"
  | "poster"
  | "gallery"
  | "podium"
  | "podium-screen";

export type InteractableIcon =
  | "coffee"
  | "water"
  | "monitor"
  | "board"
  | "ci"
  | "chill"
  | "arcade"
  | "vending"
  | "reviewer"
  | "fleet"
  | "art"
  | "mic";

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
export const WHITEBOARD_SPOTS: Array<[number, number]> = [
  [11.5, 0.55], // meeting room divider (north face)
  [26.5, 0.55], // meeting room divider (north face)
  [-5.7, 10], // corridor west wall — board faces west into the workspace
  [-5.7, -13], // corridor west wall — board faces west into the lounge
];

/**
 * Wall screens that host the "Build / CI" dashboard. Each entry is a standing
 * point in front of the screen face. Engineering zone: the workspace west wall,
 * the workspace divider, and the three AI-lab "mission-control" screens.
 */
const CI_SCREENS: Interactable[] = [
  {
    id: "ci-screen-westwall",
    kind: "ci",
    x: -32.2,
    z: 6,
    y: 0,
    radius: 2.6,
    prompt: "Engineering CI",
    icon: "ci",
  },
  {
    id: "ci-screen-divider",
    kind: "ci",
    x: -28,
    z: 1.7,
    y: 0,
    radius: 2.6,
    prompt: "Engineering CI",
    icon: "ci",
  },
  {
    id: "ci-screen-ailab-1",
    kind: "ci",
    x: 11,
    z: -16.4,
    y: 0,
    radius: 3.6,
    prompt: "Engineering CI",
    icon: "ci",
  },
  {
    id: "ci-screen-ailab-2",
    kind: "ci",
    x: 17.5,
    z: -16.4,
    y: 0,
    radius: 3.6,
    prompt: "Engineering CI",
    icon: "ci",
  },
  {
    id: "ci-screen-ailab-3",
    kind: "ci",
    x: 24,
    z: -16.4,
    y: 0,
    radius: 3.6,
    prompt: "Engineering CI",
    icon: "ci",
  },
];

/** The big Chill Space screen — stand in front of it and press E to control it. */
const CHILL_SCREEN: Interactable = {
  id: "chill-screen",
  kind: "chill-screen",
  x: -14,
  z: -17.2,
  y: 0,
  radius: 4.5,
  prompt: "Shared screen",
  icon: "chill",
};

/** Arcade station for the multiplayer games (coming soon). */
const ARCADE: Interactable = {
  id: "arcade",
  kind: "arcade",
  x: -7,
  z: -15,
  y: 0,
  radius: 2.6,
  prompt: "Multiplayer games",
  icon: "arcade",
};

/** API key vending machine in the engineering room's NW corner. */
const VENDING: Interactable = {
  id: "vending-machine",
  kind: "vending",
  x: -30.3,
  z: 1.2,
  y: 0,
  radius: 2.4,
  prompt: "API key vending",
  icon: "vending",
};

/** Reviewer teammate nook — E opens what the bot is doing. */
const REVIEWER: Interactable = {
  id: "reviewer-desk",
  kind: "reviewer",
  x: -5.5,
  z: 2.4,
  y: 0,
  radius: 2.2,
  prompt: "Reviewer activity",
  icon: "reviewer",
};

/** AI Lab fleet console — live agent sessions down the server aisle. */
const FLEET: Interactable = {
  id: "fleet-console",
  kind: "fleet",
  x: 28.5,
  z: -14.6,
  y: 0,
  radius: 2.6,
  prompt: "Agent fleet",
  icon: "fleet",
};

/** Reviewer console at the lab's west entry — second door, same view. */
const REVIEWER_CONSOLE: Interactable = {
  id: "reviewer-console",
  kind: "reviewer-console",
  x: 6,
  z: -14.6,
  y: 0,
  radius: 2.4,
  prompt: "Reviewer activity",
  icon: "reviewer",
};

/**
 * Gallery posters — the standing point sits ~1.4m off the art face, along
 * the face normal (rotation 0 → +Z, PI/2 → +X, -PI/2 → -X). Mirrors WALL_ART.
 */
function posterSpots(): Interactable[] {
  return WALL_ART.map((a): Interactable => {
    const yaw = a.rotation[1] ?? 0;
    // Face normal in XZ: rotY 0 → +Z; +PI/2 → +X; -PI/2 → -X.
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    return {
      id: `poster-${a.artId}`,
      kind: "poster" as const,
      x: a.position[0] + fx * 1.4,
      z: a.position[2] + fz * 1.4,
      y: 0,
      radius: 2.2,
      prompt: a.title,
      icon: "art",
    };
  });
}

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
  ...CI_SCREENS,
  CHILL_SCREEN,
  ARCADE,
  VENDING,
  REVIEWER,
  FLEET,
  REVIEWER_CONSOLE,
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
  ...posterSpots(),
  ...GALLERY_FRAMES.map((g): Interactable => {
    const yaw = g.rotation[1] ?? 0;
    return {
      id: `gallery-${g.id}`,
      kind: "gallery" as const,
      x: g.position[0] + Math.sin(yaw) * 1.4,
      z: g.position[2] + Math.cos(yaw) * 1.4,
      y: 0,
      radius: 2.2,
      prompt: g.title,
      icon: "art",
    };
  }),
  ...monitorSpots(),
  // Podium Room mic claim — stand on the stage circle, press E.
  {
    id: "podium-mic",
    kind: "podium" as const,
    x: PODIUM_MIC.x,
    z: PODIUM_MIC.z + 0.9,
    y: L2_Y + PODIUM_STAGE.h,
    radius: 2.4,
    prompt: "Take the mic",
    icon: "mic",
  },
  // Podium Room wall screen — stand on the open floor, press E to present.
  {
    id: "podium-screen",
    kind: "podium-screen" as const,
    x: PODIUM_SCREEN_SPOT.x,
    z: PODIUM_SCREEN_SPOT.z,
    y: L2_Y,
    radius: 3.2,
    prompt: "Wall screen",
    icon: "monitor",
  },
];

export function interactableById(id: string): Interactable | undefined {
  return INTERACTABLES.find((it) => it.id === id);
}

/** A chair the player can sit on: seat position + facing (toward the desk). */
export interface SitSpot {
  x: number;
  y: number;
  z: number;
  heading: number;
}

/** How close (m) the player must be to a chair to sit down. */
export const SIT_RADIUS = 1.4;

/** Chairs sit slightly rotated/jittered in-scene; sitters snap to the base
 *  spot facing the desk (layout yaw + the kit chair flip). */
function sitSpots(chairs: TransformData[], yawFix: number): SitSpot[] {
  return chairs.map((c) => ({
    x: c.position[0],
    y: c.position[1],
    z: c.position[2],
    heading: (c.rotation ? c.rotation[1] : 0) + yawFix,
  }));
}

/** Every desk + meeting chair on both floors. Stools/sofas stay stand-only. */
export const CHAIR_SIT_SPOTS: SitSpot[] = [
  ...sitSpots(DESK_CHAIRS, KIT_YAW.taskChair),
  ...sitSpots(MEETING_CHAIRS, KIT_YAW.meetingChair),
  ...sitSpots(L2_DESK_CHAIRS, KIT_YAW.taskChair),
];
