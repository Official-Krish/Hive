import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { M } from "./materials";
import { INTERIOR, EXT_H, L2_Y, ROOF_T, DOOR } from "./layout";

/**
 * CookFox-style exterior dressing for our own building (reference: 512W22,
 * Chelsea — soft-cornered glass mass, dark metallic spandrel bands, planted
 * crown, glowing lobby at dusk).
 *
 * Strictly additive décor on the OUTSIDE of the layout walls: no wall moves,
 * no collider changes, no interactable changes. Delete this group and the
 * building plays identically.
 */

// Dark bronze — anthracite terracotta / patinaed zinc read.
const bronze = new THREE.MeshStandardMaterial({
  color: "#2b2620",
  roughness: 0.38,
  metalness: 0.82,
  envMapIntensity: 1.1,
});

const { minX, maxX, minZ, maxZ } = INTERIOR;
const ROOF_TOP = EXT_H + ROOF_T;

/** Continuous spandrel band courses wrapping the glass facades. */
function BandCourses() {
  return (
    <group name="facade-bands">
      {/* south glass facade: L2 slab band + sash transom rail */}
      <mesh position={[0, L2_Y - 0.15, maxZ + 0.1]} castShadow>
        <boxGeometry args={[maxX - minX + 0.8, 0.55, 0.2]} />
        <primitive object={bronze} attach="material" />
      </mesh>
      <mesh position={[0, 2.62, maxZ + 0.08]}>
        <boxGeometry args={[maxX - minX + 0.8, 0.16, 0.14]} />
        <primitive object={bronze} attach="material" />
      </mesh>
      {/* ribbon drip above the entrance header */}
      <mesh position={[(DOOR.x0 + DOOR.x1) / 2, 3.78, maxZ + 0.1]}>
        <boxGeometry args={[DOOR.x1 - DOOR.x0 + 1.6, 0.18, 0.2]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      {/* east + west returns: L2 band on the outer masonry faces */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * (maxX + 0.28), L2_Y - 0.15, (minZ + maxZ) / 2]}
          castShadow
        >
          <boxGeometry args={[0.2, 0.55, maxZ - minZ]} />
          <primitive object={bronze} attach="material" />
        </mesh>
      ))}
      {/* parapet cap already exists in Shell; this bronze reglet under it
          ties the crown to the band system */}
      <mesh position={[0, ROOF_TOP - 0.35, maxZ + 0.06]}>
        <boxGeometry args={[maxX - minX + 0.8, 0.22, 0.16]} />
        <primitive object={bronze} attach="material" />
      </mesh>
    </group>
  );
}

/** Soft corners: full-height rounded bronze piers swallowing the four
 *  glass corners, like the reference's glass-arcs-around-corners. */
function CornerPiers() {
  const corners: [number, number][] = [
    [minX, minZ],
    [maxX, minZ],
    [minX, maxZ],
    [maxX, maxZ],
  ];
  return (
    <Instances range={corners.length} limit={corners.length} castShadow>
      <cylinderGeometry args={[0.42, 0.46, EXT_H, 14]} />
      <primitive object={bronze} attach="material" />
      {corners.map(([x, z], i) => (
        <Instance key={i} position={[x, EXT_H / 2, z]} />
      ))}
    </Instances>
  );
}

/** Planted crown: parapet planter tray + drifts + three small roof trees,
 *  silhouetted above the parapet from the plaza like the reference roof. */
function CrownPlanting() {
  const blobs = useMemo(() => {
    const out: { p: [number, number, number]; r: number; dark: boolean }[] = [];
    for (let i = 0; i < 16; i++) {
      const x = -19 + i * 2.5 + ((i * 37) % 10) * 0.1;
      out.push({
        p: [x, ROOF_TOP + 0.95 + ((i * 53) % 4) * 0.12, maxZ - 1.6],
        r: 0.5 + ((i * 29) % 5) * 0.11,
        dark: i % 2 === 0,
      });
    }
    return out;
  }, []);
  const trees: [number, number][] = [
    [-14, maxZ - 2.2],
    [2, maxZ - 2.2],
    [16, maxZ - 2.2],
  ];
  const dark = blobs.filter((b) => b.dark);
  const light = blobs.filter((b) => !b.dark);
  return (
    <group name="crown-planting">
      {/* planter tray */}
      <mesh
        position={[0, ROOF_TOP + 0.25, maxZ - 1.6]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[42, 0.5, 1.7]} />
        <primitive object={M.precastDark} attach="material" />
      </mesh>
      <mesh position={[0, ROOF_TOP + 0.48, maxZ - 1.6]} receiveShadow>
        <boxGeometry args={[41.6, 0.08, 1.3]} />
        <primitive object={M.mulch} attach="material" />
      </mesh>
      <Instances range={dark.length} limit={dark.length} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <primitive object={M.leafDark} attach="material" />
        {dark.map((b, i) => (
          <Instance key={i} position={b.p} scale={b.r} />
        ))}
      </Instances>
      <Instances range={light.length} limit={light.length} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <primitive object={M.leaf} attach="material" />
        {light.map((b, i) => (
          <Instance key={i} position={b.p} scale={b.r} />
        ))}
      </Instances>
      {/* three roof trees */}
      <Instances range={trees.length} limit={trees.length} castShadow>
        <cylinderGeometry args={[0.09, 0.14, 1.4, 7]} />
        <primitive object={M.trunk} attach="material" />
        {trees.map(([x, z], i) => (
          <Instance key={i} position={[x, ROOF_TOP + 1.0, z]} />
        ))}
      </Instances>
      <Instances range={trees.length} limit={trees.length} castShadow>
        <icosahedronGeometry args={[1.05, 1]} />
        <primitive object={M.leaf} attach="material" />
        {trees.map(([x, z], i) => (
          <Instance key={i} position={[x, ROOF_TOP + 2.4, z]} />
        ))}
      </Instances>
    </group>
  );
}

/** Dusk lobby glow: warm additive wash just inside the south glass so the
 *  facade reads as lit offices (reference, blue hour) while the real
 *  interior stays visible through it. */
function LobbyGlow() {
  const segs: [number, number][] = [
    [(minX + DOOR.x0) / 2, DOOR.x0 - minX],
    [(DOOR.x1 + maxX) / 2, maxX - DOOR.x1],
  ];
  return (
    <group name="lobby-glow">
      {segs.map(([cx, w], i) => (
        <mesh key={i} position={[cx, 2.6, maxZ - 1.4]} renderOrder={30}>
          <planeGeometry args={[w - 0.6, 4.6]} />
          <meshBasicMaterial
            color="#ffca8a"
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      ))}
      {/* transom wash above the entrance */}
      <mesh
        position={[(DOOR.x0 + DOOR.x1) / 2, 6.0, maxZ - 1.4]}
        renderOrder={30}
      >
        <planeGeometry args={[DOOR.x1 - DOOR.x0 + 0.6, 4.4]} />
        <meshBasicMaterial
          color="#ffca8a"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

export function FacadeDressing() {
  return (
    <group name="facade-dressing">
      <BandCourses />
      <CornerPiers />
      <CrownPlanting />
      <LobbyGlow />
    </group>
  );
}
