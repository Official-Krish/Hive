import { useMemo } from "react";
import * as THREE from "three";
import { GlassMaterials } from "../materials/GlassMaterial";

interface WallSpec {
  pos: [number, number, number];
  size: [number, number, number];
}

/**
 * Architectural Walls, Baseboards & Glass Curtain Partitions
 */
export function WallsAndPartitions() {
  const wallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#94a3b8",
        roughness: 0.4,
        metalness: 0.05,
      }),
    [],
  );
  const wallCapMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#475569",
        roughness: 0.3,
        metalness: 0.3,
      }),
    [],
  );
  const baseboardMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#334155",
        roughness: 0.3,
        metalness: 0.5,
      }),
    [],
  );

  // Outer Boundary & Interior Divider Walls
  const wallSpecs: WallSpec[] = [
    // Outer North Perimeter (Back wall) - full height 3.0m for clean architectural backdrop
    { pos: [0, -18.8, 1.5], size: [38.4, 0.4, 3.0] },
    // Outer West Wall (Left wall)
    { pos: [-18.8, 0, 1.5], size: [0.4, 38.4, 3.0] },
    // Outer East Wall (Right wall)
    { pos: [18.8, 0, 1.5], size: [0.4, 38.4, 3.0] },

    // Interior Dividers (1.4m height to maintain open architectural sightlines)
    // Central Spine (x = 2, separating West & East zones)
    { pos: [2, -12, 0.7], size: [0.25, 12, 1.4] }, // AI Command vs Conference partition
    { pos: [2, 10.5, 0.7], size: [0.25, 15, 1.4] }, // Central Core vs Lounge partition

    // North Horizontal Partition (z = -6, separating AI Core from Central Workspace)
    { pos: [-8, -6, 0.7], size: [20, 0.25, 1.4] },

    // Conference Room South Solid Wall Portion (z = -3, x = 2 to 10)
    { pos: [6, -3, 0.7], size: [8, 0.25, 1.4] },

    // Server Closet Solid Partition Walls (x = 12 to 18, z = -3 & z = 3)
    { pos: [15, -3, 0.7], size: [6, 0.2, 1.4] },
    { pos: [15, 3, 0.7], size: [6, 0.2, 1.4] },
  ];

  return (
    <group name="walls-and-partitions">
      {/* SOLID WALL MESHES WITH BASEBOARDS & CAPS */}
      {wallSpecs.map((w, idx) => {
        const [posX, posZ, posY] = w.pos;
        const [sizeX, sizeZ, sizeY] = w.size;

        return (
          <group key={idx} position={[posX, posY, posZ]}>
            {/* Main Wall Mass */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[sizeX, sizeY, sizeZ]} />
              <primitive object={wallMaterial} attach="material" />
            </mesh>

            {/* Architectural Wall Cap Trim (Top Edge) */}
            <mesh position={[0, sizeY / 2 + 0.02, 0]} castShadow>
              <boxGeometry args={[sizeX + 0.04, 0.04, sizeZ + 0.04]} />
              <primitive object={wallCapMaterial} attach="material" />
            </mesh>

            {/* Wall Baseboard Trim (Bottom Edge) */}
            <mesh position={[0, -sizeY / 2 + 0.08, 0]} castShadow receiveShadow>
              <boxGeometry args={[sizeX + 0.02, 0.16, sizeZ + 0.02]} />
              <primitive object={baseboardMaterial} attach="material" />
            </mesh>
          </group>
        );
      })}

      {/* GLASS CONFERENCE ROOM CURTAIN PARTITION (x = 10 to 18, z = -3) */}
      <group position={[14, 1.4, -3]}>
        {/* Floor-to-ceiling glass panel */}
        <mesh castShadow>
          <boxGeometry args={[8, 2.6, 0.08]} />
          <primitive object={GlassMaterials.clearPartition} attach="material" />
        </mesh>
        {/* Top & Bottom Metal Frame Mullions */}
        <mesh position={[0, 1.3, 0]}>
          <boxGeometry args={[8.08, 0.08, 0.12]} />
          <primitive object={GlassMaterials.frameGraphite} attach="material" />
        </mesh>
        <mesh position={[0, -1.3, 0]}>
          <boxGeometry args={[8.08, 0.08, 0.12]} />
          <primitive object={GlassMaterials.frameGraphite} attach="material" />
        </mesh>
        {/* Vertical Frame Posts */}
        {[-3.9, 0, 3.9].map((posX, i) => (
          <mesh key={i} position={[posX, 0, 0]}>
            <boxGeometry args={[0.08, 2.6, 0.12]} />
            <primitive
              object={GlassMaterials.frameGraphite}
              attach="material"
            />
          </mesh>
        ))}
      </group>

      {/* SERVER CLOSET GLASS FRONT PARTITION (x = 12, z = -3 to 3) */}
      <group position={[12, 1.4, 0]}>
        {/* Floor-to-ceiling glass door panel */}
        <mesh castShadow>
          <boxGeometry args={[0.08, 2.6, 6]} />
          <primitive object={GlassMaterials.clearPartition} attach="material" />
        </mesh>
        {/* Vertical Frame Posts */}
        {[-2.9, 0, 2.9].map((posZ, i) => (
          <mesh key={i} position={[0, 0, posZ]}>
            <boxGeometry args={[0.12, 2.6, 0.08]} />
            <primitive
              object={GlassMaterials.frameGraphite}
              attach="material"
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
