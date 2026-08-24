import React from "react";
import { MetalMaterials } from "../materials/MetalMaterial";
import { EmissiveMaterials } from "../materials/EmissiveMaterial";

/**
 * Server Rack Unit Component
 */
function ServerRack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Outer Metal Chassis (2.2m height) */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 2.2, 1.0]} />
        <primitive object={MetalMaterials.matteBlackMetal} attach="material" />
      </mesh>

      {/* Vented Mesh Front Door Frame */}
      <mesh position={[0, 1.1, 0.51]} castShadow>
        <boxGeometry args={[0.82, 2.1, 0.02]} />
        <primitive object={MetalMaterials.darkGraphite} attach="material" />
      </mesh>

      {/* Server Blade Slots (Stacked 1U/2U server units) */}
      {[0.4, 0.8, 1.2, 1.6].map((posY, i) => (
        <group key={i} position={[0, posY, 0.52]}>
          {/* Blade Front Face */}
          <mesh castShadow>
            <boxGeometry args={[0.78, 0.28, 0.02]} />
            <primitive
              object={MetalMaterials.brushedAluminum}
              attach="material"
            />
          </mesh>
          {/* Micro Status LED Array */}
          <mesh position={[-0.32, 0, 0.015]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <primitive
              object={EmissiveMaterials.serverLedGreen}
              attach="material"
            />
          </mesh>
          <mesh position={[-0.26, 0, 0.015]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <primitive
              object={EmissiveMaterials.serverLedBlue}
              attach="material"
            />
          </mesh>
          <mesh position={[-0.2, 0, 0.015]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <primitive
              object={EmissiveMaterials.serverLedGreen}
              attach="material"
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Server / Infrastructure Room Component (Position: x = 15, z = 0)
 */
export function ServerRoom() {
  const rackPositions: [number, number, number][] = [
    [14.2, 0, -1.8],
    [16.2, 0, -1.8],
    [14.2, 0, 1.8],
    [16.2, 0, 1.8],
  ];

  return (
    <group name="server-room">
      {/* 4x HIGH-DENSITY SERVER RACKS */}
      {rackPositions.map((pos, i) => (
        <ServerRack key={i} position={pos} />
      ))}

      {/* OVERHEAD CABLE TRAYS & MESH TRUNK */}
      <mesh position={[15, 2.5, 0]} castShadow>
        <boxGeometry args={[3.2, 0.08, 4.5]} />
        <primitive object={MetalMaterials.darkGraphite} attach="material" />
      </mesh>

      {/* COOL TECH FLOOR LIGHTING WASH */}
      <spotLight
        position={[15, 2.8, 0]}
        target-position={[15, 0, 0]}
        intensity={2.5}
        color="#38bdf8"
        angle={0.8}
        penumbra={0.5}
        distance={8.0}
      />
    </group>
  );
}
