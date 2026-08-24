import { useMemo } from "react";
import { Sky, Instances, Instance } from "@react-three/drei";
import {
  COURTYARD,
  COURTYARD_BARRIERS,
  COURT_TREES,
  COURT_BENCHES,
  COURT_PLANTERS,
  COURT_LAMPS,
  DOOR,
  INTERIOR,
  HEDGE_H,
  type Wall,
} from "./layout";
import { M, floorFor } from "./materials";

const SUN: [number, number, number] = [60, 40, -30];

// The paved plaza sits inside a ring of grass, a service road and a sidewalk,
// so the world reads as a real city block instead of a floating platform.
const GRASS_PAD = 26; // grass beyond the courtyard edge
const ROAD_Z0 = COURTYARD.maxZ + 14; // service road, south of the plaza
const ROAD_W = 9;
const FAR = 900; // far ground extent

/** Foliage clusters making up one tree crown (offset, radius, dark). */
const CROWN: [number, number, number, number, 0 | 1][] = [
  [0, 3.5, 0, 1.75, 0],
  [-1.1, 3.0, 0.7, 1.25, 0],
  [1.2, 3.2, -0.6, 1.15, 1],
  [0.3, 4.6, 0.4, 1.2, 1],
  [-0.6, 4.1, -0.9, 0.95, 0],
];

/** One hedge/planter run (green box) from a courtyard barrier wall. */
function HedgeSeg({ w }: { w: Wall }) {
  const horizontal = Math.abs(w.z1 - w.z0) < 1e-6;
  const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const cx = (w.x0 + w.x1) / 2;
  const cz = (w.z0 + w.z1) / 2;
  const t = 0.7;
  const size: [number, number, number] = horizontal
    ? [len, w.h, t]
    : [t, w.h, len];
  return (
    <group position={[cx, 0, cz]}>
      {/* stone kerb the planting sits in */}
      <mesh position={[0, 0.09, 0]} receiveShadow>
        <boxGeometry
          args={horizontal ? [len, 0.18, t + 0.14] : [t + 0.14, 0.18, len]}
        />
        <primitive object={M.curb} attach="material" />
      </mesh>
      <mesh position={[0, w.h / 2 + 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={size} />
        <primitive object={M.hedge} attach="material" />
      </mesh>
    </group>
  );
}

export function Courtyard() {
  const { minX, maxX, minZ, maxZ } = COURTYARD;
  const cw = maxX - minX;
  const cd = maxZ - minZ;
  const ccx = (minX + maxX) / 2;
  const ccz = (minZ + maxZ) / 2;

  // Distant skyline — two depth bands so the horizon has parallax and the
  // silhouettes overlap instead of reading as one lonely ring.
  const skyline = useMemo(() => {
    const boxes: {
      x: number;
      z: number;
      w: number;
      h: number;
      d: number;
      mat: 0 | 1 | 2;
    }[] = [];
    const bands: { r: number; count: number; base: number; span: number }[] = [
      { r: 105, count: 22, base: 16, span: 30 },
      { r: 165, count: 26, base: 30, span: 62 },
    ];
    let n = 0;
    bands.forEach((band, bi) => {
      for (let i = 0; i < band.count; i++) {
        n++;
        const a = (i / band.count) * Math.PI * 2 + bi * 0.4;
        const jitter = ((n * 53) % 31) - 15;
        const r = band.r + jitter;
        const h = band.base + ((n * 37) % band.span);
        const w = 11 + ((n * 17) % 18);
        boxes.push({
          x: Math.sin(a) * r,
          z: Math.cos(a) * r,
          w,
          h,
          d: w * (0.7 + ((n * 7) % 6) / 10),
          mat: (n % 3) as 0 | 1 | 2,
        });
      }
    });
    return boxes;
  }, []);

  const towers = [M.towerA, M.towerB, M.towerC];

  return (
    <group name="courtyard">
      {/* Procedural sky (pure shader — no HDRI fetch) */}
      <Sky
        sunPosition={SUN}
        turbidity={5}
        rayleigh={1.1}
        mieCoefficient={0.005}
        mieDirectionalG={0.86}
      />

      {/* Far ground so the world never ends in a void */}
      <mesh
        position={[0, -0.16, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[FAR, FAR]} />
        <primitive object={floorFor("lawn", FAR, FAR)} attach="material" />
      </mesh>

      {/* Lawn apron hugging the block, then sidewalk + road to the south */}
      <mesh
        position={[0, -0.05, ccz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[cw + GRASS_PAD * 2, cd + GRASS_PAD * 2]} />
        <primitive
          object={floorFor("lawn", cw + GRASS_PAD * 2, cd + GRASS_PAD * 2)}
          attach="material"
        />
      </mesh>
      <mesh
        position={[0, -0.02, ROAD_Z0 - ROAD_W / 2 - 2.6]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[420, 5]} />
        <primitive object={floorFor("walkway", 420, 5)} attach="material" />
      </mesh>
      <mesh position={[0, 0.06, ROAD_Z0 - ROAD_W / 2 - 0.1]} receiveShadow>
        <boxGeometry args={[420, 0.24, 0.34]} />
        <primitive object={M.curb} attach="material" />
      </mesh>
      <mesh
        position={[0, -0.03, ROAD_Z0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[420, ROAD_W]} />
        <primitive
          object={floorFor("asphalt", 420, ROAD_W)}
          attach="material"
        />
      </mesh>
      {/* Lane markings */}
      {Array.from({ length: 42 }, (_, i) => -200 + i * 10).map((x) => (
        <mesh
          key={x}
          position={[x, -0.02, ROAD_Z0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[4.2, 0.22]} />
          <primitive object={M.curb} attach="material" />
        </mesh>
      ))}
      <mesh position={[0, 0.06, ROAD_Z0 + ROAD_W / 2 + 0.1]} receiveShadow>
        <boxGeometry args={[420, 0.24, 0.34]} />
        <primitive object={M.curb} attach="material" />
      </mesh>

      {/* Plaza paving */}
      <mesh
        position={[ccx, 0, ccz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[cw, cd]} />
        <primitive object={floorFor("plaza", cw, cd)} attach="material" />
      </mesh>
      {/* Entrance runway (lighter stone) leading to the door */}
      <mesh
        position={[
          (DOOR.x0 + DOOR.x1) / 2,
          0.014,
          (INTERIOR.maxZ + minZ) / 2 + 4,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry
          args={[DOOR.x1 - DOOR.x0 + 3.5, minZ - INTERIOR.maxZ + 12]}
        />
        <primitive object={M.stoneCounter} attach="material" />
      </mesh>
      {/* Dark banding across the plaza to break up the paving */}
      {[27, 32, 37, 42].map((z) => (
        <mesh
          key={z}
          position={[ccx, 0.012, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[cw - 2, 0.5]} />
          <primitive object={M.pavementTrim} attach="material" />
        </mesh>
      ))}

      {/* Hedges ringing the plaza */}
      {COURTYARD_BARRIERS.map((w, i) => (
        <HedgeSeg key={i} w={w} />
      ))}
      {/* Fill the front hedge line on either side of the runway */}
      {(
        [
          [(minX + (DOOR.x0 - 4)) / 2, DOOR.x0 - 4 - minX],
          [(maxX + (DOOR.x1 + 4)) / 2, maxX - (DOOR.x1 + 4)],
        ] as [number, number][]
      ).map(([cx, len], i) => (
        <mesh
          key={`fh${i}`}
          position={[cx, HEDGE_H / 2 + 0.1, INTERIOR.maxZ + 0.4]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[Math.abs(len), HEDGE_H, 0.7]} />
          <primitive object={M.hedge} attach="material" />
        </mesh>
      ))}

      {/* Raised planting beds (replaces the old reflecting pool) */}
      {COURT_PLANTERS.map(([x, z, w, d], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.44, d]} />
            <primitive object={M.curb} attach="material" />
          </mesh>
          <mesh position={[0, 0.5, 0]} receiveShadow>
            <boxGeometry args={[w - 0.3, 0.16, d - 0.3]} />
            <primitive object={M.hedge} attach="material" />
          </mesh>
          {[-w / 4, w / 4].map((dx) => (
            <mesh key={dx} position={[dx, 0.95, 0]} castShadow>
              <icosahedronGeometry args={[0.7, 1]} />
              <primitive object={M.leafDark} attach="material" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Brand monument — set off the entrance axis so it frames the approach
          rather than blocking the view of the doors from the spawn point. */}
      <group position={[-15.5, 0, 29.5]} rotation={[0, 0.34, 0]}>
        <mesh position={[0, 0.12, 0]} receiveShadow>
          <boxGeometry args={[5.2, 0.24, 1.2]} />
          <primitive object={M.curb} attach="material" />
        </mesh>
        <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.4, 1.6, 0.36]} />
          <primitive object={M.featureWall} attach="material" />
        </mesh>
        {[-1.25, 0, 1.25].map((dx) => (
          <mesh
            key={dx}
            position={[dx, 1.12, 0.21]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.4, 0.4, 0.06, 6]} />
            <primitive object={M.logo} attach="material" />
          </mesh>
        ))}
        <mesh position={[0, 0.27, 0.42]}>
          <boxGeometry args={[4.1, 0.05, 0.08]} />
          <primitive object={M.stripWarm} attach="material" />
        </mesh>
      </group>

      {/* Lamp posts (emissive heads + a small pool of light each) */}
      {COURT_LAMPS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.1, 0]} receiveShadow>
            <cylinderGeometry args={[0.28, 0.32, 0.2, 12]} />
            <primitive object={M.lampPost} attach="material" />
          </mesh>
          <mesh position={[0, 2.3, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.13, 4.4, 12]} />
            <primitive object={M.lampPost} attach="material" />
          </mesh>
          <mesh position={[0, 4.5, 0]} castShadow>
            <boxGeometry args={[0.7, 0.16, 0.34]} />
            <primitive object={M.lampPost} attach="material" />
          </mesh>
          <mesh position={[0, 4.4, 0]}>
            <boxGeometry args={[0.58, 0.06, 0.26]} />
            <primitive object={M.lampGlow} attach="material" />
          </mesh>
          <pointLight
            position={[0, 4.2, 0]}
            color="#ffe8bb"
            intensity={12}
            distance={11}
            decay={2}
          />
        </group>
      ))}

      {/* Trees: tapered trunk + a crown built from overlapping clusters, so the
          silhouette reads as foliage instead of a single lollipop sphere. */}
      <Instances
        range={COURT_TREES.length}
        limit={COURT_TREES.length}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.16, 0.32, 3.1, 8]} />
        <primitive object={M.trunk} attach="material" />
        {COURT_TREES.map((t, i) => (
          <Instance key={i} position={[t.position[0], 1.55, t.position[2]]} />
        ))}
      </Instances>
      {CROWN.map(([ox, oy, oz, r, dark], c) => (
        <Instances
          key={c}
          range={COURT_TREES.length}
          limit={COURT_TREES.length}
          castShadow
        >
          <icosahedronGeometry args={[r, 1]} />
          <primitive object={dark ? M.leafDark : M.leaf} attach="material" />
          {COURT_TREES.map((t, i) => {
            // Deterministic per-tree variation so the row isn't a clone army.
            const v = 0.86 + ((i * 17 + c * 7) % 9) / 26;
            const spin = (i * 1.1 + c * 0.9) % 6.283;
            return (
              <Instance
                key={i}
                position={[
                  t.position[0] + ox * v,
                  oy * v + 0.2,
                  t.position[2] + oz * v,
                ]}
                rotation={[0, spin, (((i + c) % 3) - 1) * 0.18]}
                scale={[v, v * 0.82, v]}
              />
            );
          })}
        </Instances>
      ))}
      {/* Tree grates */}
      <Instances range={COURT_TREES.length} limit={COURT_TREES.length}>
        <cylinderGeometry args={[1.05, 1.05, 0.06, 16]} />
        <primitive object={M.metalDark} attach="material" />
        {COURT_TREES.map((t, i) => (
          <Instance key={i} position={[t.position[0], 0.04, t.position[2]]} />
        ))}
      </Instances>

      {/* Benches: slatted seat on two legs */}
      {COURT_BENCHES.map((b, i) => (
        <group key={i} position={b.position} rotation={b.rotation}>
          {[-0.17, 0, 0.17].map((dz) => (
            <mesh key={dz} position={[0, 0.45, dz]} castShadow receiveShadow>
              <boxGeometry args={[2.1, 0.08, 0.14]} />
              <primitive object={M.woodLight} attach="material" />
            </mesh>
          ))}
          {[-0.85, 0.85].map((dx) => (
            <mesh key={dx} position={[dx, 0.21, 0]} castShadow>
              <boxGeometry args={[0.1, 0.42, 0.48]} />
              <primitive object={M.metalDark} attach="material" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Bollards flanking the entrance runway */}
      <Instances range={12} limit={12} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 0.85, 10]} />
        <primitive object={M.metalBrushed} attach="material" />
        {Array.from({ length: 12 }, (_, i) => {
          const side = i % 2 === 0 ? -4.6 : 4.6;
          const z = INTERIOR.maxZ + 3 + Math.floor(i / 2) * 3.2;
          return <Instance key={i} position={[side, 0.42, z]} />;
        })}
      </Instances>

      {/* Distant skyline — three facade densities, two depth bands */}
      {towers.map((mat, m) => {
        const band = skyline.filter((b) => b.mat === m);
        if (band.length === 0) return null;
        return (
          <Instances key={m} range={band.length} limit={band.length}>
            <boxGeometry args={[1, 1, 1]} />
            <primitive object={mat} attach="material" />
            {band.map((b, i) => (
              <Instance
                key={i}
                position={[b.x, b.h / 2, b.z]}
                scale={[b.w, b.h, b.d]}
              />
            ))}
          </Instances>
        );
      })}
    </group>
  );
}
