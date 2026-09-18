import { useEffect, useMemo, useRef, useState } from "react";
import { Billboard, Instances, Instance } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CEILING_RUNS,
  CEILING_RUNS_L2,
  POD_LIGHTS,
  LOBBY_PENDANTS,
  CAFE_PENDANTS,
  BAFFLES,
  SLAT_WALLS,
  TV_PANELS,
  WHITEBOARDS,
  WALL_ART,
  ROOM_SIGNS,
  PODS,
  RUGS,
  CEILING_Y,
  CEILING_Y2,
  INTERIOR,
  MEZZ,
  EXT_H,
  type WallArt,
  type WallPanel,
} from "./layout";
import { M } from "./materials";
import { ASSET_BASE_URL } from "@/lib/config";
import { bladeTexture, directoryTexture } from "./signage";
import { PodDoorPlate } from "./Level2";

const SCREEN_MAT = {
  a: M.tvA,
  b: M.tvB,
  c: M.tvC,
  d: M.tvD,
  e: M.tvE,
  f: M.tvF,
} as const;

/** Recessed linear luminaire, flush with the suspended ceiling. */
function CeilingRun({
  position,
  length,
  axis,
  warm,
}: {
  position: [number, number, number];
  length: number;
  axis: "x" | "z";
  warm: boolean;
}) {
  const size: [number, number, number] =
    axis === "x" ? [length, 0.05, 0.3] : [0.3, 0.05, length];
  const frame: [number, number, number] =
    axis === "x" ? [length + 0.06, 0.09, 0.38] : [0.38, 0.09, length + 0.06];
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={frame} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      <mesh>
        <boxGeometry args={size} />
        <primitive
          object={warm ? M.stripWarm : M.stripCool}
          attach="material"
        />
      </mesh>
    </group>
  );
}

/** Suspended pendant: cord, cone shade, emissive diffuser. */
function Pendant({
  position,
  top,
  drop,
  radius,
  warm,
}: {
  position: [number, number, number];
  top: number;
  drop: number;
  radius: number;
  warm: boolean;
}) {
  const [x, , z] = position;
  const shadeY = top - drop;
  return (
    <group position={[x, 0, z]}>
      {/* ceiling rose */}
      <mesh position={[0, top - 0.03, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 10]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {/* cord */}
      <mesh position={[0, (top + shadeY) / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, top - shadeY, 6]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {/* shade */}
      <mesh position={[0, shadeY, 0]} castShadow>
        <cylinderGeometry
          args={[radius, radius * 0.42, radius * 0.85, 18, 1, true]}
        />
        <primitive object={M.metalDark} attach="material" />
      </mesh>
      {/* diffuser */}
      <mesh
        position={[0, shadeY - radius * 0.4, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[radius * 0.92, 18]} />
        <primitive
          object={warm ? M.stripWarm : M.stripCool}
          attach="material"
        />
      </mesh>
    </group>
  );
}

/** Wall-mounted display: bezel + emissive dashboard face. */
function Screen({ p }: { p: WallPanel }) {
  const [w, h] = p.size;
  return (
    <group position={p.position} rotation={p.rotation}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.09, h + 0.09, 0.07]} />
        <primitive object={M.tvBezel} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.041]}>
        <planeGeometry args={[w, h]} />
        <primitive object={SCREEN_MAT[p.variant]} attach="material" />
      </mesh>
    </group>
  );
}

/** Whiteboard with an aluminium frame and a marker tray. */
function Whiteboard({ p, index = 0 }: { p: WallPanel; index?: number }) {
  const [w, h] = p.size;
  const face =
    M.whiteboardMarked[index % M.whiteboardMarked.length] ??
    M.whiteboardMarked[0]!;
  return (
    <group position={p.position} rotation={p.rotation}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.08, h + 0.08, 0.05]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[w, h]} />
        <primitive object={face} attach="material" />
      </mesh>
      <mesh position={[0, -h / 2 - 0.09, 0.06]}>
        <boxGeometry args={[w * 0.55, 0.04, 0.1]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * Framed gallery art — walnut frame + canvas face. Images come from the
 * team-curated pack (`${ASSET_BASE_URL}/art/<artId>.jpg`) so CORS and
 * licensing stay deterministic. Missing/failed images fall back to a blank
 * canvas (wallAccent) instead of breaking the wall.
 */
const artCache = new Map<string, THREE.Texture | null>();

function useArtTexture(artId: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(
    () => artCache.get(artId) ?? null,
  );
  useEffect(() => {
    if (artCache.has(artId)) {
      setTex(artCache.get(artId) ?? null);
      return;
    }
    let live = true;
    new THREE.TextureLoader()
      .setCrossOrigin("anonymous")
      .loadAsync(`${ASSET_BASE_URL}/art/${artId}.jpg`)
      .then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        artCache.set(artId, t);
        if (live) setTex(t);
      })
      .catch(() => {
        artCache.set(artId, null);
      });
    return () => {
      live = false;
    };
  }, [artId]);
  return tex;
}

function FramedArt({ p }: { p: WallArt }) {
  const [w, h] = p.size;
  const tex = useArtTexture(p.artId);
  const face = useMemo(
    () =>
      tex
        ? new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.85,
            metalness: 0,
          })
        : M.wallAccent,
    [tex],
  );
  useEffect(() => {
    // Dispose only textures we created (never the shared fallback).
    return () => {
      if (tex && face !== M.wallAccent) face.dispose();
    };
  }, [face, tex]);
  return (
    <group position={p.position} rotation={p.rotation}>
      {/* walnut frame */}
      <mesh castShadow>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.06]} />
        <primitive object={M.walnut} attach="material" />
      </mesh>
      {/* canvas face */}
      <mesh position={[0, 0, 0.036]}>
        <planeGeometry args={[w, h]} />
        <primitive object={face} attach="material" />
      </mesh>
    </group>
  );
}

/** Timber slat acoustic feature wall (instanced fins over a dark backing). */
function SlatWall({
  position,
  length,
}: {
  position: [number, number, number];
  length: number;
}) {
  const faceSign = position[0] < 0 ? 1 : -1;
  const H = 2.9;
  const offsets = useMemo(() => {
    const step = 0.17;
    const n = Math.floor(length / step);
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(-length / 2 + step / 2 + i * step);
    return out;
  }, [length]);

  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh position={[-0.03 * faceSign, H / 2, 0]}>
        <boxGeometry args={[0.06, H, length]} />
        <primitive object={M.walnut} attach="material" />
      </mesh>
      <Instances range={offsets.length} limit={offsets.length} castShadow>
        <boxGeometry args={[0.07, H, 0.1]} />
        <primitive object={M.slat} attach="material" />
        {offsets.map((z, i) => (
          <Instance key={i} position={[0.035 * faceSign, H / 2, z]} />
        ))}
      </Instances>
      {/* grazing light at the base */}
      <mesh position={[0.06 * faceSign, 0.06, 0]}>
        <boxGeometry args={[0.06, 0.05, length - 0.3]} />
        <primitive object={M.stripWarm} attach="material" />
      </mesh>
    </group>
  );
}

/** Backlit blade sign beside a doorway — real room name, accent kept.
 *  1.7m wide, double-sided so it reads walking either way down the corridor. */
function RoomSignBlade({
  position,
  rotation,
  accent,
  label,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  accent: string;
  label: string;
}) {
  const face = useMemo(() => bladeTexture(label, accent), [label, accent]);
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[1.7, 0.4, 0.06]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.036]}>
        <planeGeometry args={[1.54, 0.31]} />
        <meshBasicMaterial map={face} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.036]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.54, 0.31]} />
        <meshBasicMaterial map={face} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Pulsing stair beacon: floor ring + floating L2 label at the stair base. */
function StairBeacon() {
  const ring = useRef<THREE.Mesh>(null);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const face = useMemo(() => bladeTexture("Stairs · L2 ↑", "#e8eaf0"), []);
  useFrame(({ clock }) => {
    const m = ring.current;
    if (!m || reduced) return;
    const t = clock.elapsedTime * 2;
    const s = 1 + 0.08 * Math.sin(t);
    m.scale.setScalar(s);
  });
  return (
    <group position={[-29.5, 0, 18.9]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.1, 1.35, 48]} />
        <meshBasicMaterial
          color="#e8eaf0"
          transparent
          opacity={0.85}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <Billboard position={[0, 2.6, 0]}>
        <mesh>
          <boxGeometry args={[1.7, 0.4, 0.05]} />
          <primitive object={M.blackAnodized} attach="material" />
        </mesh>
        <mesh position={[0, 0, 0.031]}>
          <planeGeometry args={[1.54, 0.31]} />
          <meshBasicMaterial
            map={face}
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Freestanding lobby directory totem — zones, accents, you-are-here. */
function DirectoryTotem({
  position = [-5.5, 0, 19.5] as [number, number, number],
  rows,
  footer,
}: {
  position?: [number, number, number];
  rows?: { name: string; accent: string; note?: string }[];
  footer?: string;
}) {
  const face = useMemo(
    () =>
      directoryTexture(
        rows ?? [
          { name: "Reception", accent: "#38bdf8", note: "you are here" },
          { name: "Engineering Floor", accent: "#818cf8", note: "west wing" },
          { name: "Lounge & Breakout", accent: "#f59e0b", note: "west wing" },
          { name: "Chill Space", accent: "#f472b6", note: "inside lounge" },
          { name: "Cafeteria", accent: "#fb923c", note: "east wing" },
          { name: "Meeting Rooms", accent: "#34d399", note: "east wing" },
          { name: "AI Lab", accent: "#22d3ee", note: "east wing" },
          { name: "Stairs · L2", accent: "#e8eaf0", note: "west end" },
          { name: "Leadership — West", accent: "#818cf8", note: "level 2" },
          { name: "Executive — East", accent: "#22d3ee", note: "level 2" },
        ],
        footer,
      ),
    [rows, footer],
  );
  return (
    <group position={position}>
      {/* pylon */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.9, 1.9, 0.12]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {/* face toward the entrance (+Z) */}
      <mesh position={[0, 0.98, 0.065]}>
        <planeGeometry args={[0.78, 1.56]} />
        <meshBasicMaterial map={face} toneMapped={false} />
      </mesh>
      {/* face toward the lobby (-Z) so the directory reads from both sides */}
      <mesh position={[0, 0.98, -0.065]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.78, 1.56]} />
        <meshBasicMaterial map={face} toneMapped={false} />
      </mesh>
      {/* base */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[1.0, 0.06, 0.4]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
    </group>
  );
}

/** T-bar grid + vents: thin dark lines every 1.2m so the big ceiling planes
 *  read as tiled, plus sprinkler/vent discs. One instanced draw per axis. */
function CeilingGrid({ y, z0, z1 }: { y: number; z0: number; z1: number }) {
  const xs = useMemo(() => {
    const out: number[] = [];
    for (let x = INTERIOR.minX + 0.6; x < INTERIOR.maxX; x += 1.2) out.push(x);
    return out;
  }, []);
  const zs = useMemo(() => {
    const out: number[] = [];
    for (let z = z0 + 0.6; z < z1; z += 1.2) out.push(z);
    return out;
  }, [z0, z1]);
  const depth = z1 - z0;
  const width = INTERIOR.maxX - INTERIOR.minX;
  return (
    <group name="ceiling-grid">
      <Instances range={xs.length} limit={xs.length}>
        <boxGeometry args={[0.02, 0.015, depth]} />
        <primitive object={M.precastDark} attach="material" />
        {xs.map((x) => (
          <Instance key={x} position={[x, y - 0.008, (z0 + z1) / 2]} />
        ))}
      </Instances>
      <Instances range={zs.length} limit={zs.length}>
        <boxGeometry args={[width, 0.015, 0.02]} />
        <primitive object={M.precastDark} attach="material" />
        {zs.map((z) => (
          <Instance key={z} position={[0, y - 0.008, z]} />
        ))}
      </Instances>
      {/* Vents / sprinklers — small dark discs scattered on the grid */}
      <Instances range={10} limit={10}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 12]} />
        <primitive object={M.metalDark} attach="material" />
        {Array.from({ length: 10 }, (_, i) => (
          <Instance
            key={i}
            position={[
              INTERIOR.minX + 3 + ((i * 7.3) % width),
              y - 0.015,
              z0 + 1 + ((i * 4.1) % depth),
            ]}
          />
        ))}
      </Instances>
    </group>
  );
}

/**
 * Everything mounted to the ceilings and walls: lighting fixtures that actually
 * sit in the ceiling plane, acoustic baffles, timber feature walls, displays,
 * whiteboards, room signage and rugs.
 */
export function Fittings() {
  const roofUnder = EXT_H; // lobby is open to the roof soffit

  return (
    <group name="fittings">
      {/* T-bar grids over the wing ceilings (lobby stays open to the roof) */}
      <CeilingGrid y={CEILING_Y} z0={INTERIOR.minZ} z1={MEZZ.z0} />
      <CeilingGrid y={CEILING_Y2} z0={INTERIOR.minZ} z1={MEZZ.z0} />
      {/* Recessed ceiling runs — level 1 wings + corridor, then level 2 */}
      {[...CEILING_RUNS, ...CEILING_RUNS_L2].map((r, i) => (
        <CeilingRun
          key={i}
          position={r.position}
          length={r.length}
          axis={r.axis}
          warm={r.warm}
        />
      ))}

      {/* One recessed strip inside each glazed pod */}
      {POD_LIGHTS.map((p, i) => (
        <CeilingRun
          key={`pod${i}`}
          position={p.position}
          length={p.length}
          axis="x"
          warm={p.warm}
        />
      ))}

      {/* Lobby pendants dropped into the triple-height atrium */}
      {LOBBY_PENDANTS.map((p, i) => (
        <Pendant
          key={`lp${i}`}
          position={p}
          top={roofUnder - 0.05}
          drop={3.4}
          radius={0.42}
          warm
        />
      ))}

      {/* Cafeteria pendants over the tables */}
      {CAFE_PENDANTS.map((p, i) => (
        <Pendant
          key={`cp${i}`}
          position={p}
          top={CEILING_Y - 0.05}
          drop={1.15}
          radius={0.24}
          warm
        />
      ))}

      {/* Acoustic baffles hanging under the ceiling */}
      <Instances range={BAFFLES.length} limit={BAFFLES.length} castShadow>
        <boxGeometry args={[1, 0.46, 0.05]} />
        <primitive object={M.felt} attach="material" />
        {BAFFLES.map((b, i) => (
          <Instance
            key={i}
            position={b.position}
            rotation={[0, b.axis === "x" ? 0 : Math.PI / 2, 0]}
            scale={[b.length, 1, 1]}
          />
        ))}
      </Instances>

      {/* Timber slat feature walls */}
      {SLAT_WALLS.map((s, i) => (
        <SlatWall key={i} position={s.position} length={s.length} />
      ))}

      {/* Displays + whiteboards */}
      {TV_PANELS.map((p, i) => (
        <Screen key={i} p={p} />
      ))}
      {WHITEBOARDS.map((p, i) => (
        <Whiteboard key={i} p={p} index={i} />
      ))}

      {/* Gallery wall art (interactive poster boards — see interactions.ts) */}
      {WALL_ART.map((p) => (
        <FramedArt key={p.artId} p={p} />
      ))}

      {/* Room signage */}
      {ROOM_SIGNS.map((s, i) => (
        <RoomSignBlade
          key={i}
          position={s.position}
          rotation={s.rotation}
          accent={s.accent}
          label={s.label}
        />
      ))}

      {/* Named plates on the L1 pod doors (L2 pods get theirs in Level2) */}
      {PODS.filter((p) => p.level === 1).map((p) => (
        <PodDoorPlate key={p.id} pod={p} />
      ))}

      {/* Lobby directory totem + courtyard entrance totem (dual-face, no rotation needed) */}
      <DirectoryTotem />
      <DirectoryTotem
        position={[6, 0, 28]}
        footer="●  YOU ARE HERE — COURTYARD"
        rows={[
          { name: "Entrance", accent: "#38bdf8", note: "straight ahead" },
          { name: "Reception", accent: "#38bdf8", note: "inside, east" },
          { name: "Engineering Floor", accent: "#818cf8", note: "west wing" },
          { name: "Cafeteria", accent: "#fb923c", note: "east wing" },
          { name: "Stairs · L2", accent: "#e8eaf0", note: "lobby west end" },
        ]}
      />
      {/* Stair beacon so L2 is discoverable from the lobby floor */}
      <StairBeacon />

      {/* Rugs anchoring the lounge clusters */}
      {RUGS.map(([x, z, w, d], i) => (
        <mesh
          key={i}
          position={[x, 0.018, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[w, d]} />
          <primitive object={M.rug} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
