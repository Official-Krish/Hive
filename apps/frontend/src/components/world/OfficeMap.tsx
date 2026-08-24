import React, { useMemo } from "react";
import * as THREE from "three";
import { InstancedFurniture, type TransformData } from "./InstancedFurniture";

export interface AABB {
  min: [number, number];
  max: [number, number];
}

interface OfficeMapProps {
  onObstaclesReady?: (obstacles: AABB[]) => void;
}

/**
 * Production-Grade 3D Office Environment Map
 * Layout dimensions: ~36.5m x 36.5m floor layout split into:
 * 1. Engineering Hub (-15 to 0, -15 to 5)
 * 2. Executive & AI Boardroom (2 to 18, -15 to -2)
 * 3. Lounge & Coffee Bar (2 to 18, 0 to 15)
 * 4. Entrance & Reception (-15 to 0, 6 to 15)
 */
export function OfficeMap({ onObstaclesReady }: OfficeMapProps) {
  // Architectural Materials - Bright, crisp studio palette
  const floorBaseMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 }),
    [],
  );
  const floorTileCharcoal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.5 }),
    [],
  );
  const floorTileEng = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.6 }),
    [],
  );
  const floorTileBoardroom = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#3b322c", roughness: 0.4 }),
    [],
  );
  const floorTileLounge = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#443930", roughness: 0.5 }),
    [],
  );
  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.4 }),
    [],
  );
  const wallTrimMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#334155",
        roughness: 0.3,
        metalness: 0.6,
      }),
    [],
  );
  const glassMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#cbd5e0",
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.8,
      }),
    [],
  );
  const glassFrameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.3,
        metalness: 0.7,
      }),
    [],
  );
  const accentLightMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#06b6d4",
        emissive: "#0891b2",
        emissiveIntensity: 1.0,
      }),
    [],
  );
  const receptionDeskMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#334155",
        roughness: 0.3,
        metalness: 0.4,
      }),
    [],
  );

  // Wall Definitions: [x, z, width, depth, height]
  const wallSpecs: {
    pos: [number, number, number];
    size: [number, number, number];
  }[] = [
    // Outer Boundaries (3.0m height)
    { pos: [0, -18.25, 0], size: [36.5, 3.0, 0.4] }, // North Wall
    { pos: [0, 18.25, 0], size: [36.5, 3.0, 0.4] }, // South Wall
    { pos: [-18.25, 0, 0], size: [0.4, 3.0, 36.5] }, // West Wall
    { pos: [18.25, 0, 0], size: [0.4, 3.0, 36.5] }, // East Wall

    // Interior Dividers with Open Sightlines (1.2m height for modern open studio feel)
    // West/East Center Partition (x = 0)
    { pos: [0, -11, 0], size: [0.25, 1.2, 14] }, // North partition
    { pos: [0, 10, 0], size: [0.25, 1.2, 16] }, // South partition (doorway at z ~ -4 to 2)

    // Meeting Room Partition (z = -2, x = 0 to 18)
    { pos: [12, -2, 0], size: [12, 1.2, 0.25] }, // Right partition
  ];

  // Calculate AABB Obstacles for Collision
  const obstacles: AABB[] = useMemo(() => {
    const list: AABB[] = [];

    // Walls
    wallSpecs.forEach((w) => {
      const halfW = w.size[0] / 2;
      const halfD = w.size[2] / 2;
      list.push({
        min: [w.pos[0] - halfW, w.pos[1] - halfD],
        max: [w.pos[0] + halfW, w.pos[1] + halfD],
      });
    });

    // Reception Desk Obstacle (Positioned at z = 14.0 so spawn at [-9, 0, 10] is clear)
    list.push({
      min: [-11.0, 13.0],
      max: [-7.0, 15.0],
    });

    // Desks Bounding Boxes
    deskTransforms.forEach((d) => {
      list.push({
        min: [d.position[0] - 1.0, d.position[2] - 0.5],
        max: [d.position[0] + 1.0, d.position[2] + 0.5],
      });
    });

    // Sofa Bounding Boxes
    sofaTransforms.forEach((s) => {
      list.push({
        min: [s.position[0] - 1.0, s.position[2] - 0.5],
        max: [s.position[0] + 1.0, s.position[2] + 0.5],
      });
    });

    return list;
  }, []);

  // Notify parent of collision obstacles once
  React.useEffect(() => {
    if (onObstaclesReady) {
      onObstaclesReady(obstacles);
    }
  }, [obstacles, onObstaclesReady]);

  return (
    <group name="office-map">
      {/* FLOORS */}
      {/* Main Base Floor */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[36.5, 0.1, 36.5]} />
        <primitive object={floorBaseMaterial} attach="material" />
      </mesh>

      {/* Engineering Hub Tile Floor (West Zone) */}
      <mesh position={[-9, 0.005, -5]} receiveShadow>
        <planeGeometry args={[17, 24]} rotateX={-Math.PI / 2} />
        <primitive object={floorTileEng} attach="material" />
      </mesh>

      {/* Meeting Room Hardwood Floor (North-East Zone) */}
      <mesh position={[9, 0.005, -10]} receiveShadow>
        <planeGeometry args={[17, 15]} rotateX={-Math.PI / 2} />
        <primitive object={floorTileBoardroom} attach="material" />
      </mesh>

      {/* Lounge Floor (South-East Zone) */}
      <mesh position={[9, 0.005, 8]} receiveShadow>
        <planeGeometry args={[17, 19]} rotateX={-Math.PI / 2} />
        <primitive object={floorTileLounge} attach="material" />
      </mesh>

      {/* Entrance & Reception Floor (South-West Zone) */}
      <mesh position={[-9, 0.005, 10]} receiveShadow>
        <planeGeometry args={[17, 14]} rotateX={-Math.PI / 2} />
        <primitive object={floorTileCharcoal} attach="material" />
      </mesh>

      {/* WALLS & BASEBOARDS */}
      {wallSpecs.map((w, i) => (
        <group key={i} position={[w.pos[0], w.size[1] / 2, w.pos[1]]}>
          {/* Main Wall Body */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={w.size} />
            <primitive object={wallMaterial} attach="material" />
          </mesh>
          {/* Wall Trim Baseboard */}
          <mesh position={[0, -w.size[1] / 2 + 0.08, 0]}>
            <boxGeometry args={[w.size[0] + 0.02, 0.16, w.size[2] + 0.02]} />
            <primitive object={wallTrimMaterial} attach="material" />
          </mesh>
        </group>
      ))}

      {/* ARCHITECTURAL TINTED GLASS PARTITIONS */}
      {/* Boardroom Glass Partition with Metal Frame */}
      <group position={[4, 1.2, -2]}>
        <mesh castShadow>
          <boxGeometry args={[4, 2.4, 0.06]} />
          <primitive object={glassMaterial} attach="material" />
        </mesh>
        {/* Metal Frame Border */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[4.04, 0.08, 0.08]} />
          <primitive object={glassFrameMaterial} attach="material" />
        </mesh>
      </group>

      {/* RECEPTION FEATURE DESK (Placed at z = 14.0 so spawn [-9, 0, 10] is clear) */}
      <group position={[-9, 0, 14.0]}>
        {/* Desk Counter */}
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 1.0, 0.9]} />
          <primitive object={receptionDeskMaterial} attach="material" />
        </mesh>
        {/* Illuminated Cyan Accent Strip */}
        <mesh position={[0, 0.5, -0.46]}>
          <boxGeometry args={[3.0, 0.06, 0.02]} />
          <primitive object={accentLightMaterial} attach="material" />
        </mesh>
      </group>

      {/* BOARDROOM PRESENTATION DISPLAY */}
      <group position={[17.9, 1.6, -10]}>
        <mesh castShadow>
          <boxGeometry args={[0.05, 1.8, 3.2]} />
          <meshStandardMaterial
            color="#1e293b"
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
        {/* Display Screen Active Glow */}
        <mesh position={[-0.03, 0, 0]}>
          <planeGeometry args={[3.0, 1.6]} rotateY={-Math.PI / 2} />
          <meshStandardMaterial
            color="#0284c7"
            emissive="#0369a1"
            emissiveIntensity={0.8}
          />
        </mesh>
      </group>

      {/* INSTANCED FURNITURE */}
      <InstancedFurniture
        desks={deskTransforms}
        chairs={chairTransforms}
        monitors={monitorTransforms}
        plants={plantTransforms}
        sofas={sofaTransforms}
        coffeeTables={coffeeTableTransforms}
        lightFixtures={lightFixtureTransforms}
      />
    </group>
  );
}

// FURNITURE TRANSFORM PLACEMENT DATA
const deskTransforms: TransformData[] = [
  // Engineering Hub Rows
  { position: [-12, 0, -12], rotation: [0, 0, 0] },
  { position: [-9, 0, -12], rotation: [0, 0, 0] },
  { position: [-6, 0, -12], rotation: [0, 0, 0] },

  { position: [-12, 0, -8], rotation: [0, Math.PI, 0] },
  { position: [-9, 0, -8], rotation: [0, Math.PI, 0] },
  { position: [-6, 0, -8], rotation: [0, Math.PI, 0] },

  { position: [-12, 0, -3], rotation: [0, 0, 0] },
  { position: [-9, 0, -3], rotation: [0, 0, 0] },
  { position: [-6, 0, -3], rotation: [0, 0, 0] },

  // Meeting Room Conference Table (Desks combined)
  { position: [8, 0, -10], rotation: [0, Math.PI / 2, 0] },
  { position: [10, 0, -10], rotation: [0, Math.PI / 2, 0] },
];

const chairTransforms: TransformData[] = [
  // Engineering Chairs
  { position: [-12, 0, -11.3], rotation: [0, 0, 0] },
  { position: [-9, 0, -11.3], rotation: [0, 0, 0] },
  { position: [-6, 0, -11.3], rotation: [0, 0, 0] },

  { position: [-12, 0, -8.7], rotation: [0, Math.PI, 0] },
  { position: [-9, 0, -8.7], rotation: [0, Math.PI, 0] },
  { position: [-6, 0, -8.7], rotation: [0, Math.PI, 0] },

  { position: [-12, 0, -2.3], rotation: [0, 0, 0] },
  { position: [-9, 0, -2.3], rotation: [0, 0, 0] },
  { position: [-6, 0, -2.3], rotation: [0, 0, 0] },

  // Meeting Room Chairs
  { position: [8, 0, -11.2], rotation: [0, 0, 0] },
  { position: [10, 0, -11.2], rotation: [0, 0, 0] },
  { position: [8, 0, -8.8], rotation: [0, Math.PI, 0] },
  { position: [10, 0, -8.8], rotation: [0, Math.PI, 0] },
];

const monitorTransforms: TransformData[] = [
  { position: [-12, 0, -12.2], rotation: [0, 0, 0] },
  { position: [-9, 0, -12.2], rotation: [0, 0, 0] },
  { position: [-6, 0, -12.2], rotation: [0, 0, 0] },

  { position: [-12, 0, -7.8], rotation: [0, Math.PI, 0] },
  { position: [-9, 0, -7.8], rotation: [0, Math.PI, 0] },
  { position: [-6, 0, -7.8], rotation: [0, Math.PI, 0] },

  { position: [-12, 0, -3.2], rotation: [0, 0, 0] },
  { position: [-9, 0, -3.2], rotation: [0, 0, 0] },
  { position: [-6, 0, -3.2], rotation: [0, 0, 0] },
];

const plantTransforms: TransformData[] = [
  { position: [-16, 0, -16] },
  { position: [-16, 0, 16] },
  { position: [16, 0, -16] },
  { position: [16, 0, 16] },
  { position: [-1, 0, -1] },
  { position: [1, 0, -1] },
  { position: [16, 0, 2] },
];

const sofaTransforms: TransformData[] = [
  { position: [6, 0, 8], rotation: [0, Math.PI / 2, 0] },
  { position: [12, 0, 8], rotation: [0, -Math.PI / 2, 0] },
  { position: [9, 0, 12], rotation: [0, Math.PI, 0] },
];

const coffeeTableTransforms: TransformData[] = [
  { position: [9, 0, 8], rotation: [0, 0, 0] },
];

const lightFixtureTransforms: TransformData[] = [
  { position: [-9, 0, -10] },
  { position: [-9, 0, -5] },
  { position: [9, 0, -10] },
  { position: [9, 0, 8] },
];
