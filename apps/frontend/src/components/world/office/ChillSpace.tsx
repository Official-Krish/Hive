import {
  CHILL_SCREEN,
  CHILL_SEATS,
  CHILL_LAMPS,
  CHILL_RUG,
  CHILL_CONSOLE,
  CHILL_TABLES,
  CHILL_PLANT,
  CHILL_PANELS,
} from "./layout";
import { M } from "./materials";
import { KitPiece } from "./KitInstances";

const ARCADE_POSITION = [-7, 0, -15] as [number, number, number];

// Seat fabrics cycle so neighbours never share a hue.
const PUFF_FABRICS = [M.puffA, M.puffC, M.puffB, M.puffD, M.puffB, M.puffA];

/** Deterministic lived-in jitter — same input, same puff, every reload. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Plush bean-bag: squashed oval body, raised backrest lump facing the screen,
 * seam ring grounding it, top button. Yaw points local +Z (the backrest side)
 * away from the screen.
 */
function BeanBag({ x, z, index }: { x: number; z: number; index: number }) {
  const yaw =
    Math.atan2(x - CHILL_SCREEN.position[0], z - CHILL_SCREEN.position[2]) +
    (jitter(index, 1) - 0.5) * 0.24;
  const s = 0.94 + jitter(index, 2) * 0.12;
  const fabric = PUFF_FABRICS[index % PUFF_FABRICS.length] ?? M.puffA;
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]} scale={[s, 1, s]}>
      {/* grounding seam ring */}
      <mesh
        position={[0, 0.07, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <torusGeometry args={[0.42, 0.055, 10, 24]} />
        <primitive object={fabric} attach="material" />
      </mesh>
      {/* plush oval body */}
      <mesh castShadow position={[0, 0.33, 0]} scale={[1, 0.66, 0.94]}>
        <sphereGeometry args={[0.5, 24, 18]} />
        <primitive object={fabric} attach="material" />
      </mesh>
      {/* backrest lump — the orientation cue toward the screen */}
      <mesh
        castShadow
        position={[0, 0.52, 0.3]}
        rotation={[-0.35, 0, 0]}
        scale={[0.82, 0.72, 0.7]}
      >
        <sphereGeometry args={[0.34, 20, 14]} />
        <primitive object={fabric} attach="material" />
      </mesh>
      {/* top button */}
      <mesh position={[0, 0.62, -0.02]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 12]} />
        <primitive object={M.chairFabric} attach="material" />
      </mesh>
    </group>
  );
}

/** Round side table (kit sideTable.glb, CC0) with an optional mug. */
function SideTable({ x, z, mug }: { x: number; z: number; mug?: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <KitPiece model="sideTable" />
      {mug && (
        <mesh position={[0.1, 0.51, 0.05]} castShadow>
          <cylinderGeometry args={[0.045, 0.04, 0.1, 12]} />
          <primitive object={M.wall} attach="material" />
        </mesh>
      )}
    </group>
  );
}

/**
 * The Chill Space / Play Area props: a big shared screen on the north wall
 * (the YouTube projector aligns its DOM overlay to this exact geometry), rows
 * of bean-bag seats facing it, media console + backlight, felt acoustic
 * panels, warm floor lamps, side tables and a corner plant.
 */
export function ChillSpace() {
  const [rugX, rugZ, rugW, rugD] = CHILL_RUG;
  const [consoleX, consoleZ, consoleW, consoleD] = CHILL_CONSOLE;
  return (
    <group name="chill-space">
      {/* Rug anchoring the seating — border trim + warm pile */}
      <mesh position={[rugX, 0.012, rugZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[rugW + 0.5, rugD + 0.5]} />
        <primitive object={M.walnut} attach="material" />
      </mesh>
      <mesh
        position={[rugX, 0.018, rugZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[rugW, rugD]} />
        <primitive object={M.chillRug} attach="material" />
      </mesh>

      {/* Shared screen — bezel + emissive idle face. The active YouTube video
          is a DOM overlay projected onto this same geometry (see
          ChillScreenProjection). Position/size/rotation must not move. */}
      <group position={CHILL_SCREEN.position} rotation={CHILL_SCREEN.rotation}>
        {/* pink backlight halo spilling around the bezel */}
        <mesh position={[0, 0, -0.06]}>
          <planeGeometry
            args={[CHILL_SCREEN.size[0] + 0.7, CHILL_SCREEN.size[1] + 0.7]}
          />
          <meshStandardMaterial
            color="#0b0b10"
            emissive="#f472b6"
            emissiveIntensity={1.1}
            roughness={0.6}
          />
        </mesh>
        <mesh castShadow>
          <boxGeometry
            args={[
              CHILL_SCREEN.size[0] + 0.12,
              CHILL_SCREEN.size[1] + 0.12,
              0.09,
            ]}
          />
          <primitive object={M.tvBezel} attach="material" />
        </mesh>
        <mesh position={[0, 0, 0.052]}>
          <planeGeometry args={CHILL_SCREEN.size} />
          <primitive object={M.tvB} attach="material" />
        </mesh>
      </group>

      {/* Felt acoustic panels on the screen wall */}
      {CHILL_PANELS.map(([px, pw], i) => (
        <mesh key={`panel${i}`} position={[px, 2.2, -19.76]}>
          <boxGeometry args={[pw, 1.8, 0.06]} />
          <primitive object={M.felt} attach="material" />
        </mesh>
      ))}

      {/* Low media console — top stays clear of the projection plane */}
      <group position={[consoleX, 0, consoleZ]}>
        <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
          <boxGeometry args={[consoleW, 0.5, consoleD]} />
          <primitive object={M.walnut} attach="material" />
        </mesh>
        <mesh position={[0, 0.53, 0]} receiveShadow>
          <boxGeometry args={[consoleW + 0.08, 0.05, consoleD + 0.08]} />
          <primitive object={M.stoneCounter} attach="material" />
        </mesh>
        {/* door reveals */}
        {[-1.6, 0, 1.6].map((dx) => (
          <mesh key={dx} position={[dx, 0.26, consoleD / 2 + 0.012]}>
            <boxGeometry args={[1.4, 0.4, 0.02]} />
            <primitive object={M.woodLight} attach="material" />
          </mesh>
        ))}
        {/* warm status strip */}
        <mesh position={[0, 0.12, consoleD / 2 + 0.012]}>
          <boxGeometry args={[consoleW - 0.6, 0.04, 0.02]} />
          <primitive object={M.stripWarm} attach="material" />
        </mesh>
        {/* a leaning stack of books on top */}
        <mesh position={[-2.2, 0.6, 0]} castShadow>
          <boxGeometry args={[0.3, 0.05, 0.22]} />
          <primitive object={M.puffC} attach="material" />
        </mesh>
        <mesh position={[-2.2, 0.65, 0]} rotation={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.26, 0.05, 0.2]} />
          <primitive object={M.puffB} attach="material" />
        </mesh>
      </group>

      {/* Bean-bag seating rows facing the screen */}
      {CHILL_SEATS.map(([x, z], i) => (
        <BeanBag key={`seat${i}`} x={x} z={z} index={i} />
      ))}

      {/* Side tables flanking the front puff */}
      {CHILL_TABLES.map(([x, z], i) => (
        <SideTable key={`table${i}`} x={x} z={z} mug={i === 0} />
      ))}

      {/* Corner plant (kit, CC0) */}
      <KitPiece model="plant" position={[CHILL_PLANT[0], 0, CHILL_PLANT[1]]} />

      {/* Floor lamps flanking the screen (kit, CC0) */}
      {CHILL_LAMPS.map(([x, z], i) => (
        <KitPiece key={`lamp${i}`} model="floorLamp" position={[x, 0, z]} />
      ))}

      {/* Arcade cabinet — the multiplayer-games station. */}
      <group position={ARCADE_POSITION}>
        <mesh castShadow position={[0, 0.95, 0]}>
          <boxGeometry args={[0.9, 1.9, 0.7]} />
          <primitive object={M.tvBezel} attach="material" />
        </mesh>
        <mesh position={[0, 1.65, 0.36]}>
          <planeGeometry args={[0.62, 0.4]} />
          <primitive object={M.tvB} attach="material" />
        </mesh>
        <mesh castShadow position={[0, 0.15, 0.42]}>
          <boxGeometry args={[0.55, 0.3, 0.5]} />
          <primitive object={M.tvBezel} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
