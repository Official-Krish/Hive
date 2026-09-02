import { Instances, Instance } from "@react-three/drei";
import { InstancedFurniture } from "../InstancedFurniture";
import { M } from "./materials";
import {
  DESKS,
  DESK_CHAIRS,
  MONITORS,
  MEETING_CHAIRS,
  MEETING_TABLES,
  CAFE_TABLES,
  CAFE_STOOLS,
  CAFE_BENCH_TABLES,
  LOUNGE_SOFAS,
  LOUNGE_TABLES,
  SERVER_RACKS,
  PLANTS,
  PHONE_BOOTHS,
  CREDENZAS,
  PRINTERS,
  FRIDGES,
  WATER_COOLER,
} from "./layout";

const AISLE_Z = -14.6; // between the two server rows

/** Backlit hexagon (hive motif). */
function HexLogo({
  x,
  y,
  z,
  s = 0.5,
}: {
  x: number;
  y: number;
  z: number;
  s?: number;
}) {
  return (
    <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[s, s, 0.08, 6]} />
      <primitive object={M.logo} attach="material" />
    </mesh>
  );
}

/** Glass focus pod: frame, glazing, door reveal, seat, desk shelf, downlight. */
function PhoneBooth({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const W = 1.4;
  const D = 1.4;
  const H = 2.3;
  return (
    <group position={position} rotation={rotation}>
      {/* base + head */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[W, 0.1, D]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[0, H - 0.06, 0]} castShadow>
        <boxGeometry args={[W, 0.12, D]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {/* corner posts */}
      {(
        [
          [-W / 2 + 0.04, -D / 2 + 0.04],
          [W / 2 - 0.04, -D / 2 + 0.04],
          [-W / 2 + 0.04, D / 2 - 0.04],
          [W / 2 - 0.04, D / 2 - 0.04],
        ] as [number, number][]
      ).map(([dx, dz], i) => (
        <mesh key={i} position={[dx, H / 2, dz]} castShadow>
          <boxGeometry args={[0.08, H, 0.08]} />
          <primitive object={M.mullion} attach="material" />
        </mesh>
      ))}
      {/* glazing on three sides (the fourth is the doorway) */}
      <mesh position={[0, H / 2, -D / 2 + 0.03]}>
        <boxGeometry args={[W - 0.1, H - 0.24, 0.03]} />
        <primitive object={M.glassCheap} attach="material" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * W) / 2 - s * 0.03, H / 2, 0]}>
          <boxGeometry args={[0.03, H - 0.24, D - 0.1]} />
          <primitive object={M.glassCheap} attach="material" />
        </mesh>
      ))}
      {/* felt-backed seat + shelf */}
      <mesh position={[0, 0.45, -0.35]} castShadow>
        <boxGeometry args={[W - 0.3, 0.1, 0.45]} />
        <primitive object={M.felt} attach="material" />
      </mesh>
      <mesh position={[0, 0.78, -0.5]} castShadow>
        <boxGeometry args={[W - 0.3, 0.06, 0.3]} />
        <primitive object={M.oak} attach="material" />
      </mesh>
      {/* downlight */}
      <mesh position={[0, H - 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 14]} />
        <primitive object={M.stripWarm} attach="material" />
      </mesh>
    </group>
  );
}

/** Low storage run with a stone top and door reveals. */
function Credenza({
  x,
  z,
  w,
  d,
  ry,
}: {
  x: number;
  z: number;
  w: number;
  d: number;
  ry: number;
}) {
  const doors = Math.max(2, Math.round(w / 0.9));
  const dw = w / doors;
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.72, d]} />
        <primitive object={M.oak} attach="material" />
      </mesh>
      <mesh position={[0, 0.75, 0]} receiveShadow>
        <boxGeometry args={[w + 0.06, 0.06, d + 0.06]} />
        <primitive object={M.stoneCounter} attach="material" />
      </mesh>
      {Array.from({ length: doors }, (_, k) => (
        <mesh key={k} position={[-w / 2 + dw * (k + 0.5), 0.36, d / 2 + 0.012]}>
          <boxGeometry args={[dw - 0.04, 0.62, 0.02]} />
          <primitive object={M.woodLight} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Water dispenser against the cafeteria east wall (front faces west). */
function WaterCooler({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* Body */}
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 1.24, 0.4]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      {/* Top plate */}
      <mesh position={[0, 1.26, 0]} castShadow>
        <boxGeometry args={[0.36, 0.06, 0.32]} />
        <primitive object={M.wall} attach="material" />
      </mesh>
      {/* Inverted bottle */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.13, 0.07, 16]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.125, 0.125, 0.42, 16]} />
        <primitive object={M.glassCheap} attach="material" />
      </mesh>
      {/* Basin + spigot on the west face */}
      <mesh position={[-0.14, 1.0, 0]}>
        <boxGeometry args={[0.14, 0.05, 0.3]} />
        <primitive object={M.wall} attach="material" />
      </mesh>
      <mesh position={[-0.24, 0.94, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.18, 8]} />
        <primitive object={M.chrome} attach="material" />
      </mesh>
      {/* Blue accent dot (brand cue) */}
      <mesh position={[0.25, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 12]} />
        <primitive object={M.ledCyan} attach="material" />
      </mesh>
    </group>
  );
}

export function Furnishings() {
  return (
    <group name="office-furnishings">
      {/* Bulk repeated furniture (one draw call per sub-mesh).
          Ceiling fixtures are NOT passed here — they live in Fittings.tsx,
          mounted at the real ceiling plane. */}
      <InstancedFurniture
        desks={DESKS}
        chairs={[...DESK_CHAIRS, ...MEETING_CHAIRS]}
        monitors={MONITORS}
        plants={PLANTS}
        sofas={LOUNGE_SOFAS}
        coffeeTables={LOUNGE_TABLES}
      />

      {/* ---------------- Reception (east lobby) ---------------- */}
      <group>
        {/* Counter: main run + return */}
        <mesh position={[10.5, 0.55, 16.1]} castShadow receiveShadow>
          <boxGeometry args={[8, 1.1, 1.2]} />
          <primitive object={M.reception} attach="material" />
        </mesh>
        <mesh position={[14.3, 0.55, 15.2]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 1.1, 2.4]} />
          <primitive object={M.reception} attach="material" />
        </mesh>
        {/* Fluted timber front */}
        <Instances range={26} limit={26} castShadow>
          <boxGeometry args={[0.2, 1.0, 0.12]} />
          <primitive object={M.oak} attach="material" />
          {Array.from({ length: 26 }, (_, i) => (
            <Instance key={i} position={[6.75 + i * 0.3, 0.55, 15.46]} />
          ))}
        </Instances>
        {/* Stone tops */}
        <mesh position={[10.5, 1.14, 16.1]} receiveShadow>
          <boxGeometry args={[8.3, 0.09, 1.45]} />
          <primitive object={M.stoneCounter} attach="material" />
        </mesh>
        <mesh position={[14.3, 1.14, 15.2]} receiveShadow>
          <boxGeometry args={[1.45, 0.09, 2.6]} />
          <primitive object={M.stoneCounter} attach="material" />
        </mesh>
        {/* Warm under-counter glow */}
        <mesh position={[10.5, 0.07, 15.44]}>
          <boxGeometry args={[7.6, 0.05, 0.03]} />
          <primitive object={M.stripWarm} attach="material" />
        </mesh>
        {/* Desk kit */}
        {[8.4, 12.6].map((x) => (
          <mesh
            key={x}
            position={[x, 1.42, 16.35]}
            rotation={[0, Math.PI, -0.12]}
            castShadow
          >
            <boxGeometry args={[0.62, 0.4, 0.03]} />
            <primitive object={M.screen} attach="material" />
          </mesh>
        ))}

        {/* Feature wall behind reception (hosts the video wall in Fittings) */}
        <mesh position={[10.5, 1.8, 18.2]} castShadow receiveShadow>
          <boxGeometry args={[11.8, 3.6, 0.6]} />
          <primitive object={M.featureWall} attach="material" />
        </mesh>
        {/* Brand hexes above the display */}
        <HexLogo x={9.1} y={3.28} z={17.88} s={0.26} />
        <HexLogo x={10.5} y={3.28} z={17.88} s={0.26} />
        <HexLogo x={11.9} y={3.28} z={17.88} s={0.26} />
        {/* Wall-wash strip at the base */}
        <mesh position={[10.5, 0.06, 17.84]}>
          <boxGeometry args={[11.2, 0.05, 0.06]} />
          <primitive object={M.stripWarm} attach="material" />
        </mesh>
      </group>

      {/* ---------------- Meeting conference tables ---------------- */}
      {MEETING_TABLES.map((t, i) => (
        <group key={i} position={t.position} rotation={t.rotation}>
          <mesh position={[0, 0.73, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.6, 0.1, 1.4]} />
            <primitive object={M.walnut} attach="material" />
          </mesh>
          <mesh position={[0, 0.36, 0]} castShadow>
            <boxGeometry args={[3.4, 0.72, 0.5]} />
            <primitive object={M.metalDark} attach="material" />
          </mesh>
          {/* Cable/AV puck + a couple of laptops */}
          <mesh position={[0, 0.79, 0]}>
            <boxGeometry args={[0.5, 0.03, 0.2]} />
            <primitive object={M.blackAnodized} attach="material" />
          </mesh>
          {[-1.2, 1.2].map((dx) => (
            <mesh
              key={dx}
              position={[dx, 0.8, 0.15]}
              rotation={[-0.35, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.36, 0.24, 0.02]} />
              <primitive object={M.screen} attach="material" />
            </mesh>
          ))}
        </group>
      ))}

      {/* ---------------- Cafeteria ---------------- */}
      {/* Service counter (west edge) */}
      <group>
        <mesh position={[7.5, 0.55, 7]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 1.1, 8]} />
          <primitive object={M.wallAccent} attach="material" />
        </mesh>
        <mesh position={[7.5, 1.13, 7]} receiveShadow>
          <boxGeometry args={[2.6, 0.09, 8.2]} />
          <primitive object={M.stoneCounter} attach="material" />
        </mesh>
        {/* Sneeze guard */}
        <mesh position={[8.5, 1.55, 7]}>
          <boxGeometry args={[0.04, 0.75, 7.4]} />
          <primitive object={M.glassCheap} attach="material" />
        </mesh>
        {/* Food wells */}
        <Instances range={5} limit={5}>
          <boxGeometry args={[1.4, 0.1, 1.1]} />
          <primitive object={M.metalBrushed} attach="material" />
          {[4.2, 5.6, 7, 8.4, 9.8].map((z, i) => (
            <Instance key={i} position={[7.4, 1.2, z]} />
          ))}
        </Instances>
        {/* Warm service light over the counter */}
        <mesh position={[7.5, 2.5, 7]}>
          <boxGeometry args={[0.22, 0.07, 7.2]} />
          <primitive object={M.stripWarm} attach="material" />
        </mesh>
      </group>

      {/* Coffee-bar island */}
      <group>
        <mesh position={[28.5, 0.5, 5.2]} castShadow receiveShadow>
          <boxGeometry args={[5, 1, 2]} />
          <primitive object={M.walnut} attach="material" />
        </mesh>
        <mesh position={[28.5, 1.04, 5.2]} receiveShadow>
          <boxGeometry args={[5.2, 0.09, 2.2]} />
          <primitive object={M.stoneCounter} attach="material" />
        </mesh>
        <mesh position={[27, 1.32, 5.2]} castShadow>
          <boxGeometry args={[0.9, 0.48, 0.6]} />
          <primitive object={M.chrome} attach="material" />
        </mesh>
        {/* Cup stacks + grinder */}
        {[29.3, 29.8, 30.3].map((x, i) => (
          <mesh key={x} position={[x, 1.24, 5.6 - i * 0.15]} castShadow>
            <cylinderGeometry args={[0.07, 0.055, 0.32, 12]} />
            <primitive object={M.wall} attach="material" />
          </mesh>
        ))}
        <mesh position={[28.2, 1.26, 4.7]} castShadow>
          <boxGeometry args={[0.3, 0.36, 0.3]} />
          <primitive object={M.blackAnodized} attach="material" />
        </mesh>
      </group>

      {/* Communal bench table */}
      {CAFE_BENCH_TABLES.map((t, i) => (
        <group key={i} position={t.position} rotation={t.rotation}>
          <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.09, 1.6]} />
            <primitive object={M.oak} attach="material" />
          </mesh>
          {[-1.3, 1.3].map((dx) => (
            <mesh key={dx} position={[dx, 0.37, 0]} castShadow>
              <boxGeometry args={[0.1, 0.72, 1.4]} />
              <primitive object={M.metalDark} attach="material" />
            </mesh>
          ))}
          {[-1.15, 1.15].map((dz) => (
            <mesh key={dz} position={[0, 0.44, dz]} castShadow receiveShadow>
              <boxGeometry args={[2.8, 0.08, 0.38]} />
              <primitive object={M.woodLight} attach="material" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Round dining tables */}
      <Instances
        range={CAFE_TABLES.length}
        limit={CAFE_TABLES.length}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.7, 0.7, 0.08, 20]} />
        <primitive object={M.woodLight} attach="material" />
        {CAFE_TABLES.map((t, i) => (
          <Instance key={i} position={[t.position[0], 0.74, t.position[2]]} />
        ))}
      </Instances>
      <Instances range={CAFE_TABLES.length} limit={CAFE_TABLES.length}>
        <cylinderGeometry args={[0.08, 0.12, 0.74, 12]} />
        <primitive object={M.metalBrushed} attach="material" />
        {CAFE_TABLES.map((t, i) => (
          <Instance key={i} position={[t.position[0], 0.37, t.position[2]]} />
        ))}
      </Instances>
      {/* Stools: seat + leg */}
      <Instances
        range={CAFE_STOOLS.length}
        limit={CAFE_STOOLS.length}
        castShadow
      >
        <cylinderGeometry args={[0.24, 0.24, 0.08, 16]} />
        <primitive object={M.sofaWarm} attach="material" />
        {CAFE_STOOLS.map((s, i) => (
          <Instance key={i} position={[s.position[0], 0.5, s.position[2]]} />
        ))}
      </Instances>
      <Instances range={CAFE_STOOLS.length} limit={CAFE_STOOLS.length}>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 10]} />
        <primitive object={M.metalDark} attach="material" />
        {CAFE_STOOLS.map((s, i) => (
          <Instance key={i} position={[s.position[0], 0.25, s.position[2]]} />
        ))}
      </Instances>

      {/* Tall units / fridges */}
      {FRIDGES.map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 1.9, 0.75]} />
            <primitive object={M.metalBrushed} attach="material" />
          </mesh>
          <mesh position={[0, 1.1, 0.39]}>
            <boxGeometry args={[0.72, 1.1, 0.03]} />
            <primitive object={M.glassCheap} attach="material" />
          </mesh>
          <mesh position={[0, 1.85, 0.39]}>
            <boxGeometry args={[0.7, 0.04, 0.03]} />
            <primitive object={M.ledCyan} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Water dispenser */}
      <WaterCooler x={WATER_COOLER[0]} z={WATER_COOLER[1]} />

      {/* ---------------- Storage & utility ---------------- */}
      {CREDENZAS.map(([x, z, w, d, ry], i) => (
        <Credenza key={i} x={x} z={z} w={w} d={d} ry={ry} />
      ))}

      {PRINTERS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 0.7, 0.7]} />
            <primitive object={M.wallAccent} attach="material" />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[0.8, 0.24, 0.75]} />
            <primitive object={M.blackAnodized} attach="material" />
          </mesh>
          <mesh position={[0, 0.94, 0.1]} rotation={[-0.5, 0, 0]}>
            <planeGeometry args={[0.22, 0.14]} />
            <primitive object={M.ledGreen} attach="material" />
          </mesh>
          <mesh position={[0, 0.66, 0.3]}>
            <boxGeometry args={[0.6, 0.02, 0.3]} />
            <primitive object={M.wall} attach="material" />
          </mesh>
        </group>
      ))}

      {/* ---------------- Focus pods ---------------- */}
      {PHONE_BOOTHS.map((b, i) => (
        <PhoneBooth key={i} position={b.position} rotation={b.rotation} />
      ))}

      {/* ---------------- AI Lab: server racks ---------------- */}
      <Instances
        range={SERVER_RACKS.length}
        limit={SERVER_RACKS.length}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.3, 2.0, 0.8]} />
        <primitive object={M.serverBody} attach="material" />
        {SERVER_RACKS.map((r, i) => (
          <Instance key={i} position={[r.position[0], 1.0, r.position[2]]} />
        ))}
      </Instances>
      {/* LED strips facing the aisle */}
      <Instances range={SERVER_RACKS.length} limit={SERVER_RACKS.length}>
        <boxGeometry args={[0.9, 1.6, 0.04]} />
        <primitive object={M.ledCyan} attach="material" />
        {SERVER_RACKS.map((r, i) => {
          const off = r.position[2] < AISLE_Z ? 0.42 : -0.42;
          return (
            <Instance
              key={i}
              position={[r.position[0], 1.05, r.position[2] + off]}
            />
          );
        })}
      </Instances>
      {/* Status LEDs on the rack tops */}
      <Instances range={SERVER_RACKS.length} limit={SERVER_RACKS.length}>
        <boxGeometry args={[0.5, 0.03, 0.06]} />
        <primitive object={M.ledGreen} attach="material" />
        {SERVER_RACKS.map((r, i) => (
          <Instance key={i} position={[r.position[0], 2.02, r.position[2]]} />
        ))}
      </Instances>
    </group>
  );
}
