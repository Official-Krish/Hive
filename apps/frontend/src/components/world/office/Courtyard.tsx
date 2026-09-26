import { useMemo, useRef } from "react";
import { Sky, Instances, Instance } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
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
  NEIGHBORS,
  STREETS,
  type Neighbor,
  type Wall,
} from "./layout";
import {
  M,
  floorFor,
  facadeFor,
  slabFor,
  decoFor,
  ventFor,
  storefrontFor,
} from "./materials";
import { KitInstances } from "./KitInstances";
import { monumentTexture, marqueeTexture, bladeTexture } from "./signage";

// Aligned with the directional SUN in OfficeLighting so the sky disc and the
// shadow direction agree.
const SUN: [number, number, number] = [72, 32, -28];

/** Real courtyard point lights only on capable desktops — the emissive lamp
 *  heads carry the look everywhere else. */
const LAMP_LIGHTS =
  typeof window !== "undefined" &&
  !window.matchMedia("(pointer: coarse)").matches &&
  Math.min(window.innerWidth, window.innerHeight) >= 700;

// The paved plaza sits inside a trimmed planting band, then the streets and the
// neighbouring city block, so the world reads as a real block, not a platform.
const GRASS_PAD = 9; // planting band hugging the plaza edge
const ROAD_Z0 = STREETS.frontZ; // service road, south of the plaza
const ROAD_W = STREETS.width;
const SIDE_X = STREETS.sideX; // north–south side streets
const FAR = 900; // far ground extent

/** Ground-floor storey height shared by every neighbouring block. */
const PLINTH_H = 4.6;

/** Skyscraper archetype per block: glass curtain tower, lit crown,
 *  art-deco spire, residential slab, brick warehouse. Derived from height +
 *  index so neighbours never match their immediate siblings. */
type Arch = "brick" | "glass" | "deco" | "slab" | "crown";
function archFor(n: Neighbor, index: number): Arch {
  if (n.style === 3) return "brick";
  if (n.h >= 50)
    return (["glass", "crown", "deco"] as const)[index % 3] ?? "glass";
  if (n.h >= 30)
    return (["slab", "glass", "deco"] as const)[index % 3] ?? "glass";
  return index % 2 === 0 ? "slab" : "glass";
}

/** Gold crown glow (Chrysler nod) — shared, unlit-warm at dusk. */
const crownGold = new THREE.MeshStandardMaterial({
  color: "#3a2c14",
  emissive: "#ffc46a",
  emissiveIntensity: 1.8,
  roughness: 0.4,
  metalness: 0.6,
  toneMapped: false,
});

/**
 * One sealed neighbouring tower. Massing (plinth → shaft → setbacks → crown)
 * is real geometry; near blocks (<120 m) also get entrances, storefronts,
 * fins/balconies. Far blocks are massing + crown only — same skyline for a
 * third of the draws. No interior, no collider, ever.
 */
function Block({ n, index = 0 }: { n: Neighbor; index?: number }) {
  const arch = archFor(n, index);
  const detail = Math.hypot(n.x, n.z) < 120;
  const shops = Math.hypot(n.x, n.z) < 95 && arch !== "brick";
  const upperY = n.setback > 0 ? n.h * n.setbackAt : n.h;
  const bodyH = upperY - PLINTH_H;
  const topH = n.h - upperY;
  const variant = (index % 2) as 0 | 1;

  const shaftMat =
    arch === "brick"
      ? facadeFor(3, n.w, bodyH)
      : arch === "slab"
        ? slabFor(variant, n.w, bodyH)
        : arch === "deco"
          ? decoFor(variant, n.w, bodyH)
          : facadeFor(arch === "crown" ? 1 : n.style, n.w, bodyH);
  const topMat =
    n.setback > 0
      ? arch === "slab"
        ? slabFor(variant, n.w - n.setback * 2, topH)
        : arch === "deco"
          ? decoFor(variant, n.w - n.setback * 2, topH)
          : facadeFor(
              arch === "brick" ? 3 : arch === "crown" ? 1 : n.style,
              n.w - n.setback * 2,
              topH,
            )
      : shaftMat;

  // Outward direction of the entrance face.
  const ex = n.entrance === "e" ? 1 : n.entrance === "w" ? -1 : 0;
  const ez = n.entrance === "s" ? 1 : n.entrance === "n" ? -1 : 0;
  const faceW = ex !== 0 ? n.d : n.w;
  const half = ex !== 0 ? n.w / 2 : n.d / 2;

  const fins = useMemo(() => {
    if (!(detail && (arch === "glass" || arch === "deco") && n.h >= 30))
      return [];
    const count = Math.max(3, Math.floor(faceW / 3));
    return Array.from(
      { length: count },
      (_, i) => -faceW / 2 + 1.5 + (i * (faceW - 3)) / Math.max(1, count - 1),
    );
  }, [detail, arch, n.h, faceW]);

  const balconies = useMemo(() => {
    if (!(detail && arch === "slab" && bodyH > 10)) return [];
    const rows = Math.min(9, Math.floor((bodyH - 3) / 3));
    const cols = Math.min(8, Math.floor((faceW - 3) / 3.2));
    const out: [number, number][] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out.push([-((cols - 1) * 3.2) / 2 + c * 3.2, PLINTH_H + 2.6 + r * 3]);
    return out;
  }, [detail, arch, bodyH, faceW]);

  return (
    <group position={[n.x, 0, n.z]} rotation={[0, n.ry, 0]}>
      {/* Precast ground floor, slightly proud of the tower above */}
      <mesh position={[0, PLINTH_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[n.w + 0.5, PLINTH_H, n.d + 0.5]} />
        <primitive object={M.precast} attach="material" />
      </mesh>
      <mesh position={[0, PLINTH_H + 0.16, 0]} castShadow>
        <boxGeometry args={[n.w + 0.9, 0.32, n.d + 0.9]} />
        <primitive object={M.precastDark} attach="material" />
      </mesh>

      {/* Shaft in the archetype skin */}
      <mesh position={[0, PLINTH_H + bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[n.w, bodyH, n.d]} />
        <primitive object={shaftMat} attach="material" />
      </mesh>

      {/* Mechanical louver band capping the shaft (tall non-brick) */}
      {bodyH > 14 && arch !== "brick" && (
        <mesh position={[0, upperY - 0.7, 0]}>
          <boxGeometry args={[n.w + 0.25, 1.3, n.d + 0.25]} />
          <primitive object={ventFor()} attach="material" />
        </mesh>
      )}

      {/* Setback volume + the terrace it leaves behind */}
      {n.setback > 0 && (
        <>
          <mesh position={[0, upperY + 0.1, 0]} receiveShadow>
            <boxGeometry args={[n.w + 0.3, 0.2, n.d + 0.3]} />
            <primitive object={M.precastDark} attach="material" />
          </mesh>
          <mesh position={[0, upperY + topH / 2, 0]} castShadow receiveShadow>
            <boxGeometry
              args={[n.w - n.setback * 2, topH, n.d - n.setback * 2]}
            />
            <primitive object={topMat} attach="material" />
          </mesh>
        </>
      )}

      {/* --- Crowns per archetype -------------------------------------- */}
      {(arch === "brick" || arch === "slab") && (
        <mesh position={[0, n.h + 0.22 + (index % 3) * 0.12, 0]} castShadow>
          <boxGeometry
            args={[
              (n.setback > 0 ? n.w - n.setback * 2 : n.w) + 0.6,
              0.44 + (index % 3) * 0.24,
              (n.setback > 0 ? n.d - n.setback * 2 : n.d) + 0.6,
            ]}
          />
          <primitive object={M.precastDark} attach="material" />
        </mesh>
      )}
      {arch === "glass" && n.h >= 45 && (
        <group>
          {/* set-back glass crown + needle spire + beacon */}
          <mesh position={[0, n.h + 2, 0]} castShadow>
            <boxGeometry args={[n.w - 7, 4, n.d - 7]} />
            <primitive object={topMat} attach="material" />
          </mesh>
          <mesh position={[0, n.h + 8, 0]}>
            <cylinderGeometry args={[0.1, 0.2, 9, 6]} />
            <primitive object={M.metalDark} attach="material" />
          </mesh>
          <mesh position={[0, n.h + 12.6, 0]}>
            <sphereGeometry args={[0.45, 10, 8]} />
            <meshBasicMaterial color="#f43f5e" toneMapped={false} fog={false} />
          </mesh>
        </group>
      )}
      {arch === "deco" && (
        <group>
          {/* stepped limestone crown + mooring mast + white beacon */}
          <mesh position={[0, n.h + 1, 0]} castShadow>
            <boxGeometry args={[n.w - 5, 2, n.d - 5]} />
            <primitive object={M.precast} attach="material" />
          </mesh>
          <mesh position={[0, n.h + 2.8, 0]} castShadow>
            <boxGeometry args={[n.w - 9, 1.8, n.d - 9]} />
            <primitive object={M.precastDark} attach="material" />
          </mesh>
          <mesh position={[0, n.h + 6.4, 0]}>
            <cylinderGeometry args={[0.35, 0.6, 6, 8]} />
            <primitive object={M.precast} attach="material" />
          </mesh>
          <mesh position={[0, n.h + 10, 0]}>
            <sphereGeometry args={[0.4, 10, 8]} />
            <meshBasicMaterial color="#ffe9b8" toneMapped={false} fog={false} />
          </mesh>
        </group>
      )}
      {arch === "crown" && (
        <group>
          {/* golden lit crown band + shrinking dark cap + needle */}
          <mesh position={[0, n.h - 1.4, 0]}>
            <boxGeometry args={[n.w - 5, 3.4, n.d - 5]} />
            <primitive object={crownGold} attach="material" />
          </mesh>
          <mesh position={[0, n.h + 1.4, 0]} castShadow>
            <boxGeometry args={[n.w - 9, 2.4, n.d - 9]} />
            <primitive object={M.metalDark} attach="material" />
          </mesh>
          <mesh position={[0, n.h + 6.4, 0]}>
            <cylinderGeometry args={[0.09, 0.16, 8, 6]} />
            <primitive object={M.metalDark} attach="material" />
          </mesh>
          <mesh position={[0, n.h + 10.6, 0]}>
            <sphereGeometry args={[0.4, 10, 8]} />
            <meshBasicMaterial color="#f43f5e" toneMapped={false} fog={false} />
          </mesh>
        </group>
      )}

      {/* Rooftop plant box (slab + brick only — towers wear crowns) */}
      {(arch === "slab" || arch === "brick") && (
        <mesh position={[((index % 5) - 2) * 1.6, n.h + 1.2, 0]} castShadow>
          <boxGeometry args={[6, 1.6, 4]} />
          <primitive object={M.metalBrushed} attach="material" />
        </mesh>
      )}

      {/* Vertical fins catching the dusk sun (near glass/deco towers) */}
      {fins.length > 0 && (
        <Instances range={fins.length} limit={fins.length} castShadow>
          <boxGeometry args={[0.16, bodyH * 0.92, 0.5]} />
          <primitive object={M.mullion} attach="material" />
          {fins.map((fx, i) => {
            const px = ex !== 0 ? ex * (half + 0.28) : fx;
            const pz = ez !== 0 ? ez * (half + 0.28) : fx;
            return (
              <Instance
                key={i}
                position={[px, PLINTH_H + bodyH / 2, pz]}
                rotation={[0, ex !== 0 ? Math.PI / 2 : 0, 0]}
              />
            );
          })}
        </Instances>
      )}

      {/* Balcony slabs (near residential slabs) */}
      {balconies.length > 0 && (
        <Instances range={balconies.length} limit={balconies.length} castShadow>
          <boxGeometry args={[2.0, 0.14, 1.0]} />
          <primitive object={M.precast} attach="material" />
          {balconies.map(([bx, by], i) => {
            const px = ex !== 0 ? ex * (half + 0.55) : bx;
            const pz = ez !== 0 ? ez * (half + 0.55) : bx;
            return (
              <Instance
                key={i}
                position={[px, by, pz]}
                rotation={[0, ex !== 0 ? Math.PI / 2 : 0, 0]}
              />
            );
          })}
        </Instances>
      )}

      {/* Entrance: recessed glazing, canopy, lit sign (near blocks only) */}
      {detail && (
        <group
          position={[ex * (half + 0.28), 0, ez * (half + 0.28)]}
          rotation={[0, ex !== 0 ? Math.PI / 2 : 0, 0]}
        >
          <mesh position={[0, 1.9, 0]} renderOrder={10}>
            <boxGeometry args={[Math.min(faceW * 0.5, 11), 3.6, 0.12]} />
            <primitive object={M.glassCheap} attach="material" />
          </mesh>
          {/* warm lobby glow behind the glass so the entrance reads occupied */}
          <mesh position={[0, 1.7, -0.9]}>
            <planeGeometry args={[Math.min(faceW * 0.5, 11) - 0.6, 2.8]} />
            <meshBasicMaterial color="#ffd9a3" toneMapped={false} fog={false} />
          </mesh>
          {/* mullions */}
          {[-1.5, 1.5].map((d) => (
            <mesh key={d} position={[d * 1.3, 1.9, 0.02]}>
              <boxGeometry args={[0.12, 3.6, 0.16]} />
              <primitive object={M.mullion} attach="material" />
            </mesh>
          ))}
          {/* canopy */}
          <mesh position={[0, 3.95, 1.1]} castShadow>
            <boxGeometry args={[Math.min(faceW * 0.62, 14), 0.3, 2.4]} />
            <primitive object={M.precastDark} attach="material" />
          </mesh>
          {/* canopy soffit downlight strip */}
          <mesh position={[0, 3.78, 1.1]}>
            <boxGeometry args={[Math.min(faceW * 0.55, 12), 0.04, 0.18]} />
            <primitive object={M.lampGlow} attach="material" />
          </mesh>
          {/* entrance landing */}
          <mesh position={[0, 0.09, 1.9]} receiveShadow>
            <boxGeometry args={[Math.min(faceW * 0.5, 11), 0.18, 1.6]} />
            <primitive object={M.curb} attach="material" />
          </mesh>
          {/* lit sign band with tenant name above the canopy */}
          <BlockSign
            width={Math.min(faceW * 0.4, 8)}
            index={index}
            warm={n.style === 1}
          />
        </group>
      )}
      {/* Painted storefront planes flanking the entrance — one draw each,
          mullions and interiors baked into the texture. */}
      {shops &&
        [-1, 1].map((s) => {
          const w = Math.min(faceW * 0.24, 7.5);
          const along = (Math.min(faceW * 0.5, 11) / 2 + w / 2 + 1.2) * s;
          return (
            <group key={`shop${s}`}>
              <mesh
                position={[
                  ex !== 0 ? ex * (half + 0.06) : along,
                  1.55,
                  ez !== 0 ? ez * (half + 0.06) : along,
                ]}
                rotation={[0, ex !== 0 ? Math.PI / 2 : 0, 0]}
                renderOrder={10}
              >
                <planeGeometry args={[w, 2.9]} />
                <primitive
                  object={storefrontFor((index + (s + 1) / 2) % 2 === 0)}
                  attach="material"
                />
              </mesh>
              <mesh
                position={[
                  ex !== 0 ? ex * (half + 0.12) : along,
                  3.15,
                  ez !== 0 ? ez * (half + 0.12) : along,
                ]}
                rotation={[0, ex !== 0 ? Math.PI / 2 : 0, 0]}
              >
                <boxGeometry args={[w + 0.2, 0.3, 0.16]} />
                <primitive object={M.precastDark} attach="material" />
              </mesh>
            </group>
          );
        })}
    </group>
  );
}

/** Tenant marquee: emissive band + canvas name face. */
function BlockSign({
  width,
  index,
  warm,
}: {
  width: number;
  index: number;
  warm: boolean;
}) {
  const face = useMemo(
    () => marqueeTexture(index, warm ? "#ffc47a" : "#7dd3fc"),
    [index, warm],
  );
  return (
    <group position={[0, 4.5, 0.12]}>
      <mesh>
        <boxGeometry args={[width, 0.5, 0.1]} />
        <primitive
          object={warm ? M.signBoxWarm : M.signBox}
          attach="material"
        />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[width - 0.3, (width - 0.3) / 8]} />
        <meshBasicMaterial map={face} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Foliage clusters making up one tree crown (offset, radius, dark). */
const CROWN: [number, number, number, number, 0 | 1][] = [
  [0, 3.5, 0, 1.75, 0],
  [-1.1, 3.0, 0.7, 1.25, 0],
  [1.2, 3.2, -0.6, 1.15, 1],
  [0.3, 4.6, 0.4, 1.2, 1],
  [-0.6, 4.1, -0.9, 0.95, 0],
];

/** One hedge/planter run (green box) from a courtyard barrier wall.
 *  Height varies per segment and leaf blobs break the flat box top. */
function HedgeSeg({ w, seed = 0 }: { w: Wall; seed?: number }) {
  const horizontal = Math.abs(w.z1 - w.z0) < 1e-6;
  const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const cx = (w.x0 + w.x1) / 2;
  const cz = (w.z0 + w.z1) / 2;
  const t = 0.7;
  const h = w.h * (0.92 + ((seed * 37 + 11) % 10) / 90);
  const size: [number, number, number] = horizontal ? [len, h, t] : [t, h, len];
  const blobs = useMemo(() => {
    const n = Math.max(3, Math.floor(len / 9));
    return Array.from({ length: n }, (_, i) => {
      const k = (i + 0.5) / n - 0.5;
      const j = (((seed * 53 + i * 29) % 17) - 8) / 16;
      return {
        along: k * (len - 2),
        up: h + 0.05 + ((((seed * 31 + i * 13) % 7) + 7) % 7) * 0.03,
        r: 0.5 + ((((seed * 17 + i * 7) % 5) + 5) % 5) * 0.09,
        side: j * 0.2,
        dark: (i + seed) % 2 === 0,
      };
    });
  }, [len, h, seed]);
  return (
    <group position={[cx, 0, cz]}>
      {/* stone kerb the planting sits in */}
      <mesh position={[0, 0.09, 0]} receiveShadow>
        <boxGeometry
          args={horizontal ? [len, 0.18, t + 0.14] : [t + 0.14, 0.18, len]}
        />
        <primitive object={M.curb} attach="material" />
      </mesh>
      <mesh position={[0, h / 2 + 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={size} />
        <primitive object={M.hedge} attach="material" />
      </mesh>
      {/* leaf blobs along the top so the run never reads as a flat box */}
      {blobs.map((b, i) => (
        <mesh
          key={i}
          position={[
            horizontal ? b.along : b.side,
            b.up,
            horizontal ? b.side : b.along,
          ]}
        >
          <icosahedronGeometry args={[b.r, 1]} />
          <primitive object={b.dark ? M.leafDark : M.leaf} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Hive brand face on the monument: mark + wordmark, lit for the approach. */
function MonumentFace() {
  const face = useMemo(() => monumentTexture(), []);
  return (
    <mesh position={[0, 1.12, 0.19]}>
      <planeGeometry args={[3.6, 0.9]} />
      <meshBasicMaterial map={face} transparent toneMapped={false} />
    </mesh>
  );
}

/** One raised planting bed: soil, layered shrubs, flower dots, grass tufts. */
const FLOWER_COLORS = ["#f472b6", "#fbbf24", "#e8eaf0", "#fb7185"] as const;
function Planter({
  x,
  z,
  w,
  d,
  seed,
}: {
  x: number;
  z: number;
  w: number;
  d: number;
  seed: number;
}) {
  const shrubs = useMemo(() => {
    const n = 5;
    return Array.from({ length: n }, (_, k) => {
      const fx = ((seed * 37 + k * 53) % 100) / 100 - 0.5;
      const fz = ((seed * 61 + k * 29) % 100) / 100 - 0.5;
      return {
        x: fx * (w - 1.6),
        z: fz * (d - 1.2),
        r: 0.35 + (((seed + k * 13) % 5) / 5) * 0.3,
        y: 0.62 + (((seed + k * 7) % 4) / 4) * 0.22,
        dark: (k + seed) % 2 === 0,
      };
    });
  }, [w, d, seed]);
  const flowers = useMemo(() => {
    const n = 10;
    return Array.from({ length: n }, (_, k) => ({
      x: (((seed * 11 + k * 47) % 100) / 100 - 0.5) * (w - 1),
      z: (((seed * 23 + k * 31) % 100) / 100 - 0.5) * (d - 0.8),
      c: FLOWER_COLORS[(k + seed) % FLOWER_COLORS.length]!,
    }));
  }, [w, d, seed]);
  const tufts = useMemo(() => {
    const n = 6;
    return Array.from({ length: n }, (_, k) => ({
      x: (((seed * 41 + k * 19) % 100) / 100 - 0.5) * (w - 1.2),
      z: (((seed * 17 + k * 43) % 100) / 100 - 0.5) * (d - 1),
      h: 0.3 + (((seed + k * 5) % 4) / 4) * 0.25,
      lean: (((seed + k) % 9) - 4) * 0.05,
    }));
  }, [w, d, seed]);
  const darkShrubs = shrubs.filter((s) => s.dark);
  const lightShrubs = shrubs.filter((s) => !s.dark);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.44, d]} />
        <primitive object={M.curb} attach="material" />
      </mesh>
      <mesh position={[0, 0.42, 0]} receiveShadow>
        <boxGeometry args={[w - 0.24, 0.1, d - 0.24]} />
        <primitive object={M.mulch} attach="material" />
      </mesh>
      {/* shrubs / tufts / flowers batched per bed: 4 draws, not 21 */}
      <Instances range={darkShrubs.length} limit={darkShrubs.length}>
        <icosahedronGeometry args={[1, 1]} />
        <primitive object={M.leafDark} attach="material" />
        {darkShrubs.map((s, k) => (
          <Instance key={k} position={[s.x, s.y, s.z]} scale={s.r} />
        ))}
      </Instances>
      <Instances range={lightShrubs.length} limit={lightShrubs.length}>
        <icosahedronGeometry args={[1, 1]} />
        <primitive object={M.leaf} attach="material" />
        {lightShrubs.map((s, k) => (
          <Instance key={k} position={[s.x, s.y, s.z]} scale={s.r} />
        ))}
      </Instances>
      <Instances range={tufts.length} limit={tufts.length}>
        <coneGeometry args={[0.09, 1, 6]} />
        <primitive object={M.leaf} attach="material" />
        {tufts.map((t, k) => (
          <Instance
            key={k}
            position={[t.x, 0.47 + t.h / 2, t.z]}
            rotation={[t.lean, 0, -t.lean]}
            scale={[1, t.h, 1]}
          />
        ))}
      </Instances>
      <Instances range={flowers.length} limit={flowers.length}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
        {flowers.map((f, k) => (
          <Instance key={k} position={[f.x, 0.62, f.z]} color={f.c} />
        ))}
      </Instances>
    </group>
  );
}

const windUniform = { value: 0 };
let swayPatched = false;

/** Cheap foliage sway: one shared time uniform patched into the leaf
 *  materials (crowns, shrubs, tufts). No extra draws, no shadow cost. */
function FoliageSway() {
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useMemo(() => {
    if (swayPatched) return;
    swayPatched = true;
    for (const mat of [M.leaf, M.leafDark] as THREE.MeshStandardMaterial[]) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWind = windUniform;
        shader.vertexShader =
          `uniform float uWind;\n` +
          shader.vertexShader.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
             transformed.x += sin(uWind * 1.6 + transformed.y * 2.0 + transformed.z * 1.3) * 0.05;
             transformed.z += cos(uWind * 1.1 + transformed.y * 1.7) * 0.04;`,
          );
      };
      mat.needsUpdate = true;
    }
  }, []);
  useFrame(({ clock }) => {
    if (reduced) return;
    windUniform.value = clock.elapsedTime;
  });
  return null;
}

/** Sidewalk rhythm + road scale cues. Nothing here casts shadows. */
const WALKWAY_Z = 52.9;
function StreetProps() {
  return (
    <group name="street-props">
      {/* litter bins along the walkway (instanced) */}
      <Instances range={4} limit={4}>
        <cylinderGeometry args={[0.32, 0.28, 0.9, 12]} />
        <primitive object={M.metalDark} attach="material" />
        {[-30, -5, 20, 45].map((x) => (
          <Instance key={x} position={[x, 0.45, WALKWAY_Z + 1.6]} />
        ))}
      </Instances>
      <Instances range={4} limit={4}>
        <cylinderGeometry args={[0.34, 0.34, 0.06, 12]} />
        <primitive object={M.blackAnodized} attach="material" />
        {[-30, -5, 20, 45].map((x) => (
          <Instance key={x} position={[x, 0.93, WALKWAY_Z + 1.6]} />
        ))}
      </Instances>
      {/* bike rack + two parked bikes */}
      <group position={[-15, 0, WALKWAY_Z + 1.2]}>
        {[-0.9, 0, 0.9].map((dx) => (
          <mesh key={dx} position={[dx, 0.35, 0]}>
            <torusGeometry args={[0.32, 0.035, 8, 16, Math.PI]} />
            <primitive object={M.metalBrushed} attach="material" />
          </mesh>
        ))}
        {[-0.45, 0.45].map((dx, bi) => (
          <group
            key={`bike${bi}`}
            position={[dx, 0, 0.5]}
            rotation={[0, 0.12 * (bi ? -1 : 1), 0]}
          >
            <mesh position={[0, 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
              <primitive object={M.metalDark} attach="material" />
            </mesh>
            {[-0.55, 0.55].map((dz) => (
              <mesh
                key={dz}
                position={[0, 0.34, dz]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <torusGeometry args={[0.32, 0.045, 8, 18]} />
                <primitive object={M.blackAnodized} attach="material" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* wayfinding poles (instanced) */}
      <Instances range={2} limit={2}>
        <cylinderGeometry args={[0.06, 0.06, 2.8, 8]} />
        <primitive object={M.lampPost} attach="material" />
        {[-2.5, 30].map((x) => (
          <Instance key={x} position={[x, 1.4, WALKWAY_Z - 1.8]} />
        ))}
      </Instances>
      <Instances range={2} limit={2}>
        <boxGeometry args={[1.1, 0.4, 0.06]} />
        <primitive object={M.signBox} attach="material" />
        {[-2.5, 30].map((x) => (
          <Instance key={x} position={[x, 2.4, WALKWAY_Z - 1.8]} />
        ))}
      </Instances>
      {/* hydrant near the entrance axis */}
      <group position={[8, 0, WALKWAY_Z + 1.4]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.6, 10]} />
          <meshStandardMaterial color="#b3402e" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color="#b3402e" roughness={0.6} />
        </mesh>
      </group>
      {/* parked cars + delivery van for scale (stylised, shadowless) —
          the middle one is a yellow cab: checker band + roof light. */}
      {(
        [
          [-60, "#5b7a99", false, false],
          [-20, "#f7b500", false, true],
          [55, "#e5e0d5", true, false],
        ] as [number, string, boolean, boolean][]
      ).map(([x, color, van, taxi]) => (
        <group key={`car${x}`} position={[x, 0, 60]}>
          <mesh position={[0, van ? 0.95 : 0.65, 0]}>
            <boxGeometry args={[van ? 5.2 : 4.2, van ? 1.5 : 0.7, 1.85]} />
            <meshStandardMaterial
              color={color}
              roughness={0.5}
              metalness={0.3}
            />
          </mesh>
          {!van && (
            <>
              <mesh position={[-0.2, 1.2, 0]}>
                <boxGeometry args={[2.2, 0.55, 1.6]} />
                <meshStandardMaterial
                  color={color}
                  roughness={0.4}
                  metalness={0.3}
                />
              </mesh>
              {/* dark glass band so the cabin doesn't read as solid paint */}
              <mesh position={[-0.2, 1.22, 0]}>
                <boxGeometry args={[1.9, 0.34, 1.64]} />
                <meshStandardMaterial
                  color="#1a2028"
                  roughness={0.12}
                  metalness={0.4}
                />
              </mesh>
              {taxi && getCheckerTex() && (
                <>
                  {/* checker bands on both flanks (far flank mirrored) */}
                  {[0, 1].map((s) => (
                    <mesh
                      key={s}
                      position={[-0.2, 0.72, s === 0 ? 0.94 : -0.94]}
                      rotation={[0, s === 0 ? 0 : Math.PI, 0]}
                    >
                      <planeGeometry args={[3.4, 0.22]} />
                      <meshBasicMaterial
                        map={getCheckerTex() ?? undefined}
                        toneMapped={false}
                      />
                    </mesh>
                  ))}
                  {/* roof light */}
                  <mesh position={[-0.2, 1.55, 0]}>
                    <boxGeometry args={[0.5, 0.14, 0.24]} />
                    <primitive object={M.lampGlow} attach="material" />
                  </mesh>
                </>
              )}
            </>
          )}
          {van && (
            <mesh position={[2.2, 1.1, 0]}>
              <boxGeometry args={[0.9, 0.5, 1.7]} />
              <meshStandardMaterial
                color="#1a2028"
                roughness={0.12}
                metalness={0.4}
              />
            </mesh>
          )}
        </group>
      ))}
      {/* all 12 wheels in one instanced draw */}
      <Instances range={12} limit={12}>
        <cylinderGeometry args={[0.32, 0.32, 0.22, 12]} />
        <primitive object={M.metalDark} attach="material" />
        {[-60, -20, 55].flatMap((x) =>
          (
            [
              [-1.4, -0.95],
              [1.4, -0.95],
              [-1.4, 0.95],
              [1.4, 0.95],
            ] as [number, number][]
          ).map(([dx, dz]) => (
            <Instance
              key={`${x}${dx}${dz}`}
              position={[x + dx, 0.32, 60 + dz]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          )),
        )}
      </Instances>
      {/* bench side tables */}
      {[30, 38].map((z) => (
        <group key={`tbl${z}`} position={[0, 0, z]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.06, 14]} />
            <primitive object={M.woodLight} attach="material" />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.5, 8]} />
            <primitive object={M.metalDark} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Slim street poplars along the side streets + front walkway — one trunk
 *  draw + one crown draw for all 21 trees. Conical crowns read as pruned
 *  street planting next to the plaza's broad crowns. */
function StreetTrees() {
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (const sx of [-40, 40]) {
      for (let z = -64; z <= 48; z += 16) out.push([sx, z]);
    }
    for (let x = -30; x <= 30; x += 15) out.push([x, 49]);
    return out;
  }, []);
  return (
    <group name="street-trees">
      <Instances range={spots.length} limit={spots.length} castShadow>
        <cylinderGeometry args={[0.1, 0.17, 2.1, 7]} />
        <primitive object={M.trunk} attach="material" />
        {spots.map(([x, z], i) => (
          <Instance key={i} position={[x, 1.05, z]} />
        ))}
      </Instances>
      <Instances range={spots.length} limit={spots.length} castShadow>
        <coneGeometry args={[0.95, 4.6, 7]} />
        <primitive object={M.leaf} attach="material" />
        {spots.map(([x, z], i) => (
          <Instance
            key={i}
            position={[x, 4.2 + ((i * 37) % 5) * 0.12, z]}
            scale={[1, 1 + ((i * 53) % 4) * 0.06, 1]}
          />
        ))}
      </Instances>
      <Instances range={spots.length} limit={spots.length}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 10]} />
        <primitive object={M.mulch} attach="material" />
        {spots.map(([x, z], i) => (
          <Instance key={i} position={[x, 0.025, z]} />
        ))}
      </Instances>
    </group>
  );
}

/** Bus-stop shelter on the front walkway: posts, roof, glass back, bench,
 *  timetable sign. One realistic transit object for the streetscape. */
function BusStop() {
  const face = useMemo(() => bladeTexture("BUS · Hive Shuttle", "#38bdf8"), []);
  return (
    <group name="bus-stop" position={[18, 0, WALKWAY_Z - 0.6]}>
      {[-2, 2].map((dx) =>
        [-0.8, 0.8].map((dz) => (
          <mesh key={`${dx}${dz}`} position={[dx, 1.25, dz]} castShadow>
            <boxGeometry args={[0.09, 2.5, 0.09]} />
            <primitive object={M.lampPost} attach="material" />
          </mesh>
        )),
      )}
      <mesh position={[0, 2.56, 0]} castShadow>
        <boxGeometry args={[4.5, 0.09, 2.0]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      <mesh position={[0, 2.5, -0.95]} castShadow>
        <boxGeometry args={[4.5, 0.35, 0.08]} />
        <primitive object={M.precastDark} attach="material" />
      </mesh>
      {/* glass back */}
      <mesh position={[0, 1.25, -0.85]} renderOrder={10}>
        <boxGeometry args={[4.2, 1.7, 0.04]} />
        <primitive object={M.glassCheap} attach="material" />
      </mesh>
      {/* bench */}
      <mesh position={[0, 0.46, -0.4]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.07, 0.45]} />
        <primitive object={M.woodLight} attach="material" />
      </mesh>
      {[-1.6, 1.6].map((dx) => (
        <mesh key={dx} position={[dx, 0.22, -0.4]} castShadow>
          <boxGeometry args={[0.07, 0.44, 0.4]} />
          <primitive object={M.metalDark} attach="material" />
        </mesh>
      ))}
      {/* timetable totem */}
      <mesh position={[2.7, 1.1, 0.6]} castShadow>
        <boxGeometry args={[0.08, 2.2, 0.08]} />
        <primitive object={M.lampPost} attach="material" />
      </mesh>
      <mesh position={[2.7, 2.0, 0.6]}>
        <boxGeometry args={[0.7, 0.5, 0.06]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {face && (
        <mesh position={[2.7, 2.0, 0.64]}>
          <planeGeometry args={[0.62, 0.4]} />
          <meshBasicMaterial map={face} transparent toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Red obstruction beacons on the tallest skyline crowns — one instanced
 *  draw, unlit red so they read at any distance. */
function SkylineBeacons({
  towers,
}: {
  towers: { x: number; h: number; z: number }[];
}) {
  if (towers.length === 0) return null;
  return (
    <Instances range={towers.length} limit={towers.length}>
      <sphereGeometry args={[0.55, 8, 6]} />
      <meshBasicMaterial color="#ff3b30" toneMapped={false} fog={false} />
      {towers.map((b, i) => (
        <Instance key={i} position={[b.x, b.h + 8.4, b.z]} />
      ))}
    </Instances>
  );
}

/* ── NYC streetscape helpers ────────────────────────────────────────────
   Small canvas painters for signage. Same technique as signage.ts. */
function streetBlade(text: string): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const el = document.createElement("canvas");
  el.width = 512;
  el.height = 96;
  const ctx = el.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#0d6e3f";
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = "#e8eaf0";
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, 500, 84);
  ctx.fillStyle = "#f4f6f4";
  ctx.font = "700 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function checkerStripe(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const el = document.createElement("canvas");
  el.width = 128;
  el.height = 16;
  const ctx = el.getContext("2d");
  if (!ctx) return null;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#111418" : "#f4f2ec";
    ctx.fillRect(i * 8, 0, 8, 16);
  }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

/** Module-cached checker band for the taxi (built once, reused). */
let checkerTex: THREE.Texture | null | undefined;
function getCheckerTex(): THREE.Texture | null {
  if (checkerTex === undefined) checkerTex = checkerStripe();
  return checkerTex;
}

function plaqueTexture(
  text: string,
  fg: string,
  bg: string,
): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const el = document.createElement("canvas");
  el.width = 256;
  el.height = 96;
  const ctx = el.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = fg;
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 52);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Cedar rooftop water towers — the single most "this is New York" object
 *  on any skyline. Three towers on mid-rise roofs: 4 instanced draws total. */
function WaterTowers() {
  const spots = useMemo(() => {
    const picks = [NEIGHBORS[1], NEIGHBORS[4], NEIGHBORS[8]].filter(
      Boolean,
    ) as {
      x: number;
      z: number;
      h: number;
      w: number;
      d: number;
    }[];
    return picks.map((n, i) => ({
      x: n.x + (i % 2 === 0 ? n.w / 5 : -n.w / 5),
      z: n.z + (i % 2 === 0 ? -n.d / 6 : n.d / 6),
      roof: n.h + 0.44,
    }));
  }, []);
  const legs = useMemo(
    () =>
      spots.flatMap((s) =>
        (
          [
            [-1.1, -1.1],
            [1.1, -1.1],
            [-1.1, 1.1],
            [1.1, 1.1],
          ] as [number, number][]
        ).map(
          ([dx, dz]) =>
            [s.x + dx, s.roof + 1.1, s.z + dz] as [number, number, number],
        ),
      ),
    [spots],
  );
  if (spots.length === 0) return null;
  return (
    <group name="water-towers">
      <Instances range={legs.length} limit={legs.length} castShadow>
        <boxGeometry args={[0.16, 2.2, 0.16]} />
        <primitive object={M.trunk} attach="material" />
        {legs.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <Instances range={spots.length} limit={spots.length} castShadow>
        <cylinderGeometry args={[1.55, 1.7, 2.9, 12]} />
        <meshStandardMaterial color="#8a6849" roughness={0.9} />
        {spots.map((s, i) => (
          <Instance key={i} position={[s.x, s.roof + 3.6, s.z]} />
        ))}
      </Instances>
      <Instances range={spots.length} limit={spots.length} castShadow>
        <coneGeometry args={[1.95, 1.2, 12]} />
        <meshStandardMaterial color="#5d4a36" roughness={0.9} />
        {spots.map((s, i) => (
          <Instance key={i} position={[s.x, s.roof + 5.65, s.z]} />
        ))}
      </Instances>
      <Instances range={spots.length * 2} limit={spots.length * 2}>
        <cylinderGeometry args={[1.68, 1.68, 0.07, 12]} />
        <primitive object={M.metalDark} attach="material" />
        {spots.flatMap((s, i) =>
          [2.9, 4.3].map((dy, k) => (
            <Instance key={`${i}-${k}`} position={[s.x, s.roof + dy, s.z]} />
          )),
        )}
      </Instances>
    </group>
  );
}

/** Two traffic signals guarding the side-street crossing + green street
 *  blades (W 42 ST / 7 AVE) so the corner reads as Manhattan. */
function TrafficSignals() {
  const lamp = (color: string, lit: boolean) => (
    <meshBasicMaterial color={lit ? color : "#2a2226"} toneMapped={lit} />
  );
  const Signal = ({
    x,
    z,
    ry,
    go,
  }: {
    x: number;
    z: number;
    ry: number;
    go: boolean;
  }) => (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 2.3, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 4.6, 8]} />
        <primitive object={M.lampPost} attach="material" />
      </mesh>
      <mesh position={[1.3, 4.4, 0]} castShadow>
        <boxGeometry args={[2.8, 0.12, 0.12]} />
        <primitive object={M.lampPost} attach="material" />
      </mesh>
      <mesh position={[2.4, 3.85, 0]} castShadow>
        <boxGeometry args={[0.36, 1.05, 0.36]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {(["#ff3b30", "#ffb340", "#34d399"] as const).map((c, i) => {
        const lit = go ? i === 2 : i === 0;
        return (
          <mesh key={c} position={[2.4, 4.15 - i * 0.32, 0.19]}>
            <circleGeometry args={[0.1, 12]} />
            {lamp(c, lit)}
          </mesh>
        );
      })}
    </group>
  );
  const blade42 = useMemo(() => streetBlade("W 42 ST"), []);
  const blade7 = useMemo(() => streetBlade("7 AVE"), []);
  return (
    <group name="traffic-signals">
      <Signal
        x={SIDE_X + 5.5}
        z={ROAD_Z0 - ROAD_W / 2 - 1.2}
        ry={Math.PI}
        go={false}
      />
      <Signal x={-(SIDE_X + 5.5)} z={ROAD_Z0 + ROAD_W / 2 + 1.2} ry={0} go />
      {/* street-name totem on the near corner */}
      <group position={[SIDE_X - 6.5, 0, WALKWAY_Z - 1.2]}>
        <mesh position={[0, 1.9, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 3.8, 8]} />
          <primitive object={M.lampPost} attach="material" />
        </mesh>
        {blade42 && (
          <mesh position={[0, 3.4, 0]}>
            <boxGeometry args={[1.7, 0.34, 0.04]} />
            <meshBasicMaterial map={blade42} toneMapped={false} />
          </mesh>
        )}
        {blade7 && (
          <mesh position={[0, 3.0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.4, 0.34, 0.04]} />
            <meshBasicMaterial map={blade7} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Con Edison moment: steam breathing out of the avenue manhole. */
function ManholeSteam() {
  const group = useRef<THREE.Group>(null);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || reduced) return;
    const t = clock.elapsedTime;
    g.children.forEach((c, i) => {
      const k = (((t * 0.22 + i / 4) % 1) + 1) % 1;
      c.position.y = 0.3 + k * 3.2;
      c.position.x = -8 + Math.sin((k + i) * 4) * 0.5 * k;
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = 0.3 * (1 - k);
      const s = 0.5 + k * 1.6;
      c.scale.set(s, s, s);
    });
  });
  return (
    <group ref={group} name="manhole-steam" position={[0, 0, ROAD_Z0 + 2.2]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-8, 0.3, 0]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial
            color="#e8ecef"
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Halal-cart style food cart on the walkway: stainless body, yellow
 *  umbrella, menu board. The sidewalk's main character. */
function FoodCart() {
  const menu = useMemo(
    () => plaqueTexture("HALAL · $8", "#f4f2ec", "#1c3a2a"),
    [],
  );
  return (
    <group
      name="food-cart"
      position={[-8, 0, WALKWAY_Z - 0.4]}
      rotation={[0, 0.08, 0]}
    >
      {/* body */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.1, 1.0, 1.15]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <boxGeometry args={[2.0, 0.06, 1.05]} />
        <primitive object={M.metalDark} attach="material" />
      </mesh>
      {/* grill + pans */}
      <mesh position={[-0.5, 1.44, 0]}>
        <boxGeometry args={[0.7, 0.05, 0.6]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[0.5, 1.46, 0.1]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 12]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      {/* wheels */}
      {[-0.8, 0.8].map((dx) => (
        <mesh key={dx} position={[dx, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.1, 12]} />
          <primitive object={M.blackAnodized} attach="material" />
        </mesh>
      ))}
      {/* umbrella pole + yellow canopy */}
      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2.6, 6]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      <mesh position={[0, 3.35, 0]} castShadow>
        <coneGeometry args={[1.5, 0.55, 8]} />
        <meshStandardMaterial
          color="#f2b705"
          roughness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* menu board */}
      {menu && (
        <mesh position={[1.12, 1.7, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.7, 0.26]} />
          <meshBasicMaterial map={menu} toneMapped={false} />
        </mesh>
      )}
      {/* propane tank */}
      <mesh position={[-1.25, 0.35, 0.3]}>
        <cylinderGeometry args={[0.16, 0.16, 0.6, 10]} />
        <meshStandardMaterial color="#b8bec6" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

/** Green painted bike lane along the avenue + dashed divider. */
function BikeLane() {
  const dashes = useMemo(() => {
    const out: number[] = [];
    for (let x = -195; x <= 195; x += 8) out.push(x);
    return out;
  }, []);
  return (
    <group name="bike-lane">
      <mesh
        position={[0, -0.037, ROAD_Z0 + 3.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[400, 1.3]} />
        <meshStandardMaterial color="#2e7d4f" roughness={0.9} />
      </mesh>
      <Instances range={dashes.length} limit={dashes.length}>
        <planeGeometry args={[2.2, 0.14]} />
        <primitive object={M.roadPaint} attach="material" />
        {dashes.map((x) => (
          <Instance
            key={x}
            position={[x, -0.033, ROAD_Z0 + 2.6]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        ))}
      </Instances>
    </group>
  );
}

/** Subway stair totem on the walkway: railings, glowing globe, sign. */
function SubwayTotem() {
  const face = useMemo(
    () => plaqueTexture("SUBWAY · HIVE ST", "#f4f2ec", "#111418"),
    [],
  );
  return (
    <group name="subway" position={[-30, 0, WALKWAY_Z - 0.4]}>
      {/* stairwell: dark pit with railing */}
      <mesh position={[0, -0.75, 0]}>
        <boxGeometry args={[3.0, 0.1, 2.0]} />
        <meshBasicMaterial color="#0a0d11" />
      </mesh>
      {[-1.5, 1.5].map((dx) => (
        <group key={dx}>
          {[0.9, -0.9].map((dz) => (
            <mesh key={dz} position={[dx, 0.55, dz]}>
              <cylinderGeometry args={[0.035, 0.035, 1.1, 6]} />
              <primitive object={M.lampPost} attach="material" />
            </mesh>
          ))}
          <mesh position={[dx, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.9, 6]} />
            <primitive object={M.metalBrushed} attach="material" />
          </mesh>
        </group>
      ))}
      {/* globe pole + sign */}
      <mesh position={[2.2, 1.4, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 2.8, 8]} />
        <primitive object={M.lampPost} attach="material" />
      </mesh>
      <mesh position={[2.2, 2.95, 0]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <primitive object={M.lampGlow} attach="material" />
      </mesh>
      {face && (
        <mesh position={[2.2, 2.3, 0.04]}>
          <planeGeometry args={[1.15, 0.42]} />
          <meshBasicMaterial map={face} toneMapped={false} />
        </mesh>
      )}
      <mesh position={[2.2, 2.3, 0]}>
        <boxGeometry args={[1.25, 0.5, 0.05]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
    </group>
  );
}

/** High Line nod: a timber boardwalk strip along the plaza's east edge —
 *  wood deck, steel rail, grass drifts, benches. The reference foreground,
 *  shrunk to our block. Flush with the plaza (no trip, no collider edits). */
function Boardwalk() {
  const X0 = 25.5;
  const X1 = 31;
  const Z0 = 22.5;
  const Z1 = 45.5;
  const cx = (X0 + X1) / 2;
  const cz = (Z0 + Z1) / 2;
  const grasses = useMemo(() => {
    const out: { p: [number, number, number]; h: number; lean: number }[] = [];
    for (let i = 0; i < 44; i++) {
      const west = i % 2 === 0;
      out.push({
        p: [
          west ? X0 + 0.5 + hash01(i, 3) * 1.2 : X1 - 0.5 - hash01(i, 4) * 1.2,
          0.02,
          Z0 + hash01(i, 5) * (Z1 - Z0),
        ],
        h: 0.5 + hash01(i, 6) * 0.6,
        lean: (hash01(i, 7) - 0.5) * 0.3,
      });
    }
    return out;
  }, []);
  const posts = useMemo(() => {
    const out: number[] = [];
    for (let z = Z0 + 0.5; z <= Z1; z += 2.3) out.push(z);
    return out;
  }, []);
  return (
    <group name="boardwalk">
      {/* deck + skirt */}
      <mesh
        position={[cx, 0.012, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[X1 - X0, Z1 - Z0]} />
        <primitive
          object={floorFor("wood", X1 - X0, Z1 - Z0)}
          attach="material"
        />
      </mesh>
      <mesh position={[cx, 0.006, cz]}>
        <boxGeometry args={[X1 - X0, 0.012, Z1 - Z0]} />
        <primitive object={M.precastDark} attach="material" />
      </mesh>
      {/* west rail: posts + double rail + kick light */}
      <Instances range={posts.length} limit={posts.length} castShadow>
        <boxGeometry args={[0.07, 1.05, 0.07]} />
        <primitive object={M.metalDark} attach="material" />
        {posts.map((z) => (
          <Instance key={z} position={[X0 + 0.15, 0.53, z]} />
        ))}
      </Instances>
      {[1.06, 0.62].map((y) => (
        <mesh key={y} position={[X0 + 0.15, y, cz]} castShadow>
          <boxGeometry args={[0.09, 0.06, Z1 - Z0]} />
          <primitive object={M.metalBrushed} attach="material" />
        </mesh>
      ))}
      <mesh position={[X0 + 0.21, 0.1, cz]}>
        <boxGeometry args={[0.04, 0.04, Z1 - Z0 - 0.5]} />
        <primitive object={M.stripWarm} attach="material" />
      </mesh>
      {/* grass drifts */}
      <Instances range={grasses.length} limit={grasses.length} castShadow>
        <coneGeometry args={[0.11, 1, 6]} />
        <primitive object={M.leaf} attach="material" />
        {grasses.map((g, i) => (
          <Instance
            key={i}
            position={[g.p[0], g.p[1] + g.h / 2, g.p[2]]}
            rotation={[g.lean, 0, -g.lean]}
            scale={[1, g.h, 1]}
          />
        ))}
      </Instances>
      <KitInstances
        model="bench"
        items={[
          { position: [28.2, 0.012, 29], rotation: [0, -Math.PI / 2, 0] },
          { position: [28.2, 0.012, 39], rotation: [0, -Math.PI / 2, 0] },
        ]}
        name="kit-boardwalk-benches"
      />
    </group>
  );
}

/** Deterministic 0..1 hash for decor scatter. */
function hash01(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Sky life: drifting clouds, circling birds, distant traffic dots.
 *  All unlit billboards/planes — zero shadow or light cost. */
function SkyLife() {
  const cloudTex = useMemo(() => {
    const el = document.createElement("canvas");
    el.width = 256;
    el.height = 128;
    const ctx = el.getContext("2d")!;
    for (const [x, y, r] of [
      [70, 80, 46],
      [128, 66, 56],
      [186, 80, 44],
      [128, 88, 60],
    ] as const) {
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.85)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 128);
    }
    const t = new THREE.CanvasTexture(el);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const birdTex = useMemo(() => {
    const el = document.createElement("canvas");
    el.width = 64;
    el.height = 32;
    const ctx = el.getContext("2d")!;
    ctx.strokeStyle = "#2b3542";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(6, 20);
    ctx.quadraticCurveTo(18, 8, 32, 18);
    ctx.quadraticCurveTo(46, 8, 58, 20);
    ctx.stroke();
    const t = new THREE.CanvasTexture(el);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const clouds = useRef<THREE.Group>(null);
  const birds = useRef<THREE.Group>(null);
  const traffic = useRef<THREE.Group>(null);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame(({ clock }, delta) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    clouds.current?.children.forEach((c, i) => {
      c.position.x += delta * (1.1 + (i % 3) * 0.5);
      if (c.position.x > 380) c.position.x = -380;
    });
    if (birds.current) birds.current.rotation.y = t * 0.02;
    traffic.current?.children.forEach((c, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      c.position.x += delta * dir * (9 + (i % 3) * 3);
      if (c.position.x > 210) c.position.x = -210;
      if (c.position.x < -210) c.position.x = 210;
    });
  });
  return (
    <group name="sky-life">
      <group ref={clouds}>
        {(
          [
            [-220, 150, -260, 220],
            [-60, 170, -320, 260],
            [120, 140, -280, 180],
            [260, 165, -200, 240],
            [40, 155, 300, 200],
          ] as [number, number, number, number][]
        ).map(([x, y, z, w], i) => (
          <mesh key={i} position={[x, y, z]}>
            <planeGeometry args={[w, w / 2]} />
            {/* DoubleSide: single-sided planes pop out of existence when the
                camera walks around them — reads as texture glitching. */}
            <meshBasicMaterial
              map={cloudTex}
              transparent
              opacity={0.8}
              depthWrite={false}
              fog={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
      <group ref={birds} position={[0, 0, 0]}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i / 7) * Math.PI * 2) * (140 + (i % 3) * 25),
              62 + (i % 4) * 9,
              Math.sin((i / 7) * Math.PI * 2) * (140 + (i % 3) * 25),
            ]}
            rotation={[0, -(i / 7) * Math.PI * 2, 0]}
          >
            <planeGeometry args={[7, 3.5]} />
            <meshBasicMaterial
              map={birdTex}
              transparent
              opacity={0.85}
              depthWrite={false}
              side={THREE.DoubleSide}
              fog={false}
            />
          </mesh>
        ))}
      </group>
      <group ref={traffic}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh
            key={i}
            position={[
              -180 + i * 70,
              0.7,
              ROAD_Z0 + (i % 2 === 0 ? -1.8 : 1.8),
            ]}
          >
            <planeGeometry args={[1.6, 0.6]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? "#fff7d6" : "#ff5a5a"}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Simplified view (Gather parity): skips the skyline, street traffic and
 * lamp lights — plaza, planting and paths stay. For weak GPUs / focus mode.
 */
export function Courtyard({ simple = false }: { simple?: boolean }) {
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
      { r: 215, count: 24, base: 22, span: 40 },
      { r: 300, count: 28, base: 34, span: 70 },
    ];
    let n = 0;
    bands.forEach((band, bi) => {
      for (let i = 0; i < band.count; i++) {
        n++;
        const a = (i / band.count) * Math.PI * 2 + bi * 0.4;
        const jitter = ((n * 53) % 47) - 23;
        const r = band.r + jitter;
        const h = band.base + ((n * 37) % band.span);
        const w = 20 + ((n * 17) % 26);
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
  const towerBands = useMemo(
    () => [0, 1, 2].map((m) => skyline.filter((b) => b.mat === m)),
    [skyline],
  );
  const tallTowers = useMemo(() => skyline.filter((b) => b.h > 55), [skyline]);

  return (
    <group name="courtyard">
      {/* Procedural sky, blue-hour grade (pure shader — no HDRI fetch) */}
      <Sky
        sunPosition={SUN}
        turbidity={8}
        rayleigh={2.6}
        mieCoefficient={0.005}
        mieDirectionalG={0.86}
      />
      <SkyLife />

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
      {/* Lowered 15mm below the side streets: the two asphalt planes cross
          at the intersections, and coplanar overlaps flicker constantly. */}
      <mesh
        position={[0, -0.045, ROAD_Z0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[420, ROAD_W]} />
        <primitive
          object={floorFor("asphalt", 420, ROAD_W)}
          attach="material"
        />
      </mesh>
      {/* Lane markings — real paint, not kerb grey */}
      {Array.from({ length: 42 }, (_, i) => -200 + i * 10).map((x) => (
        <mesh
          key={x}
          position={[x, -0.015, ROAD_Z0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[4.2, 0.22]} />
          <primitive object={M.roadPaint} attach="material" />
        </mesh>
      ))}
      {/* Centre line in yellow, offset so the two paints never overlap */}
      {Array.from({ length: 28 }, (_, i) => -195 + i * 15).map((x) => (
        <mesh
          key={`y${x}`}
          position={[x, -0.015, ROAD_Z0 - 1.6]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[3.0, 0.16]} />
          <primitive object={M.roadYellow} attach="material" />
        </mesh>
      ))}
      {/* Zebra crosswalk on the runway axis */}
      {[-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6].map((x) => (
        <mesh
          key={`z${x}`}
          position={[x, -0.015, ROAD_Z0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.65, ROAD_W - 1.6]} />
          <primitive object={M.roadPaint} attach="material" />
        </mesh>
      ))}
      {/* Manholes + kerb drains */}
      {[-40, -8, 24, 56].map((x) => (
        <mesh
          key={`m${x}`}
          position={[x, -0.015, ROAD_Z0 + 2.2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.45, 20]} />
          <primitive object={M.drainCover} attach="material" />
        </mesh>
      ))}
      {[-20, 16].map((x) => (
        <mesh key={`d${x}`} position={[x, 0.02, ROAD_Z0 + ROAD_W / 2 - 0.3]}>
          <boxGeometry args={[0.9, 0.06, 0.5]} />
          <primitive object={M.drainCover} attach="material" />
        </mesh>
      ))}
      <mesh position={[0, 0.06, ROAD_Z0 + ROAD_W / 2 + 0.1]} receiveShadow>
        <boxGeometry args={[420, 0.24, 0.34]} />
        <primitive object={M.curb} attach="material" />
      </mesh>

      {/* North–south side streets, so the block is bounded on all four sides */}
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <mesh
            position={[s * SIDE_X, -0.03, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[ROAD_W, 300]} />
            <primitive
              object={floorFor("asphalt", ROAD_W, 300)}
              attach="material"
            />
          </mesh>
          {/* sidewalk on the block side + kerbs */}
          <mesh
            position={[s * (SIDE_X - ROAD_W / 2 - 2.6), -0.02, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[5, 300]} />
            <primitive object={floorFor("walkway", 5, 300)} attach="material" />
          </mesh>
          {([-1, 1] as const).map((k) => (
            <mesh
              key={k}
              position={[s * SIDE_X + k * (ROAD_W / 2 + 0.1), 0.06, 0]}
              receiveShadow
            >
              <boxGeometry args={[0.34, 0.24, 300]} />
              <primitive object={M.curb} attach="material" />
            </mesh>
          ))}
          {/* lane markings */}
          {Array.from({ length: 30 }, (_, i) => -145 + i * 10).map((z) => (
            <mesh
              key={z}
              position={[s * SIDE_X, -0.015, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.22, 4.2]} />
              <primitive object={M.roadPaint} attach="material" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Neighbouring city block — sealed facade-only mid-rises */}
      {NEIGHBORS.map((n, i) => (
        <Block key={i} n={n} index={i} />
      ))}

      {/* Urban podium so the neighbours sit on city ground, not a field */}
      <mesh
        position={[0, -0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[400, 260]} />
        <meshStandardMaterial color="#6e7276" roughness={0.95} />
      </mesh>

      {/* Plaza paving — 5mm above the foundation slab (whose top is exactly
          y=0): the slab sticks 0.7m past the facade into the plaza strip and
          a coplanar overlap there shimmered along the whole entrance line. */}
      <mesh
        position={[ccx, 0.005, ccz]}
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
      {/* Expansion joints + varied banding to break the 68m slab */}
      {[-25.5, -17, -8.5, 8.5, 17, 25.5].map((x) => (
        <mesh
          key={`j${x}`}
          position={[x, 0.011, ccz]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.12, cd - 1]} />
          <primitive object={M.pavementTrim} attach="material" />
        </mesh>
      ))}
      {(
        [
          [30, 1.0],
          [34.5, 0.35],
          [39, 1.0],
        ] as [number, number][]
      ).flatMap(([z, w]) =>
        (
          [
            [(minX + 1 + -6.5) / 2, -6.5 - (minX + 1)],
            [(maxX - 1 + 6.5) / 2, maxX - 1 - 6.5],
          ] as [number, number][]
        ).map(([cx, len], k) => (
          <mesh
            key={`b${z}-${k}`}
            position={[cx, 0.012, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[Math.abs(len), w]} />
            <primitive object={M.pavementTrim} attach="material" />
          </mesh>
        )),
      )}
      {/* Stone edging where the plaza meets the lawn */}
      {(
        [
          [ccx, COURTYARD.minZ - 0.15, cw + 0.3, 0.3],
          [ccx, COURTYARD.maxZ + 0.15, cw + 0.3, 0.3],
          [COURTYARD.minX - 0.15, ccz, 0.3, cd + 0.3],
          [COURTYARD.maxX + 0.15, ccz, 0.3, cd + 0.3],
        ] as [number, number, number, number][]
      ).map(([x, z, w, d], i) => (
        <mesh key={`e${i}`} position={[x, 0.015, z]} receiveShadow>
          <boxGeometry args={[w, 0.05, d]} />
          <primitive object={M.curb} attach="material" />
        </mesh>
      ))}

      {/* Hedges ringing the plaza */}
      {COURTYARD_BARRIERS.map((w, i) => (
        <HedgeSeg key={i} w={w} seed={i + 1} />
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

      {/* Raised planting beds — layered shrubs, flower dots, grass tufts */}
      {COURT_PLANTERS.map(([x, z, w, d], i) => (
        <Planter key={i} x={x} z={z} w={w} d={d} seed={i * 7 + 3} />
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
        {/* Hive brand face — mark + wordmark on the approach side */}
        <MonumentFace />
        <mesh position={[0, 0.27, 0.42]}>
          <boxGeometry args={[4.1, 0.05, 0.08]} />
          <primitive object={M.stripWarm} attach="material" />
        </mesh>
      </group>

      {/* Lamp posts (emissive heads; real lights only on capable desktops) */}
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
          {!simple && LAMP_LIGHTS && (
            <pointLight
              position={[0, 4.2, 0]}
              color="#ffe8bb"
              intensity={12}
              distance={11}
              decay={2}
            />
          )}
        </group>
      ))}

      {/* Trees: three archetypes (broad + columnar + poplar) so rows vary.
          Type B (every 3rd) stretches taller; every 5th is a slim poplar. */}
      <FoliageSway />
      <Instances
        range={COURT_TREES.length}
        limit={COURT_TREES.length}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.16, 0.32, 3.1, 8]} />
        <primitive object={M.trunk} attach="material" />
        {COURT_TREES.map((t, i) => {
          const tall = i % 3 === 2;
          const poplar = i % 5 === 4;
          return (
            <Instance
              key={i}
              position={[
                t.position[0],
                poplar ? 2.4 : tall ? 1.95 : 1.55,
                t.position[2],
              ]}
              scale={[
                poplar ? 0.8 : 1,
                poplar ? 1.55 : tall ? 1.26 : 1,
                poplar ? 0.8 : 1,
              ]}
            />
          );
        })}
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
            const tall = i % 3 === 2;
            const poplar = i % 5 === 4;
            const v = 0.86 + ((i * 17 + c * 7) % 9) / 26;
            const spin = (i * 1.1 + c * 0.9) % 6.283;
            const spread = poplar ? 0.45 : tall ? 0.7 : 1;
            return (
              <Instance
                key={i}
                position={[
                  t.position[0] + ox * v * spread,
                  poplar
                    ? oy * 1.55 + 0.9
                    : tall
                      ? oy * 1.28 + 0.6
                      : oy * v + 0.2,
                  t.position[2] + oz * v * spread,
                ]}
                rotation={[0, spin, (((i + c) % 3) - 1) * 0.18]}
                scale={
                  poplar
                    ? [v * 0.5, v * 1.3, v * 0.5]
                    : tall
                      ? [v * 0.72, v * 1.05, v * 0.72]
                      : [v, v * 0.82, v]
                }
              />
            );
          })}
        </Instances>
      ))}
      {/* Mulch rings + tree grates */}
      <Instances range={COURT_TREES.length} limit={COURT_TREES.length}>
        <cylinderGeometry args={[1.35, 1.35, 0.04, 16]} />
        <primitive object={M.mulch} attach="material" />
        {COURT_TREES.map((t, i) => (
          <Instance key={i} position={[t.position[0], 0.02, t.position[2]]} />
        ))}
      </Instances>
      <Instances range={COURT_TREES.length} limit={COURT_TREES.length}>
        <cylinderGeometry args={[1.05, 1.05, 0.06, 16]} />
        <primitive object={M.metalDark} attach="material" />
        {COURT_TREES.map((t, i) => (
          <Instance key={i} position={[t.position[0], 0.04, t.position[2]]} />
        ))}
      </Instances>

      {/* Benches (kit bench.glb, CC0) */}
      <KitInstances
        model="bench"
        items={COURT_BENCHES}
        name="kit-court-benches"
      />

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
      {/* Reflective bands on the bollards (emissive, no lights) */}
      <Instances range={12} limit={12}>
        <cylinderGeometry args={[0.115, 0.115, 0.09, 10]} />
        <primitive object={M.stripWarm} attach="material" />
        {Array.from({ length: 12 }, (_, i) => {
          const side = i % 2 === 0 ? -4.6 : 4.6;
          const z = INTERIOR.maxZ + 3 + Math.floor(i / 2) * 3.2;
          return <Instance key={i} position={[side, 0.68, z]} />;
        })}
      </Instances>

      {/* Sidewalk props + parked traffic for scale */}
      {!simple && <StreetProps />}
      {/* High Line boardwalk along the east edge */}
      <Boardwalk />
      {/* Street planting, transit shelter — the block's public realm */}
      <StreetTrees />
      {!simple && <BusStop />}
      {!simple && <SkylineBeacons towers={tallTowers} />}
      {/* Pure New York: water towers, signals, steam, food cart, subway */}
      <WaterTowers />
      {!simple && <TrafficSignals />}
      {!simple && <ManholeSteam />}
      {!simple && <FoodCart />}
      <BikeLane />
      {!simple && <SubwayTotem />}

      {/* Distant skyline — three facade densities, two depth bands.
          Jittered footprints + antenna toppers so towers don't read as clones. */}
      {!simple &&
        towers.map((mat, m) => {
          const band = towerBands[m] ?? [];
          if (band.length === 0) return null;
          return (
            <Instances key={m} range={band.length} limit={band.length}>
              <boxGeometry args={[1, 1, 1]} />
              <primitive object={mat} attach="material" />
              {band.map((b, i) => (
                <Instance
                  key={i}
                  position={[b.x, b.h / 2, b.z]}
                  rotation={[0, (((b.x * 13 + b.z * 7) % 21) - 10) * 0.02, 0]}
                  scale={[b.w, b.h, b.d]}
                />
              ))}
            </Instances>
          );
        })}
      {/* Antenna toppers on the tallest towers */}
      {!simple && (
        <Instances range={tallTowers.length} limit={tallTowers.length}>
          <boxGeometry args={[1.2, 1, 1.2]} />
          <primitive object={M.metalDark} attach="material" />
          {tallTowers.map((b, i) => (
            <Instance
              key={i}
              position={[b.x, b.h + 4, b.z]}
              scale={[1, 8, 1]}
            />
          ))}
        </Instances>
      )}
    </group>
  );
}
