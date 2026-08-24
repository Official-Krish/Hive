import React from "react";
import { WoodMaterials } from "../materials/WoodMaterial";
import { MetalMaterials } from "../materials/MetalMaterial";
import { FabricMaterials } from "../materials/FabricMaterial";

/**
 * Premium Warm Lounge Area (Position: x = 10, z = 10.5)
 */
export function LoungeArea() {
  return (
    <group name="lounge-area">
      {/* CUSTOM L-SHAPED SECTIONAL SOFA */}
      <group position={[10, 0, 11]}>
        {/* Main Sofa Base Seat Cushion */}
        <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.28, 1.4]} />
          <primitive object={FabricMaterials.sofaCharcoal} attach="material" />
        </mesh>
        {/* L-Extension Return Cushion (West Side) */}
        <mesh position={[-1.4, 0.28, -1.2]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 0.28, 1.0]} />
          <primitive object={FabricMaterials.sofaCharcoal} attach="material" />
        </mesh>
        {/* Backrest Wall */}
        <mesh position={[0, 0.65, 0.6]} castShadow receiveShadow>
          <boxGeometry args={[4.2, 0.5, 0.25]} />
          <primitive object={FabricMaterials.sofaCharcoal} attach="material" />
        </mesh>
        {/* Side Armrest */}
        <mesh position={[2.0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.25, 0.38, 1.4]} />
          <primitive object={FabricMaterials.sofaCharcoal} attach="material" />
        </mesh>

        {/* Decorative Throw Cushions */}
        <mesh
          position={[-0.8, 0.48, 0.45]}
          rotation={[0.1, 0.2, 0.1]}
          castShadow
        >
          <boxGeometry args={[0.4, 0.4, 0.12]} />
          <primitive
            object={FabricMaterials.terracottaFabric}
            attach="material"
          />
        </mesh>
        <mesh
          position={[1.2, 0.48, 0.45]}
          rotation={[0.1, -0.25, 0]}
          castShadow
        >
          <boxGeometry args={[0.4, 0.4, 0.12]} />
          <primitive
            object={FabricMaterials.terracottaFabric}
            attach="material"
          />
        </mesh>
      </group>

      {/* LOW WOODEN COFFEE TABLE */}
      <group position={[10, 0, 8.5]}>
        {/* Table Top Surface (Warm Oak) */}
        <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.06, 1.0]} />
          <primitive object={WoodMaterials.warmOak} attach="material" />
        </mesh>
        {/* Table Legs */}
        <mesh position={[-0.9, 0.18, 0.4]} castShadow>
          <cylinderGeometry args={[0.03, 0.02, 0.36, 12]} />
          <primitive object={MetalMaterials.darkGraphite} attach="material" />
        </mesh>
        <mesh position={[0.9, 0.18, 0.4]} castShadow>
          <cylinderGeometry args={[0.03, 0.02, 0.36, 12]} />
          <primitive object={MetalMaterials.darkGraphite} attach="material" />
        </mesh>
        <mesh position={[-0.9, 0.18, -0.4]} castShadow>
          <cylinderGeometry args={[0.03, 0.02, 0.36, 12]} />
          <primitive object={MetalMaterials.darkGraphite} attach="material" />
        </mesh>
        <mesh position={[0.9, 0.18, -0.4]} castShadow>
          <cylinderGeometry args={[0.03, 0.02, 0.36, 12]} />
          <primitive object={MetalMaterials.darkGraphite} attach="material" />
        </mesh>

        {/* COFFEE TABLE DETAILS (Hardcover Design Books & Ceramic Cup) */}
        <mesh position={[-0.4, 0.42, 0.1]} rotation={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[0.3, 0.04, 0.4]} />
          <meshStandardMaterial color="#334155" roughness={0.3} />
        </mesh>
        <mesh position={[0.5, 0.44, -0.1]} castShadow>
          <cylinderGeometry args={[0.04, 0.035, 0.08, 16]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
      </group>

      {/* ACOUSTIC FELT WALL PANELS (On East Wall: x = 18.2) */}
      <group position={[18.2, 1.6, 10.5]}>
        {[-2.0, 0, 2.0].map((posZ, i) => (
          <mesh key={i} position={[0, 0, posZ]} castShadow>
            <boxGeometry args={[0.04, 2.0, 1.4]} />
            <primitive
              object={FabricMaterials.acousticFelt}
              attach="material"
            />
          </mesh>
        ))}
      </group>

      {/* WARM LOUNGE SPOTLIGHT */}
      <spotLight
        position={[10, 3.2, 10]}
        target-position={[10, 0, 10]}
        intensity={2.8}
        color="#fef08a"
        angle={0.9}
        penumbra={0.6}
        distance={10.0}
      />
    </group>
  );
}
