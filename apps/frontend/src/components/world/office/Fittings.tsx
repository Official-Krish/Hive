import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
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
  ROOM_SIGNS,
  RUGS,
  CEILING_Y,
  EXT_H,
  type WallPanel,
} from "./layout";
import { M } from "./materials";

const SCREEN_MAT = { a: M.tvA, b: M.tvB, c: M.tvC } as const;

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
function Whiteboard({ p }: { p: WallPanel }) {
  const [w, h] = p.size;
  return (
    <group position={p.position} rotation={p.rotation}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.08, h + 0.08, 0.05]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[w, h]} />
        <primitive object={M.whiteboard} attach="material" />
      </mesh>
      <mesh position={[0, -h / 2 - 0.09, 0.06]}>
        <boxGeometry args={[w * 0.55, 0.04, 0.1]} />
        <primitive object={M.metalBrushed} attach="material" />
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

/** Backlit blade sign beside a doorway. */
function RoomSignBlade({
  position,
  rotation,
  accent,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  accent: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[1.5, 0.34, 0.05]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[-0.6, 0, 0.032]}>
        <planeGeometry args={[0.16, 0.2]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.8}
          roughness={0.3}
        />
      </mesh>
      {[0.06, -0.02, -0.1].map((y, i) => (
        <mesh key={i} position={[-0.05 + i * 0.02, y, 0.032]}>
          <planeGeometry args={[0.78 - i * 0.16, 0.045]} />
          <meshStandardMaterial
            color="#cbd5e1"
            emissive="#8ea3bb"
            emissiveIntensity={0.5}
            roughness={0.5}
          />
        </mesh>
      ))}
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
        <Whiteboard key={i} p={p} />
      ))}

      {/* Room signage */}
      {ROOM_SIGNS.map((s, i) => (
        <RoomSignBlade
          key={i}
          position={s.position}
          rotation={s.rotation}
          accent={s.accent}
        />
      ))}

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
