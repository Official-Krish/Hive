import React from "react";
import { WoodMaterials } from "../materials/WoodMaterial";
import { MetalMaterials } from "../materials/MetalMaterial";
import { FabricMaterials } from "../materials/FabricMaterial";
import { EmissiveMaterials } from "../materials/EmissiveMaterial";

/**
 * Desk Workstation Unit
 */
function WorkstationUnit({
  position,
  rotation = [0, 0, 0],
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* DESK TOP - Bevelled Dark Walnut Desk */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.06, 1.0]} />
        <primitive object={WoodMaterials.darkWalnut} attach="material" />
      </mesh>

      {/* DESK FRAME & LEGS - Dark Graphite Metal Legs */}
      <mesh position={[-1.0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.06, 0.7, 0.9]} />
        <primitive object={MetalMaterials.darkGraphite} attach="material" />
      </mesh>
      <mesh position={[1.0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.06, 0.7, 0.9]} />
        <primitive object={MetalMaterials.darkGraphite} attach="material" />
      </mesh>
      {/* Cable Management Tray Underneath */}
      <mesh position={[0, 0.62, -0.2]} castShadow>
        <boxGeometry args={[1.8, 0.08, 0.2]} />
        <primitive object={MetalMaterials.matteBlackMetal} attach="material" />
      </mesh>

      {/* DUAL MONITOR SETUP ON ARTICULATING MOUNT ARM */}
      <group position={[0, 0.75, -0.3]}>
        {/* Monitor Stand Post */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.03, 0.4, 16]} />
          <primitive
            object={MetalMaterials.brushedAluminum}
            attach="material"
          />
        </mesh>
        {/* Left Monitor Screen */}
        <group position={[-0.45, 0.32, 0]} rotation={[0, 0.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 0.42, 0.02]} />
            <primitive
              object={MetalMaterials.matteBlackMetal}
              attach="material"
            />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[0.66, 0.38]} />
            <primitive
              object={EmissiveMaterials.codeScreen}
              attach="material"
            />
          </mesh>
        </group>
        {/* Right Monitor Screen */}
        <group position={[0.45, 0.32, 0]} rotation={[0, -0.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 0.42, 0.02]} />
            <primitive
              object={MetalMaterials.matteBlackMetal}
              attach="material"
            />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[0.66, 0.38]} />
            <primitive
              object={EmissiveMaterials.codeScreen}
              attach="material"
            />
          </mesh>
        </group>
      </group>

      {/* ERGONOMIC TASK CHAIR */}
      <group position={[0, 0, 0.6]} rotation={[0, Math.PI, 0]}>
        {/* Star Base with Castors */}
        <mesh position={[0, 0.08, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.06, 5]} />
          <primitive
            object={MetalMaterials.matteBlackMetal}
            attach="material"
          />
        </mesh>
        {/* Gas Lift Column */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.3, 16]} />
          <primitive
            object={MetalMaterials.brushedAluminum}
            attach="material"
          />
        </mesh>
        {/* Seat Cushion */}
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.52, 0.08, 0.5]} />
          <primitive object={FabricMaterials.taskChairMesh} attach="material" />
        </mesh>
        {/* Mesh Backrest */}
        <mesh position={[0, 0.75, -0.22]} rotation={[-0.1, 0, 0]} castShadow>
          <boxGeometry args={[0.48, 0.55, 0.04]} />
          <primitive object={FabricMaterials.taskChairMesh} attach="material" />
        </mesh>
        {/* Armrests */}
        <mesh position={[-0.28, 0.58, 0]} castShadow>
          <boxGeometry args={[0.05, 0.18, 0.3]} />
          <primitive
            object={MetalMaterials.matteBlackMetal}
            attach="material"
          />
        </mesh>
        <mesh position={[0.28, 0.58, 0]} castShadow>
          <boxGeometry args={[0.05, 0.18, 0.3]} />
          <primitive
            object={MetalMaterials.matteBlackMetal}
            attach="material"
          />
        </mesh>
      </group>

      {/* DESK ACCESSORIES (Keyboards, Mugs, Desk Lamps, Notebooks) */}
      {/* Keyboard */}
      <mesh position={[0, 0.76, 0.15]} castShadow>
        <boxGeometry args={[0.38, 0.015, 0.14]} />
        <primitive object={MetalMaterials.darkGraphite} attach="material" />
      </mesh>
      {/* Ceramic Coffee Mug */}
      <mesh position={[0.65, 0.79, 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.2} />
      </mesh>
      {/* Minimalist Brass Desk Lamp */}
      <group position={[-0.8, 0.75, -0.25]}>
        <mesh position={[0, 0.01, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
          <primitive object={MetalMaterials.mutedBrass} attach="material" />
        </mesh>
        <mesh position={[0, 0.22, 0]} rotation={[0, 0, -0.2]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.4, 12]} />
          <primitive object={MetalMaterials.mutedBrass} attach="material" />
        </mesh>
        {/* Lamp Shade with subtle warm point light */}
        <mesh position={[0.08, 0.4, 0]} castShadow>
          <coneGeometry args={[0.08, 0.1, 16]} />
          <primitive object={MetalMaterials.mutedBrass} attach="material" />
        </mesh>
        <mesh position={[0.08, 0.35, 0]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <primitive
            object={EmissiveMaterials.warmLampGlow}
            attach="material"
          />
        </mesh>
        <pointLight
          position={[0.08, 0.32, 0]}
          intensity={0.8}
          distance={3.5}
          color="#fde047"
        />
      </group>
    </group>
  );
}

/**
 * Central Workspace Component (Multiple workstation rows)
 */
export function CentralWorkspace() {
  // Workstation Grid Array
  const workstations = [
    // Row 1 (North)
    { pos: [-13.5, 0, -1], rot: [0, 0, 0] },
    { pos: [-9.5, 0, -1], rot: [0, 0, 0] },
    { pos: [-5.5, 0, -1], rot: [0, 0, 0] },

    // Row 2 (Middle facing opposite)
    { pos: [-13.5, 0, 4], rot: [0, Math.PI, 0] },
    { pos: [-9.5, 0, 4], rot: [0, Math.PI, 0] },
    { pos: [-5.5, 0, 4], rot: [0, Math.PI, 0] },

    // Row 3 (South)
    { pos: [-13.5, 0, 9], rot: [0, 0, 0] },
    { pos: [-9.5, 0, 9], rot: [0, 0, 0] },
    { pos: [-5.5, 0, 9], rot: [0, 0, 0] },
  ];

  return (
    <group name="central-workspace">
      {workstations.map((w, i) => (
        <WorkstationUnit
          key={i}
          position={w.pos as [number, number, number]}
          rotation={w.rot as [number, number, number]}
        />
      ))}
    </group>
  );
}
