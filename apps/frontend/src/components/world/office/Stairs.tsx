import { M, floorFor } from "./materials";
import {
  STAIR,
  STAIR_TREADS,
  STAIR_LANDING,
  L2_Y,
  SLAB_T,
  BALUSTRADE_H,
} from "./layout";

// Geometry of the single straight monumental flight (rises along +X).
const RUN = STAIR.x1 - STAIR.x0; // 9 m horizontal
const WIDE = STAIR.z1 - STAIR.z0; // 3.4 m clear width
const TREAD = RUN / STAIR_TREADS; // ~0.69 m going
const RISER = L2_Y / STAIR_TREADS; // ~0.33 m rise
const SLOPE = Math.atan2(L2_Y, RUN); // ~25.5 deg
const SLOPE_LEN = Math.hypot(RUN, L2_Y);
const CX = (STAIR.x0 + STAIR.x1) / 2;
const CZ = (STAIR.z0 + STAIR.z1) / 2;

/**
 * Sloped glass balustrade with a brushed handrail, mirrored onto both sides of
 * the flight. Drawn here rather than derived from a wall list because the panel
 * has to rake with the stair; the matching colliders live in `STAIR_GUARDS`.
 */
function Guard({ side }: { side: -1 | 1 }) {
  const z = CZ + (side * WIDE) / 2 - side * 0.06;
  return (
    <group position={[CX, L2_Y / 2, z]} rotation={[0, 0, SLOPE]}>
      {/* stringer: the raking beam the treads sit on */}
      <mesh position={[0, -0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[SLOPE_LEN, 0.34, 0.14]} />
        <primitive object={M.concrete} attach="material" />
      </mesh>
      {/* glazing */}
      <mesh position={[0, BALUSTRADE_H / 2 + 0.08, 0]}>
        <boxGeometry args={[SLOPE_LEN - 0.1, BALUSTRADE_H, 0.04]} />
        <primitive object={M.glassCheap} attach="material" />
      </mesh>
      {/* shoe channel clamping the glass */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[SLOPE_LEN, 0.14, 0.11]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {/* capping handrail */}
      <mesh position={[0, BALUSTRADE_H + 0.11, 0]} castShadow>
        <boxGeometry args={[SLOPE_LEN + 0.2, 0.08, 0.12]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * The lobby feature stair: 13 open treads on raking stringers, glass
 * balustrades, a lit soffit and the arrival balcony landing at level 2.
 * The player walks it for real — `RAMPS` in layout.ts samples the same slope.
 */
export function Stairs() {
  return (
    <group name="feature-stair">
      {/* Treads + risers. Tread tops sit on the sampled ramp height at their
          own centre, so the avatar's feet land on the visible stone. */}
      {Array.from({ length: STAIR_TREADS }, (_, i) => {
        const x = STAIR.x0 + TREAD * (i + 0.5);
        const top = RISER * (i + 0.5);
        return (
          <group key={i} position={[x, 0, CZ]}>
            <mesh position={[0, top - 0.03, 0]} castShadow receiveShadow>
              <boxGeometry args={[TREAD, 0.06, WIDE - 0.24]} />
              <primitive object={M.stoneCounter} attach="material" />
            </mesh>
            {/* nosing */}
            <mesh position={[TREAD / 2 - 0.02, top - 0.035, 0]}>
              <boxGeometry args={[0.05, 0.05, WIDE - 0.24]} />
              <primitive object={M.metalBrushed} attach="material" />
            </mesh>
            {/* riser plate, set back so the treads read as floating */}
            <mesh position={[-TREAD / 2 + 0.06, top - RISER / 2, 0]}>
              <boxGeometry args={[0.05, RISER, WIDE - 0.4]} />
              <primitive object={M.wallAccent} attach="material" />
            </mesh>
            {/* step-edge marker light, every third tread */}
            {i % 3 === 0 && (
              <mesh position={[TREAD / 2 - 0.06, top - 0.12, -WIDE / 2 + 0.2]}>
                <boxGeometry args={[0.04, 0.04, 0.3]} />
                <primitive object={M.stripWarm} attach="material" />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Raking soffit closing the underside — the space below stays usable. */}
      <mesh
        position={[CX, L2_Y / 2 - 0.5, CZ]}
        rotation={[0, 0, SLOPE]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[SLOPE_LEN, 0.18, WIDE - 0.28]} />
        <primitive object={M.wall} attach="material" />
      </mesh>

      <Guard side={-1} />
      <Guard side={1} />

      {/* Bottom step plinth, so the flight meets the lobby floor cleanly. */}
      <mesh position={[STAIR.x0 - 0.35, 0.05, CZ]} receiveShadow>
        <boxGeometry args={[0.9, 0.1, WIDE + 0.3]} />
        <primitive object={M.stoneCounter} attach="material" />
      </mesh>

      {/* --- Arrival balcony ------------------------------------------------ */}
      {/* Landing floor finish (the structural slab is drawn by Shell). */}
      <mesh
        position={[
          (STAIR_LANDING.x0 + STAIR_LANDING.x1) / 2,
          L2_Y + 0.012,
          (STAIR_LANDING.z0 + STAIR_LANDING.z1) / 2,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry
          args={[
            STAIR_LANDING.x1 - STAIR_LANDING.x0,
            STAIR_LANDING.z1 - STAIR_LANDING.z0,
          ]}
        />
        <primitive
          object={floorFor(
            "wood",
            STAIR_LANDING.x1 - STAIR_LANDING.x0,
            STAIR_LANDING.z1 - STAIR_LANDING.z0,
          )}
          attach="material"
        />
      </mesh>
      {/* Fascia on the landing's exposed west edge, facing the flight. */}
      <mesh
        position={[
          STAIR_LANDING.x0 - 0.03,
          L2_Y - SLAB_T / 2,
          (STAIR_LANDING.z0 + STAIR_LANDING.z1) / 2,
        ]}
      >
        <boxGeometry
          args={[0.08, SLAB_T + 0.06, STAIR_LANDING.z1 - STAIR_LANDING.z0]}
        />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      {/* Downlight over the arrival point. */}
      <mesh position={[-16.5, L2_Y + 2.9, 18]}>
        <boxGeometry args={[3.2, 0.08, 0.14]} />
        <primitive object={M.stripWarm} attach="material" />
      </mesh>
    </group>
  );
}
