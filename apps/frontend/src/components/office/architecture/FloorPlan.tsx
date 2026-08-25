import React from "react";
import { FloorMaterials } from "../materials/FloorMaterial";

/**
 * FloorPlan Architectural Base Platform
 * Total office dimensions: 38m x 38m elevated architectural slab
 * Ground elevation: y = 0
 * Slab thickness: 0.2m (y = -0.1 to +0.1)
 */
export function FloorPlan() {
  return (
    <group name="office-floorplan">
      {/* GROUND PLATFORM FOUNDATION (Elevated architectural slab with bevel finish) */}
      <mesh position={[0, -0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[38.4, 0.2, 38.4]} />
        <primitive object={FloorMaterials.slabBase} attach="material" />
      </mesh>

      {/* BASEBOARD ACCENT TRIM BORDER */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[38.0, 0.02, 38.0]} />
        <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* ZONE 1: CENTRAL WORKSPACE CORE (Polished Studio Concrete Floor) */}
      {/* Positioned at center-west: x = [-18 to 2], z = [-6 to 18] */}
      <mesh position={[-8, 0.02, 6]} receiveShadow>
        <boxGeometry args={[20, 0.01, 24]} />
        <primitive object={FloorMaterials.polishedConcrete} attach="material" />
      </mesh>

      {/* ZONE 2: GLASS CONFERENCE ROOM (Executive Dark Walnut Parquet Floor) */}
      {/* Positioned at north-east: x = [2 to 18], z = [-18 to -3] */}
      <mesh position={[10, 0.02, -10.5]} receiveShadow>
        <boxGeometry args={[16, 0.01, 15]} />
        <primitive object={FloorMaterials.walnutParquet} attach="material" />
      </mesh>

      {/* ZONE 3: AI / COMMAND CENTER (Dark Charcoal Slate Floor) */}
      {/* Positioned at north-west: x = [-18 to 2], z = [-18 to -6] */}
      <mesh position={[-8, 0.02, -12]} receiveShadow>
        <boxGeometry args={[20, 0.01, 12]} />
        <primitive object={FloorMaterials.charcoalSlate} attach="material" />
      </mesh>

      {/* ZONE 4: SERVER / INFRASTRUCTURE ROOM (High-Tech Charcoal Slate Grid) */}
      {/* Positioned at east wall center: x = [12 to 18], z = [-3 to 3] */}
      <mesh position={[15, 0.02, 0]} receiveShadow>
        <boxGeometry args={[6, 0.01, 6]} />
        <primitive object={FloorMaterials.charcoalSlate} attach="material" />
      </mesh>

      {/* ZONE 5: LOUNGE AREA (Warm Oak Planks + Woven Area Rug) */}
      {/* Positioned at south-east: x = [2 to 18], z = [3 to 18] */}
      <mesh position={[10, 0.02, 10.5]} receiveShadow>
        <boxGeometry args={[16, 0.01, 15]} />
        <primitive object={FloorMaterials.warmOakPlanks} attach="material" />
      </mesh>

      {/* LOUNGE WOVEN TEXTILE RUG */}
      <mesh position={[10, 0.03, 10.5]} receiveShadow>
        <boxGeometry args={[8.5, 0.015, 6.5]} />
        <primitive object={FloorMaterials.loungeRug} attach="material" />
      </mesh>

      {/* ZONE 6: KITCHEN / COFFEE BAR (Polished Quartz Terrazzo Floor) */}
      {/* Positioned at south-west corner: x = [-18 to -10], z = [10 to 18] */}
      <mesh position={[-14, 0.02, 14]} receiveShadow>
        <boxGeometry args={[8, 0.01, 8]} />
        <primitive object={FloorMaterials.kitchenTerrazzo} attach="material" />
      </mesh>
    </group>
  );
}
