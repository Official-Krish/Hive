import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { INTERIOR, ACCENT_LIGHTS, ACCENT_LIGHTS_L2 } from "../office/layout";

const SUN: [number, number, number] = [60, 80, -40];

/**
 * Local lighting rig — no remote HDRI. A Lightformer-built environment provides
 * image-based fill + glass/metal reflections, a single shadow-casting sun gives
 * crisp grounding, and the layout's accent point lights pool warm/cool light
 * into each room. ContactShadows softly grounds furniture on the interior floor.
 *
 * Perf: accent pools are storey-culled (only the player's level mounts its
 * lights), so the forward renderer shades ≤8 points + 2 spots per frame.
 * Desktop gate (see WorldCanvas CANVAS_QUALITY): 2k shadows + streak
 * Lightformer; coarse/reduced-motion keeps the cheap 1k path.
 */
export function OfficeLighting({
  level = 1,
  highQuality = false,
}: {
  level?: 1 | 2;
  highQuality?: boolean;
}) {
  const { minX, maxX, minZ, maxZ } = INTERIOR;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  // Tighter ortho centered on the interior: ~140m → ~90m span keeps texel
  // density high enough for desk/trim shadows without a 4k map.
  const SHADOW_SPAN = highQuality ? 45 : 70;

  return (
    <>
      {/* Per-level fog: thin indoors so the far wall stays saturated, thicker
          outside for courtyard/skyline depth. */}
      <fogExp2
        attach="fog"
        args={level === 2 ? ["#d4dce6", 0.0012] : ["#cdd8e3", 0.0016]}
      />

      {/* Baked-once environment (IBL fill + reflections), no network fetch */}
      <Environment resolution={highQuality ? 256 : 192} frames={1}>
        <color attach="background" args={["#0a0d12"]} />
        {/* Big sky panel */}
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#eaf2ff"
          position={[0, 20, 0]}
          scale={[40, 40, 1]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        {/* Warm key from the south-east */}
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#fff2dc"
          position={[30, 12, 30]}
          scale={[18, 12, 1]}
          rotation={[0, -Math.PI / 4, 0]}
        />
        {/* Cool rim from the north */}
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#cfe0ff"
          position={[0, 10, -40]}
          scale={[40, 12, 1]}
        />
        {/* Side fills */}
        <Lightformer
          form="rect"
          intensity={1.0}
          color="#ffffff"
          position={[-40, 10, 0]}
          scale={[20, 12, 1]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.0}
          color="#ffffff"
          position={[40, 10, 0]}
          scale={[20, 12, 1]}
          rotation={[0, -Math.PI / 2, 0]}
        />
        {/* Narrow streak — chrome/mullion highlight only, desktop path */}
        {highQuality && (
          <Lightformer
            form="rect"
            intensity={4}
            color="#ffffff"
            position={[0, 14, 10]}
            scale={[2, 12, 1]}
            rotation={[0, 0, 0]}
          />
        )}
      </Environment>

      {/* Global fills — pulled down so plaster keeps contrast under ACES */}
      <ambientLight intensity={0.18} />
      <hemisphereLight args={["#bcd3ff", "#2c2820", 0.4]} />

      {/* Sun — the only shadow caster. Desktop: 2k over ±45m; cheap: 1k ±70m */}
      <directionalLight
        position={SUN}
        intensity={2.4}
        color="#fff4e2"
        castShadow
        shadow-mapSize={highQuality ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.02}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[
            -SHADOW_SPAN,
            SHADOW_SPAN,
            SHADOW_SPAN,
            -SHADOW_SPAN,
            0.5,
            220,
          ]}
        />
      </directionalLight>

      {/* Room accent pools (no shadows — kept cheap), current storey only */}
      {(level === 2 ? ACCENT_LIGHTS_L2 : ACCENT_LIGHTS).map((l, i) => (
        <pointLight
          key={i}
          position={l.position}
          color={l.color}
          intensity={l.intensity}
          distance={l.distance}
          decay={2}
        />
      ))}

      {/* Two hero spots reuse existing fixture positions: lobby pendant
          wash and chill-screen glow. No shadows — pools only. */}
      <spotLight
        position={[0, 7.6, 17]}
        angle={0.75}
        penumbra={0.9}
        intensity={55}
        distance={22}
        decay={2}
        color="#ffe9c4"
      />
      <spotLight
        position={[-14, 3.4, -18.6]}
        angle={0.6}
        penumbra={1}
        intensity={30}
        distance={14}
        decay={2}
        color="#f9a8d4"
      />

      {/* Soft contact grounding across the interior floor. Desktop follows
          every frame so moving avatars stay grounded; cheap path bakes once. */}
      <ContactShadows
        position={[cx, 0.02, cz]}
        scale={Math.max(maxX - minX, maxZ - minZ) + 6}
        resolution={256}
        frames={highQuality ? Infinity : 1}
        far={3.2}
        blur={1.6}
        opacity={0.48}
        color="#1a1712"
      />
    </>
  );
}
