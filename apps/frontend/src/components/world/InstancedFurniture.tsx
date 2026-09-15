import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { KitInstances } from "./office/KitInstances";
import { KIT_PRELOAD, kitUrl } from "./office/kitManifest";

export interface TransformData {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

interface InstancedFurnitureProps {
  desks?: TransformData[];
  chairs?: TransformData[];
  /** Boardroom / meeting chairs (nicer frame-cushion model). */
  meetingChairs?: TransformData[];
  monitors?: TransformData[];
  sofas?: TransformData[];
  coffeeTables?: TransformData[];
  cafeTables?: TransformData[];
  stools?: TransformData[];
}

/**
 * Office furniture rendered from the Kenney Furniture Kit (CC0, local
 * `public/furniture-kit/models_glb/`). One `<Instances>` draw per kit mesh
 * part — same ultra-low draw-call budget as the old box primitives, but real
 * desks, task chairs, screens and sofas.
 *
 * Kit models auto-ground (feet at `position.y`) and auto-center, so layout
 * positions pass straight through. Desk-top props (screens, keyboards) ride
 * at the scaled desk-top height DESK_TOP_Y.
 */

/** Scaled desk-top height: desk.glb is 0.384 tall at scale 2.0. */
const DESK_TOP_Y = 0.384 * 2.0;

/** Deterministic per-index jitter (lived-in chairs, zero new meshes). */
const jitter = (i: number, salt: number): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Chairs never sit perfect — yaw + push jitter shared by all chair models. */
function jitterChairs(chairs: TransformData[]): TransformData[] {
  return chairs.map((c, i) => {
    const baseYaw = c.rotation ? c.rotation[1] : 0;
    const yaw = baseYaw + (jitter(i, 1) - 0.5) * 0.55;
    return {
      ...c,
      rotation: [0, yaw, 0] as [number, number, number],
      position: [
        c.position[0] + (jitter(i, 2) - 0.5) * 0.14,
        c.position[1],
        c.position[2] + (jitter(i, 3) - 0.5) * 0.14,
      ] as [number, number, number],
    };
  });
}

/** Split a list by index parity for two-model variety (sofas, tables). */
function splitParity<T>(list: T[]): [T[], T[]] {
  const even: T[] = [];
  const odd: T[] = [];
  list.forEach((item, i) => {
    if (i % 2 === 0) even.push(item);
    else odd.push(item);
  });
  return [even, odd];
}

export function InstancedFurniture({
  desks = [],
  chairs = [],
  meetingChairs = [],
  monitors = [],
  sofas = [],
  coffeeTables = [],
  cafeTables = [],
  stools = [],
}: InstancedFurnitureProps) {
  const jitteredChairs = useMemo(() => jitterChairs(chairs), [chairs]);
  const jitteredMeeting = useMemo(
    () => jitterChairs(meetingChairs),
    [meetingChairs],
  );
  const [sofasA, sofasB] = useMemo(() => splitParity(sofas), [sofas]);
  const [tablesA, tablesB] = useMemo(
    () => splitParity(coffeeTables),
    [coffeeTables],
  );
  // Keyboards sit slightly toward the chair, mice to the right of that.
  const keyboards = useMemo(
    () =>
      monitors.map((m) => {
        const rotY = m.rotation ? m.rotation[1] : 0;
        const fwd: [number, number] = [Math.sin(rotY), Math.cos(rotY)];
        return {
          ...m,
          position: [
            m.position[0] + fwd[0] * 0.32,
            m.position[1],
            m.position[2] + fwd[1] * 0.32,
          ] as [number, number, number],
        };
      }),
    [monitors],
  );
  const mice = useMemo(
    () =>
      monitors.map((m) => {
        const rotY = m.rotation ? m.rotation[1] : 0;
        const right: [number, number] = [Math.cos(rotY), -Math.sin(rotY)];
        const fwd: [number, number] = [Math.sin(rotY), Math.cos(rotY)];
        return {
          ...m,
          position: [
            m.position[0] + fwd[0] * 0.32 + right[0] * 0.32,
            m.position[1],
            m.position[2] + fwd[1] * 0.32 + right[1] * 0.32,
          ] as [number, number, number],
        };
      }),
    [monitors],
  );

  return (
    <group name="instanced-furniture">
      {desks.length > 0 && (
        <KitInstances model="desk" items={desks} name="kit-desks" />
      )}
      {jitteredChairs.length > 0 && (
        <KitInstances
          model="taskChair"
          items={jitteredChairs}
          name="kit-task-chairs"
        />
      )}
      {jitteredMeeting.length > 0 && (
        <KitInstances
          model="meetingChair"
          items={jitteredMeeting}
          name="kit-meeting-chairs"
        />
      )}
      {monitors.length > 0 && (
        <>
          <KitInstances
            model="screen"
            items={monitors}
            yOffset={DESK_TOP_Y}
            name="kit-screens"
          />
          <KitInstances
            model="keyboard"
            items={keyboards}
            yOffset={DESK_TOP_Y + 0.01}
            castShadow={false}
            name="kit-keyboards"
          />
          <KitInstances
            model="mouse"
            items={mice}
            yOffset={DESK_TOP_Y + 0.01}
            castShadow={false}
            name="kit-mice"
          />
        </>
      )}
      {sofasA.length > 0 && (
        <KitInstances model="sofa" items={sofasA} name="kit-sofas" />
      )}
      {sofasB.length > 0 && (
        <KitInstances
          model="sofaDesign"
          items={sofasB}
          name="kit-sofas-design"
        />
      )}
      {tablesA.length > 0 && (
        <KitInstances
          model="coffeeTable"
          items={tablesA}
          name="kit-coffee-tables"
        />
      )}
      {tablesB.length > 0 && (
        <KitInstances
          model="coffeeTableAlt"
          items={tablesB}
          name="kit-coffee-tables-alt"
        />
      )}
      {cafeTables.length > 0 && (
        <KitInstances
          model="cafeTable"
          items={cafeTables}
          name="kit-cafe-tables"
        />
      )}
      {stools.length > 0 && (
        <KitInstances model="stool" items={stools} name="kit-stools" />
      )}
    </group>
  );
}

/** Preload every kit model used above with the world. */
export function preloadKitFurniture() {
  for (const key of KIT_PRELOAD) {
    try {
      useGLTF.preload(kitUrl(key));
    } catch {
      // AssetGate timeout still releases the world; a missing kit model
      // falls back gracefully (KitInstances renders null).
    }
  }
}

export default InstancedFurniture;
