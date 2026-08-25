import React from "react";
import { WoodMaterials } from "../materials/WoodMaterial";
import { MetalMaterials } from "../materials/MetalMaterial";

/**
 * Procedural Architectural Indoor Plant (Monstera / Ficus in Minimalist Planter Pot)
 */
function PottedPlant({
  position,
  scale = 1.0,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Ceramic Planter Pot */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.22, 0.7, 24]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 16]} />
        <meshStandardMaterial color="#271c16" roughness={0.9} />
      </mesh>
      {/* Foliage Leaf Cluster */}
      {[
        { pos: [0, 1.0, 0], rot: [0, 0, 0.2], s: 0.4 },
        { pos: [0.15, 1.15, 0.1], rot: [0.3, 0.5, -0.2], s: 0.45 },
        { pos: [-0.15, 1.1, -0.1], rot: [-0.3, -0.4, 0.3], s: 0.42 },
        { pos: [0, 1.25, -0.05], rot: [0.1, 1.2, 0.1], s: 0.38 },
      ].map((leaf, idx) => (
        <group
          key={idx}
          position={leaf.pos as [number, number, number]}
          rotation={leaf.rot as [number, number, number]}
        >
          <mesh castShadow>
            <sphereGeometry args={[leaf.s, 12, 12]} />
            <meshStandardMaterial color="#15803d" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Office Architectural Decor & Environmental Objects
 */
export function OfficeDecor() {
  const plantPositions: [number, number, number][] = [
    [-17, 0, -5],
    [-17, 0, 5],
    [17, 0, -17],
    [17, 0, 17],
    [1.0, 0, 4.0],
    [-2.0, 0, 10.0],
  ];

  return (
    <group name="office-decor">
      {/* POTTED ARCHITECTURAL PLANTS */}
      {plantPositions.map((pos, i) => (
        <PottedPlant key={i} position={pos} scale={1.1} />
      ))}

      {/* ARCHITECTURAL SHELVING UNIT & DISPLAY (North wall of Lounge: x = 16, z = 4) */}
      <group position={[16, 0, 4]}>
        {/* Wooden Shelf Frame */}
        <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 2.2, 0.4]} />
          <primitive object={WoodMaterials.lightBirch} attach="material" />
        </mesh>

        {/* Shelf Accessories (Books & Minimalist Sculptures) */}
        {[-0.8, 0, 0.8].map((posX, i) => (
          <mesh key={i} position={[posX, 1.3, 0]} castShadow>
            <boxGeometry args={[0.3, 0.4, 0.25]} />
            <primitive object={MetalMaterials.darkGraphite} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
