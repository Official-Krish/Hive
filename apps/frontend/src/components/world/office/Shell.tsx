import { useMemo } from "react";
import * as THREE from "three";
import {
  WALLS,
  ROOMS,
  INTERIOR,
  DOOR,
  EXT_H,
  ROOF_T,
  PARAPET_H,
  CEILING_Y,
  CEILING_Y2,
  L2_Y,
  SLAB_T,
  MEZZ,
  SKYLIGHT,
  COLUMNS,
  COLUMN_W,
  type Wall,
} from "./layout";
import { M, floorFor, LOBBY_FLOOR_MAP } from "./materials";

const { minX, maxX, minZ, maxZ } = INTERIOR;
const width = maxX - minX;
const depth = maxZ - minZ;

// Roof overhangs the walls slightly so the building reads as capped, not open.
const OVER = 0.3;
const RX0 = minX - OVER;
const RX1 = maxX + OVER;
const RZ0 = minZ - OVER;
const RZ1 = maxZ + OVER;
const ROOF_Y = EXT_H + ROOF_T / 2;
const ROOF_TOP = EXT_H + ROOF_T;

/** Lobby is triple-height (open to the skylight); the wings are two storeys. */
const LOBBY_Z = MEZZ.z0;
/** Underside of the upper floor slab. */
const SOFFIT_Y = L2_Y - SLAB_T;

/**
 * One glazed wall segment. Tall segments (the two-storey facade) are drawn as a
 * stack of curtain-wall bands — one per floor — each with its own spandrel at
 * the slab line, head and sill rails, and shared vertical mullions running the
 * full height. Uses the cheap (non-transmissive) glass so the whole facade
 * stays one draw pass instead of one scene re-render per pane.
 */
function GlassSeg({ w }: { w: Wall }) {
  const horizontal = Math.abs(w.z1 - w.z0) < 1e-6;
  const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const cx = (w.x0 + w.x1) / 2;
  const cz = (w.z0 + w.z1) / 2;
  const rotY = horizontal ? 0 : Math.PI / 2;
  const base = w.base ?? 0;

  const mullions = useMemo(() => {
    const posts: number[] = [];
    const count = Math.max(1, Math.round(len / 2.7));
    for (let i = 0; i <= count; i++) posts.push(-len / 2 + (len * i) / count);
    return posts;
  }, [len]);

  // Floor lines within this segment, measured from its own base.
  const bands = useMemo(() => {
    const cuts = [0];
    if (base === 0 && w.h > L2_Y + 1.5) cuts.push(L2_Y);
    cuts.push(w.h);
    const out: { y0: number; y1: number }[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const y0 = cuts[i] ?? 0;
      const y1 = cuts[i + 1] ?? w.h;
      out.push({ y0, y1 });
    }
    return out;
  }, [base, w.h]);

  const thin = w.h < 1.4; // balustrade rather than a wall

  return (
    <group position={[cx, base, cz]} rotation={[0, rotY, 0]}>
      {bands.map(({ y0, y1 }, i) => {
        const bh = y1 - y0;
        const cy = (y0 + y1) / 2;
        return (
          <group key={i} position={[0, cy, 0]}>
            <mesh>
              <boxGeometry args={[len, bh, 0.06]} />
              <primitive object={M.glassCheap} attach="material" />
            </mesh>
            {/* head + sill rails */}
            {[bh / 2 - 0.06, -bh / 2 + 0.06].map((y, k) => (
              <mesh key={k} position={[0, y, 0]}>
                <boxGeometry args={[len, 0.12, 0.14]} />
                <primitive object={M.mullion} attach="material" />
              </mesh>
            ))}
            {/* opaque spandrel hiding the slab edge / sill */}
            {!thin && (
              <mesh position={[0, -bh / 2 + 0.34, 0]}>
                <boxGeometry args={[len, 0.42, 0.13]} />
                <primitive object={M.blackAnodized} attach="material" />
              </mesh>
            )}
          </group>
        );
      })}
      {/* vertical mullions run the full segment height */}
      {mullions.map((mx, i) => (
        <mesh key={i} position={[mx, w.h / 2, 0]}>
          <boxGeometry args={[0.09, w.h, 0.12]} />
          <primitive object={M.mullion} attach="material" />
        </mesh>
      ))}
      {/* capping rail — reads as a handrail on balustrades */}
      {thin && (
        <mesh position={[0, w.h + 0.03, 0]}>
          <boxGeometry args={[len + 0.1, 0.07, 0.13]} />
          <primitive object={M.metalBrushed} attach="material" />
        </mesh>
      )}
    </group>
  );
}

/** One solid wall segment: plaster body, metal baseboard, shadow-gap head. */
function SolidSeg({ w }: { w: Wall }) {
  const horizontal = Math.abs(w.z1 - w.z0) < 1e-6;
  const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  const cx = (w.x0 + w.x1) / 2;
  const cz = (w.z0 + w.z1) / 2;
  const base = w.base ?? 0;
  const size: [number, number, number] = horizontal
    ? [len, w.h, w.t]
    : [w.t, w.h, len];
  const trim = (h: number, pad: number): [number, number, number] =>
    horizontal ? [len, h, w.t + pad] : [w.t + pad, h, len];

  return (
    <group position={[cx, base, cz]}>
      <mesh position={[0, w.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={size} />
        <primitive object={M.wall} attach="material" />
      </mesh>
      {/* skirting */}
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={trim(0.14, 0.05)} />
        <primitive object={M.baseboard} attach="material" />
      </mesh>
      {/* partition head cap (reads as a shadow gap under the ceiling) */}
      {w.h < EXT_H - 0.5 && (
        <mesh position={[0, w.h - 0.04, 0]}>
          <boxGeometry args={trim(0.08, 0.06)} />
          <primitive object={M.blackAnodized} attach="material" />
        </mesh>
      )}
      {/* Floor-line band on the two-storey perimeter, so the facade reads as
          two storeys from outside rather than one very tall room. */}
      {w.h > L2_Y + 1.5 && base === 0 && (
        <mesh position={[0, L2_Y - 0.2, 0]}>
          <boxGeometry args={trim(0.5, 0.07)} />
          <primitive object={M.metalBrushed} attach="material" />
        </mesh>
      )}
    </group>
  );
}

/** Export the segment renderers so the level 2 layer draws identical walls. */
export { GlassSeg, SolidSeg };


/** A flat roof panel (used four times to leave the skylight opening). */
function RoofPanel({
  x0,
  x1,
  z0,
  z1,
}: {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}) {
  return (
    <mesh
      position={[(x0 + x1) / 2, ROOF_Y, (z0 + z1) / 2]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[x1 - x0, ROOF_T, z1 - z0]} />
      <primitive object={M.concrete} attach="material" />
    </mesh>
  );
}

/** Structural column, full height through both storeys, with floor collars. */
function Column({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, EXT_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[COLUMN_W, EXT_H, COLUMN_W]} />
        <primitive object={M.wallAccent} attach="material" />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[COLUMN_W + 0.12, 0.1, COLUMN_W + 0.12]} />
        <primitive object={M.baseboard} attach="material" />
      </mesh>
      {/* collar at the upper floor line */}
      <mesh position={[0, L2_Y + 0.05, 0]}>
        <boxGeometry args={[COLUMN_W + 0.14, 0.18, COLUMN_W + 0.14]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      <mesh position={[0, EXT_H - 0.08, 0]}>
        <boxGeometry args={[COLUMN_W + 0.14, 0.16, COLUMN_W + 0.14]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * Building shell — foundation, textured per-room floors (reflective in the
 * lobby), all walls, columns, the entrance canopy, the suspended wing ceiling
 * and a real capped roof with a parapet, glazed lantern and rooftop plant.
 */
export function Shell() {
  const lobbyRoom = ROOMS.find((r) => r.id === "lobby")!;
  const lobbyW = lobbyRoom.rect[1] - lobbyRoom.rect[0];
  const lobbyD = lobbyRoom.rect[3] - lobbyRoom.rect[2];

  const lobbyMap = useMemo(() => {
    if (!LOBBY_FLOOR_MAP) return undefined;
    const t = LOBBY_FLOOR_MAP.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(lobbyW / 2.4, lobbyD / 2.4);
    return t;
  }, [lobbyW, lobbyD]);

  return (
    <group name="office-shell">
      {/* Foundation slab, slightly proud of the courtyard so there's a threshold */}
      <mesh position={[0, -0.07, (minZ + maxZ) / 2]} receiveShadow>
        <boxGeometry args={[width + 1.4, 0.14, depth + 1.4]} />
        <primitive object={M.slab} attach="material" />
      </mesh>

      {/* Per-room textured floors (lobby handled separately below) */}
      {ROOMS.filter((r) => r.id !== "lobby").map((r) => {
        const [x0, x1, z0, z1] = r.rect;
        return (
          <mesh
            key={r.id}
            position={[(x0 + x1) / 2, 0.01, (z0 + z1) / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[x1 - x0, z1 - z0]} />
            <primitive
              object={floorFor(r.floor, x1 - x0, z1 - z0)}
              attach="material"
            />
          </mesh>
        );
      })}

      {/* Lobby: polished stone with a real reflection */}
      <mesh
        position={[
          (lobbyRoom.rect[0] + lobbyRoom.rect[1]) / 2,
          0.012,
          (lobbyRoom.rect[2] + lobbyRoom.rect[3]) / 2,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[lobbyW, lobbyD]} />
        <meshStandardMaterial
          map={lobbyMap}
          color="#ded9ce"
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>

      {/* Walls */}
      {WALLS.map((w, i) =>
        w.kind === "glass" ? (
          <GlassSeg key={i} w={w} />
        ) : (
          <SolidSeg key={i} w={w} />
        ),
      )}

      {/* Structural columns */}
      {COLUMNS.map(([x, z], i) => (
        <Column key={i} x={x} z={z} />
      ))}

      {/* --- Entrance ------------------------------------------------------- */}
      {/* Header over the door gap (door clear height 3.0 m) */}
      <mesh position={[0, 3.3, maxZ]} castShadow>
        <boxGeometry args={[DOOR.x1 - DOOR.x0 + 0.8, 0.6, 0.44]} />
        <primitive object={M.wall} attach="material" />
      </mesh>
      {/* Glazed transom filling the facade above the entrance */}
      <mesh position={[0, (3.6 + EXT_H) / 2, maxZ]}>
        <boxGeometry args={[DOOR.x1 - DOOR.x0, EXT_H - 3.6, 0.06]} />
        <primitive object={M.glassCheap} attach="material" />
      </mesh>
      {[-2, 0, 2].map((x) => (
        <mesh key={x} position={[x, (3.6 + EXT_H) / 2, maxZ]}>
          <boxGeometry args={[0.09, EXT_H - 3.6, 0.12]} />
          <primitive object={M.mullion} attach="material" />
        </mesh>
      ))}
      <mesh position={[0, L2_Y - 0.1, maxZ]}>
        <boxGeometry args={[DOOR.x1 - DOOR.x0, 0.36, 0.13]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {/* Door jambs */}
      {[DOOR.x0 - 0.16, DOOR.x1 + 0.16].map((x, i) => (
        <mesh key={i} position={[x, 1.5, maxZ]} castShadow>
          <boxGeometry args={[0.32, 3.0, 0.44]} />
          <primitive object={M.mullion} attach="material" />
        </mesh>
      ))}
      {/* Cantilevered entrance canopy with recessed downlights */}
      <group position={[0, 0, maxZ + 2.3]}>
        <mesh position={[0, 4.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[16, 0.34, 5.2]} />
          <primitive object={M.wallAccent} attach="material" />
        </mesh>
        <mesh position={[0, 4.26, 0]}>
          <boxGeometry args={[16.3, 0.1, 5.5]} />
          <primitive object={M.metalBrushed} attach="material" />
        </mesh>
        {[-6.5, -3.25, 0, 3.25, 6.5].map((x) => (
          <mesh key={x} position={[x, 3.87, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 16]} />
            <primitive object={M.stripWarm} attach="material" />
          </mesh>
        ))}
        {/* tension rods back up to the facade */}
        {[-7.2, 7.2].map((x) => (
          <mesh key={x} position={[x, 5.3, -1.2]} rotation={[0.62, 0, 0]}>
            <boxGeometry args={[0.08, 0.08, 4.6]} />
            <primitive object={M.metalBrushed} attach="material" />
          </mesh>
        ))}
      </group>

      {/* --- Level 1 ceiling + upper floor slab ----------------------------- */}
      {/* Suspended ceiling over the wings + corridor */}
      <mesh
        position={[0, CEILING_Y, (minZ + LOBBY_Z) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, LOBBY_Z - minZ]} />
        <primitive object={M.ceiling} attach="material" />
      </mesh>
      {/* Plenum between the ceiling and the slab soffit, so looking up the
          atrium edge you see a real floor thickness rather than a paper plane. */}
      <mesh
        position={[0, (CEILING_Y + SOFFIT_Y) / 2, LOBBY_Z]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, SOFFIT_Y - CEILING_Y, 0.4]} />
        <primitive object={M.plenum} attach="material" />
      </mesh>
      {/* Upper floor slab: wings + corridor, then the mezzanine band, then the
          stair arrival balcony. The rest of the lobby stays open as an atrium. */}
      {(
        [
          [minX, maxX, minZ, MEZZ.z0],
          [MEZZ.x0, MEZZ.x1, MEZZ.z0, MEZZ.z1],
          [-19, -14, 15.6, 20.6],
        ] as [number, number, number, number][]
      ).map(([x0, x1, z0, z1], i) => (
        <group key={i}>
          <mesh
            position={[(x0 + x1) / 2, SOFFIT_Y + SLAB_T / 2, (z0 + z1) / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[x1 - x0, SLAB_T, z1 - z0]} />
            <primitive object={M.concrete} attach="material" />
          </mesh>
          {/* soffit finish, so the underside reads as a plastered ceiling */}
          <mesh
            position={[(x0 + x1) / 2, SOFFIT_Y - 0.01, (z0 + z1) / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[x1 - x0, z1 - z0]} />
            <primitive object={M.ceilingPanel} attach="material" />
          </mesh>
        </group>
      ))}
      {/* Brushed fascia along the atrium slab edge */}
      <mesh position={[0, SOFFIT_Y + SLAB_T / 2, MEZZ.z1 + 0.03]}>
        <boxGeometry args={[width, SLAB_T + 0.06, 0.08]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      {/* Cove light washing down from the mezzanine edge into the atrium */}
      <mesh position={[0, SOFFIT_Y - 0.06, MEZZ.z1 - 0.2]}>
        <boxGeometry args={[width - 2, 0.08, 0.12]} />
        <primitive object={M.stripWarm} attach="material" />
      </mesh>

      {/* --- Level 2 ceiling ------------------------------------------------ */}
      <mesh
        position={[0, CEILING_Y2, (minZ + LOBBY_Z) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, LOBBY_Z - minZ]} />
        <primitive object={M.ceiling} attach="material" />
      </mesh>
      <mesh
        position={[0, CEILING_Y2, (MEZZ.z0 + MEZZ.z1) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, MEZZ.z1 - MEZZ.z0]} />
        <primitive object={M.ceiling} attach="material" />
      </mesh>
      {/* Bulkhead where the level 2 ceiling meets the open atrium */}
      <mesh
        position={[0, (CEILING_Y2 + ROOF_TOP) / 2, MEZZ.z1]}
        castShadow
      >
        <boxGeometry args={[width, ROOF_TOP - CEILING_Y2, 0.5]} />
        <primitive object={M.wall} attach="material" />
      </mesh>
      <mesh position={[0, CEILING_Y2 + 0.1, MEZZ.z1 - 0.3]}>
        <boxGeometry args={[width - 2, 0.08, 0.12]} />
        <primitive object={M.stripWarm} attach="material" />
      </mesh>

      {/* --- Roof ----------------------------------------------------------- */}
      <RoofPanel x0={RX0} x1={RX1} z0={RZ0} z1={SKYLIGHT.z0} />
      <RoofPanel x0={RX0} x1={RX1} z0={SKYLIGHT.z1} z1={RZ1} />
      <RoofPanel x0={RX0} x1={SKYLIGHT.x0} z0={SKYLIGHT.z0} z1={SKYLIGHT.z1} />
      <RoofPanel x0={SKYLIGHT.x1} x1={RX1} z0={SKYLIGHT.z0} z1={SKYLIGHT.z1} />

      {/* Parapet + coping around the roof edge */}
      {(
        [
          [(RX0 + RX1) / 2, RZ0 + 0.18, RX1 - RX0, 0.36],
          [(RX0 + RX1) / 2, RZ1 - 0.18, RX1 - RX0, 0.36],
          [RX0 + 0.18, (RZ0 + RZ1) / 2, 0.36, RZ1 - RZ0],
          [RX1 - 0.18, (RZ0 + RZ1) / 2, 0.36, RZ1 - RZ0],
        ] as [number, number, number, number][]
      ).map(([cx, cz, sx, sz], i) => (
        <group key={i}>
          <mesh
            position={[cx, ROOF_TOP + PARAPET_H / 2, cz]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[sx, PARAPET_H, sz]} />
            <primitive object={M.parapet} attach="material" />
          </mesh>
          <mesh position={[cx, ROOF_TOP + PARAPET_H + 0.03, cz]}>
            <boxGeometry args={[sx + 0.12, 0.07, sz + 0.12]} />
            <primitive object={M.metalBrushed} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Glazed lantern over the lobby + its frame grid */}
      <mesh
        position={[
          (SKYLIGHT.x0 + SKYLIGHT.x1) / 2,
          ROOF_TOP - 0.08,
          (SKYLIGHT.z0 + SKYLIGHT.z1) / 2,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[SKYLIGHT.x1 - SKYLIGHT.x0, SKYLIGHT.z1 - SKYLIGHT.z0]}
        />
        <primitive object={M.glassCheap} attach="material" />
      </mesh>
      {/* transverse frame ribs */}
      {Array.from(
        { length: 9 },
        (_, i) => SKYLIGHT.x0 + ((SKYLIGHT.x1 - SKYLIGHT.x0) * i) / 8,
      ).map((x) => (
        <mesh
          key={x}
          position={[x, ROOF_TOP - 0.14, (SKYLIGHT.z0 + SKYLIGHT.z1) / 2]}
        >
          <boxGeometry args={[0.16, 0.24, SKYLIGHT.z1 - SKYLIGHT.z0]} />
          <primitive object={M.mullion} attach="material" />
        </mesh>
      ))}
      {/* longitudinal ribs */}
      {[SKYLIGHT.z0, (SKYLIGHT.z0 + SKYLIGHT.z1) / 2, SKYLIGHT.z1].map((z) => (
        <mesh
          key={z}
          position={[(SKYLIGHT.x0 + SKYLIGHT.x1) / 2, ROOF_TOP - 0.14, z]}
        >
          <boxGeometry args={[SKYLIGHT.x1 - SKYLIGHT.x0 + 0.4, 0.26, 0.22]} />
          <primitive object={M.mullion} attach="material" />
        </mesh>
      ))}

      {/* Rooftop plant: AHUs on a housekeeping pad, plus risers */}
      <group position={[0, ROOF_TOP, -6]}>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <boxGeometry args={[52, 0.12, 6]} />
          <primitive object={M.parapet} attach="material" />
        </mesh>
        {[-20, -6, 8, 22].map((x) => (
          <group key={x} position={[x, 0.12, 0]}>
            <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
              <boxGeometry args={[4.4, 1.5, 2.8]} />
              <primitive object={M.metalBrushed} attach="material" />
            </mesh>
            <mesh position={[0, 1.56, 0]}>
              <boxGeometry args={[4.6, 0.12, 3]} />
              <primitive object={M.blackAnodized} attach="material" />
            </mesh>
            <mesh position={[1.2, 1.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.55, 0.55, 0.5, 16]} />
              <primitive object={M.metalDark} attach="material" />
            </mesh>
          </group>
        ))}
      </group>
      {/* Duct run + roof hatch */}
      <mesh position={[0, ROOF_TOP + 0.45, -13]} castShadow>
        <boxGeometry args={[44, 0.8, 1.1]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      <mesh position={[-27, ROOF_TOP + 0.35, 6]} castShadow>
        <boxGeometry args={[2, 0.7, 2]} />
        <primitive object={M.metalDark} attach="material" />
      </mesh>
    </group>
  );
}
