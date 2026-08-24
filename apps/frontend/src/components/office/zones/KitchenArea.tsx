import { WoodMaterials } from "../materials/WoodMaterial";
import { MetalMaterials } from "../materials/MetalMaterial";
import { FloorMaterials } from "../materials/FloorMaterial";

/**
 * Premium Coffee Station & Kitchen Area (Position: x = -14, z = 14)
 */
export function KitchenArea() {
  return (
    <group name="kitchen-area">
      {/* KITCHEN COUNTER WITH POLISHED TERRAZZO/QUARTZ TOP */}
      <group position={[-14, 0, 16.5]}>
        {/* Main Cabinet Base Body */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.2, 0.9, 1.2]} />
          <primitive object={WoodMaterials.darkWalnut} attach="material" />
        </mesh>
        {/* Counter Top Slab */}
        <mesh position={[0, 0.93, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.3, 0.06, 1.28]} />
          <primitive
            object={FloorMaterials.kitchenTerrazzo}
            attach="material"
          />
        </mesh>

        {/* COMMERCIAL ESPRESSO MACHINE */}
        <group position={[-1.6, 1.15, 0]}>
          {/* Main Metallic Body */}
          <mesh castShadow>
            <boxGeometry args={[0.7, 0.44, 0.5]} />
            <primitive
              object={MetalMaterials.brushedAluminum}
              attach="material"
            />
          </mesh>
          {/* Portafilters & Pressure Gauges */}
          <mesh
            position={[0, -0.1, 0.28]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.03, 0.03, 0.16, 12]} />
            <primitive object={MetalMaterials.darkGraphite} attach="material" />
          </mesh>
          {/* Cup Warming Top Tray */}
          <mesh position={[0, 0.23, 0]} castShadow>
            <boxGeometry args={[0.66, 0.04, 0.46]} />
            <primitive
              object={MetalMaterials.brushedAluminum}
              attach="material"
            />
          </mesh>
        </group>

        {/* OVERHEAD CABINETS */}
        <mesh position={[0, 2.2, 0.2]} castShadow receiveShadow>
          <boxGeometry args={[5.2, 0.7, 0.8]} />
          <primitive object={WoodMaterials.darkWalnut} attach="material" />
        </mesh>
      </group>

      {/* WOODEN HIGH BAR STOOLS (Arranged along counter island x = -14, z = 12) */}
      {[-16.0, -14.0, -12.0].map((posX, i) => (
        <group key={i} position={[posX, 0, 13.5]}>
          {/* Circular Wooden Seat */}
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.05, 24]} />
            <primitive object={WoodMaterials.warmOak} attach="material" />
          </mesh>
          {/* Slender Metal Legs */}
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.22, 0.7, 12]} />
            <primitive
              object={MetalMaterials.matteBlackMetal}
              attach="material"
            />
          </mesh>
        </group>
      ))}

      {/* WARM PENDANT LIGHT FIXTURES */}
      {[-15.5, -12.5].map((posX, i) => (
        <group key={i} position={[posX, 2.8, 14.5]}>
          {/* Drop Cord */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.5, 8]} />
            <primitive
              object={MetalMaterials.matteBlackMetal}
              attach="material"
            />
          </mesh>
          {/* Cone Shade */}
          <mesh position={[0, -0.1, 0]} castShadow>
            <coneGeometry args={[0.18, 0.22, 24]} />
            <primitive object={MetalMaterials.mutedBrass} attach="material" />
          </mesh>
          {/* Bulb Warm Light */}
          <pointLight
            position={[0, -0.25, 0]}
            intensity={1.2}
            distance={5.0}
            color="#fde047"
          />
        </group>
      ))}
    </group>
  );
}
