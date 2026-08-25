import React from "react";
import { WoodMaterials } from "../materials/WoodMaterial";
import { MetalMaterials } from "../materials/MetalMaterial";
import { FabricMaterials } from "../materials/FabricMaterial";
import { EmissiveMaterials } from "../materials/EmissiveMaterial";

/**
 * Executive Glass Conference Room Zone (Position: x = 10, z = -10.5)
 */
export function GlassConferenceRoom() {
  // Executive Conference Chairs
  const chairPositions: {
    pos: [number, number, number];
    rot: [number, number, number];
  }[] = [
    // North side of table
    { pos: [7.0, 0, -12.0], rot: [0, 0, 0] },
    { pos: [9.0, 0, -12.0], rot: [0, 0, 0] },
    { pos: [11.0, 0, -12.0], rot: [0, 0, 0] },
    { pos: [13.0, 0, -12.0], rot: [0, 0, 0] },

    // South side of table
    { pos: [7.0, 0, -9.0], rot: [0, Math.PI, 0] },
    { pos: [9.0, 0, -9.0], rot: [0, Math.PI, 0] },
    { pos: [11.0, 0, -9.0], rot: [0, Math.PI, 0] },
    { pos: [13.0, 0, -9.0], rot: [0, Math.PI, 0] },

    // Head of table (West & East ends)
    { pos: [5.2, 0, -10.5], rot: [0, Math.PI / 2, 0] },
    { pos: [14.8, 0, -10.5], rot: [0, -Math.PI / 2, 0] },
  ];

  return (
    <group name="glass-conference-room">
      {/* EXECUTIVE CONFERENCE TABLE (Dark Walnut Surface with Graphite Pillar Base) */}
      <group position={[10, 0, -10.5]}>
        {/* Table Top Surface (Bevelled Oval/Rectangle) */}
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <boxGeometry args={[8.0, 0.08, 2.0]} />
          <primitive object={WoodMaterials.darkWalnut} attach="material" />
        </mesh>

        {/* Center Cable Connectivity Module */}
        <mesh position={[0, 0.79, 0]} castShadow>
          <boxGeometry args={[1.2, 0.02, 0.25]} />
          <primitive
            object={MetalMaterials.brushedAluminum}
            attach="material"
          />
        </mesh>

        {/* Heavy Brushed Metal Twin Pedestal Legs */}
        <mesh position={[-2.5, 0.36, 0]} castShadow>
          <boxGeometry args={[0.4, 0.7, 1.2]} />
          <primitive object={MetalMaterials.darkGraphite} attach="material" />
        </mesh>
        <mesh position={[2.5, 0.36, 0]} castShadow>
          <boxGeometry args={[0.4, 0.7, 1.2]} />
          <primitive object={MetalMaterials.darkGraphite} attach="material" />
        </mesh>
      </group>

      {/* EXECUTIVE LEATHER CHAIRS */}
      {chairPositions.map((c, i) => (
        <group key={i} position={c.pos} rotation={c.rot}>
          {/* Base & Column */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.44, 16]} />
            <primitive object={MetalMaterials.darkGraphite} attach="material" />
          </mesh>
          {/* Seat Cushion */}
          <mesh position={[0, 0.46, 0]} castShadow>
            <boxGeometry args={[0.55, 0.08, 0.52]} />
            <primitive
              object={FabricMaterials.executiveLeather}
              attach="material"
            />
          </mesh>
          {/* High Backrest */}
          <mesh position={[0, 0.82, -0.22]} rotation={[-0.08, 0, 0]} castShadow>
            <boxGeometry args={[0.52, 0.68, 0.06]} />
            <primitive
              object={FabricMaterials.executiveLeather}
              attach="material"
            />
          </mesh>
        </group>
      ))}

      {/* 85" WALL PRESENTATION DISPLAY (Mounted on North Wall: z = -17.8) */}
      <group position={[10, 2.0, -18.2]}>
        {/* Frame Outer Chassis */}
        <mesh castShadow>
          <boxGeometry args={[4.2, 2.3, 0.08]} />
          <primitive
            object={MetalMaterials.matteBlackMetal}
            attach="material"
          />
        </mesh>
        {/* Screen Glass Surface */}
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[4.0, 2.15]} />
          <primitive
            object={EmissiveMaterials.cyanTechGlow}
            attach="material"
          />
        </mesh>
      </group>

      {/* RECESSED CEILING DOWNLIGHT FIXTURES */}
      {[7, 10, 13].map((posX, i) => (
        <group key={i} position={[posX, 2.8, -10.5]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.04, 16]} />
            <primitive object={MetalMaterials.darkGraphite} attach="material" />
          </mesh>
          <pointLight
            position={[0, -0.1, 0]}
            intensity={1.5}
            distance={7.0}
            color="#ffedd5"
          />
        </group>
      ))}
    </group>
  );
}
