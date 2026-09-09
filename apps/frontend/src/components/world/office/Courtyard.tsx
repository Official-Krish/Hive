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
import { M, floorFor, facadeFor } from "./materials";
import { monumentTexture, marqueeTexture } from "./signage";

// Aligned with the directional SUN in OfficeLighting so the sky disc and the
// shadow direction agree.
const SUN: [number, number, number] = [60, 80, -40];

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

/**
 * One facade-only neighbour: precast plinth, curtain-walled mass with an
 * optional upper setback, coping, a canopied entrance with a lit sign and a
 * little rooftop plant. Sealed — there is no interior and no collider, the
 * blocks all sit beyond the courtyard barriers.
 */
function Block({ n, index = 0 }: { n: Neighbor; index?: number }) {
  const upperY = n.setback > 0 ? n.h * n.setbackAt : n.h;
  const bodyH = upperY - PLINTH_H;
  const facade = facadeFor(n.style, (n.w + n.d) / 2, bodyH);
  const topH = n.h - upperY;
  const topFacade =
    n.setback > 0
      ? facadeFor(n.style, (n.w + n.d) / 2 - n.setback * 2, topH)
      : facade;

  // Outward direction of the entrance face.
  const ex = n.entrance === "e" ? 1 : n.entrance === "w" ? -1 : 0;
  const ez = n.entrance === "s" ? 1 : n.entrance === "n" ? -1 : 0;
  const faceW = ex !== 0 ? n.d : n.w;
  const half = ex !== 0 ? n.w / 2 : n.d / 2;

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

      {/* Curtain-walled body */}
      <mesh position={[0, PLINTH_H + bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[n.w, bodyH, n.d]} />
        <primitive object={facade} attach="material" />
      </mesh>

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
            <primitive object={topFacade} attach="material" />
          </mesh>
        </>
      )}

      {/* Coping around the top (height varies so roofs don't match) */}
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

      {/* Rooftop plant + vents; tall blocks get an antenna + beacon */}
      <mesh position={[((index % 5) - 2) * 1.6, n.h + 1.2, 0]} castShadow>
        <boxGeometry args={[6, 1.6, 4]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      {index % 2 === 0 && (
        <mesh position={[n.w / 4, n.h + 0.7, -n.d / 4]}>
          <boxGeometry args={[1.6, 1.4, 1.6]} />
          <primitive object={M.precastDark} attach="material" />
        </mesh>
      )}
      {index % 3 === 0 && (
        <mesh position={[-n.w / 4, n.h + 0.5, n.d / 4]}>
          <boxGeometry args={[2.4, 1.0, 1.2]} />
          <primitive object={M.hedge} attach="material" />
        </mesh>
      )}
      {n.h >= 40 && (
        <group position={[n.w / 4, n.h + 0.4, 0]}>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 6, 6]} />
            <primitive object={M.metalDark} attach="material" />
          </mesh>
          <mesh position={[0, 6.2, 0]}>
            <sphereGeometry args={[0.45, 10, 8]} />
            <meshBasicMaterial color="#f43f5e" toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* Entrance: recessed glazing, canopy, lit sign band */}
      <group
        position={[ex * (half + 0.28), 0, ez * (half + 0.28)]}
        rotation={[0, ex !== 0 ? Math.PI / 2 : 0, 0]}
      >
        <mesh position={[0, 1.9, 0]} renderOrder={10}>
          <boxGeometry args={[Math.min(faceW * 0.5, 11), 3.6, 0.12]} />
          <primitive object={M.glassCheap} attach="material" />
        </mesh>
        {/* mullions */}
        {[-3, -1, 1, 3].map((d) => (
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
        {/* lit sign band with tenant name above the canopy */}
        <BlockSign
          width={Math.min(faceW * 0.4, 8)}
          index={index}
          warm={n.style === 1}
        />
      </group>
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
      {/* parked cars + delivery van for scale (stylised, shadowless) */}
      {(
        [
          [-60, "#5b7a99", false],
          [-20, "#6b7280", false],
          [55, "#e5e0d5", true],
        ] as [number, string, boolean][]
      ).map(([x, color, van]) => (
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
            <mesh position={[-0.2, 1.2, 0]}>
              <boxGeometry args={[2.2, 0.55, 1.6]} />
              <meshStandardMaterial
                color={color}
                roughness={0.4}
                metalness={0.3}
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
            <meshBasicMaterial
              map={cloudTex}
              transparent
              opacity={0.8}
              depthWrite={false}
              fog={false}
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
      {/* Procedural sky (pure shader — no HDRI fetch) */}
      <Sky
        sunPosition={SUN}
        turbidity={6}
        rayleigh={1.6}
        mieCoefficient={0.004}
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
          {LAMP_LIGHTS && (
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

      {/* Trees: two archetypes (broad + tall columnar) so the rows vary.
          Type B (every 3rd tree) stretches taller with a narrower crown. */}
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
          return (
            <Instance
              key={i}
              position={[t.position[0], tall ? 1.95 : 1.55, t.position[2]]}
              scale={[1, tall ? 1.26 : 1, 1]}
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
            const v = 0.86 + ((i * 17 + c * 7) % 9) / 26;
            const spin = (i * 1.1 + c * 0.9) % 6.283;
            return (
              <Instance
                key={i}
                position={[
                  t.position[0] + ox * v * (tall ? 0.7 : 1),
                  tall ? oy * 1.28 + 0.6 : oy * v + 0.2,
                  t.position[2] + oz * v * (tall ? 0.7 : 1),
                ]}
                rotation={[0, spin, (((i + c) % 3) - 1) * 0.18]}
                scale={tall ? [v * 0.72, v * 1.05, v * 0.72] : [v, v * 0.82, v]}
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
      <StreetProps />

      {/* Distant skyline — three facade densities, two depth bands.
          Jittered footprints + antenna toppers so towers don't read as clones. */}
      {towers.map((mat, m) => {
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
      <Instances range={tallTowers.length} limit={tallTowers.length}>
        <boxGeometry args={[1.2, 1, 1.2]} />
        <primitive object={M.metalDark} attach="material" />
        {tallTowers.map((b, i) => (
          <Instance key={i} position={[b.x, b.h + 4, b.z]} scale={[1, 8, 1]} />
        ))}
      </Instances>
    </group>
  );
}
