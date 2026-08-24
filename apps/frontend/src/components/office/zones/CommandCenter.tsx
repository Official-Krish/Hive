import React from "react";
import { WoodMaterials } from "../materials/WoodMaterial";
import { MetalMaterials } from "../materials/MetalMaterial";
import { EmissiveMaterials } from "../materials/EmissiveMaterial";

/**
 * AI & Command Center (High-End Research Intelligence Core)
 * Positioned at North-West: x = -8, z = -12
 */
export function CommandCenter() {
  return (
    <group name="command-center">
      {/* ARCHITECTURAL CURVED SCREEN WALL (Back of North Wall) */}
      <group position={[-8, 1.8, -17.8]}>
        {/* Main Curved/Framed Frame Chassis */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[12.0, 2.2, 0.12]} />
          <primitive object={WoodMaterials.blackStainedAsh} attach="material" />
        </mesh>

        {/* Display Active Glow Surface (3-Panel Telemetry Grid) */}
        {[-3.6, 0, 3.6].map((posX, i) => (
          <group key={i} position={[posX, 0, 0.07]}>
            <mesh>
              <planeGeometry args={[3.4, 1.9]} />
              <primitive
                object={EmissiveMaterials.cyanTechGlow}
                attach="material"
              />
            </mesh>
            {/* Subtle Screen Bezel Trim */}
            <mesh position={[0, 0, 0.005]}>
              <ringGeometry args={[1.5, 1.52, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
            </mesh>
          </group>
        ))}
      </group>

      {/* CENTRAL LOW-PROFILE GRAPHITE CONSOLE TABLE */}
      <group position={[-8, 0, -12]}>
        {/* Main Console Deck */}
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.0, 0.08, 1.4]} />
          <primitive object={WoodMaterials.blackStainedAsh} attach="material" />
        </mesh>

        {/* Sleek Under-lighting Emissive Line */}
        <mesh position={[0, 0.65, 0.68]}>
          <boxGeometry args={[4.8, 0.02, 0.02]} />
          <primitive
            object={EmissiveMaterials.cyanTechGlow}
            attach="material"
          />
        </mesh>

        {/* Console Legs */}
        <mesh position={[-2.3, 0.33, 0]} castShadow>
          <boxGeometry args={[0.08, 0.66, 1.2]} />
          <primitive object={MetalMaterials.darkGraphite} attach="material" />
        </mesh>
        <mesh position={[2.3, 0.33, 0]} castShadow>
          <boxGeometry args={[0.08, 0.66, 1.2]} />
          <primitive object={MetalMaterials.darkGraphite} attach="material" />
        </mesh>

        {/* Tactical Control Displays & Holo Interfaces */}
        {[-1.5, 1.5].map((posX, i) => (
          <group key={i} position={[posX, 0.75, 0]} rotation={[-0.3, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[1.2, 0.02, 0.6]} />
              <primitive
                object={MetalMaterials.matteBlackMetal}
                attach="material"
              />
            </mesh>
            <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.1, 0.52]} />
              <primitive
                object={EmissiveMaterials.cyanTechGlow}
                attach="material"
              />
            </mesh>
          </group>
        ))}

        {/* Subtle Ambient Tech Blue Point Light */}
        <pointLight
          position={[0, 0.8, 0]}
          intensity={1.8}
          distance={6.0}
          color="#38bdf8"
        />
      </group>
    </group>
  );
}
