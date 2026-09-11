import { CHILL_SCREEN, CHILL_SEATS, CHILL_LAMPS } from "./layout";
import { M } from "./materials";

const ARCADE_POSITION = [-7, 0, -15] as [number, number, number];

/**
 * The Chill Space / Play Area props: a big shared screen on the south wall
 * (the YouTube projector aligns its DOM overlay to this exact geometry), rows
 * of bean-bag seats facing it, and warm floor lamps flanking the screen.
 */
export function ChillSpace() {
  return (
    <group name="chill-space">
      {/* Shared screen — bezel + emissive idle face. The active YouTube video
          is a DOM overlay projected onto this same geometry (see
          ChillScreenProjection). */}
      <group position={CHILL_SCREEN.position} rotation={CHILL_SCREEN.rotation}>
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

      {/* Bean-bag seating rows */}
      {CHILL_SEATS.map(([x, z], i) => (
        <group key={`seat${i}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.42, 20, 16]} />
            <primitive object={M.felt} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Floor lamps flanking the screen */}
      {CHILL_LAMPS.map(([x, z], i) => (
        <group key={`lamp${i}`} position={[x, 0, z]}>
          <mesh position={[0, 1.15, 0]}>
            <cylinderGeometry args={[0.03, 0.05, 2.3, 8]} />
            <primitive object={M.lampPost} attach="material" />
          </mesh>
          <mesh position={[0, 2.3, 0]}>
            <coneGeometry args={[0.18, 0.3, 12, 1, true]} />
            <primitive object={M.lampPost} attach="material" />
          </mesh>
          <mesh position={[0, 2.28, 0]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <primitive object={M.lampGlow} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Arcade cabinet — the multiplayer-games station (coming soon). */}
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
