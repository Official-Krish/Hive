import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { INTERIOR, ACCENT_LIGHTS, ACCENT_LIGHTS_L2 } from "../office/layout";

// Blue-hour sun: low in the west-southwest for long facade shadows and a
// warm rake through the lobby glass (matches the reference dusk render and
// the Sky disc in Courtyard — keep the two constants identical).
const SUN: [number, number, number] = [72, 32, -28];

/**
 * Cinematic local lighting rig — no remote HDRI. A Lightformer-built
 * environment provides image-based fill + glass/metal reflections, a warm
 * shadow-casting sun gives crisp grounding with a cool sky bounce, and the
 * layout's accent point lights pool warm/cool light into each room.
 * ContactShadows softly grounds furniture on the interior floor.
 *
 * Ultra-real grade: golden-hour sun (warm key + cool bounce), lifted
 * environment for chrome/glass response, tighter shadow frustum on desktop,
 * and gently boosted accent pools so every room has its own colour
 * temperature — engineering cool-neutral, lounge/cafeteria warm, AI Lab
 * cyan, lobby golden.
 *
 * Perf: accent pools are storey-culled (only the player's level mounts its
 * lights), so the forward renderer shades ≤8 points + 2 spots + 1 fill per
 * frame. Desktop gate (see WorldCanvas): 2k shadows + streak Lightformer;
 * coarse/reduced-motion keeps the cheap 1k path.
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
          outside for courtyard/skyline depth. Blue-hour grade to match the
          dusk sky — the horizon melts instead of glowing white. */}
      <fogExp2
        attach="fog"
        args={level === 2 ? ["#c3ccdf", 0.0011] : ["#bfc9dd", 0.0015]}
      />

      {/* Baked-once environment (IBL fill + reflections), no network fetch */}
      <Environment resolution={highQuality ? 256 : 192} frames={1}>
        <color attach="background" args={["#0a0d12"]} />
        {/* Big sky panel */}
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#e8f1ff"
          position={[0, 20, 0]}
          scale={[40, 40, 1]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        {/* Warm golden key from the south-east */}
        <Lightformer
          form="rect"
          intensity={3.0}
          color="#ffedd2"
          position={[30, 12, 30]}
          scale={[18, 12, 1]}
          rotation={[0, -Math.PI / 4, 0]}
        />
        {/* Cool rim from the north */}
        <Lightformer
          form="rect"
          intensity={1.7}
          color="#c8ddff"
          position={[0, 10, -40]}
          scale={[40, 12, 1]}
        />
        {/* Side fills */}
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#fff6ea"
          position={[-40, 10, 0]}
          scale={[20, 12, 1]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#eaf2ff"
          position={[40, 10, 0]}
          scale={[20, 12, 1]}
          rotation={[0, -Math.PI / 2, 0]}
        />
        {/* Low warm bounce off the timber floors */}
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#ffd9ae"
          position={[0, 2, 0]}
          scale={[50, 10, 1]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        {/* Narrow streak — chrome/mullion highlight only, desktop path */}
        {highQuality && (
          <Lightformer
            form="rect"
            intensity={5}
            color="#ffffff"
            position={[0, 14, 10]}
            scale={[2, 12, 1]}
            rotation={[0, 0, 0]}
          />
        )}
      </Environment>

      {/* Global fills — lifted slightly so the cinematic sun never crushes shadows */}
      <ambientLight intensity={0.22} />
      <hemisphereLight args={["#c3d6f5", "#33291d", 0.5]} />

      {/* Sun — the only shadow caster. Desktop: 2k over ±45m; cheap: 1k ±70m.
          Golden-hour warmth with a touch more punch for long lobby shadows. */}
      <directionalLight
        position={SUN}
        intensity={2.9}
        color="#ffedD6"
        castShadow
        shadow-mapSize={highQuality ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.00022}
        shadow-normalBias={0.025}
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
      {/* Cool sky bounce — no shadows, lifts the north faces of desks/racks */}
      <directionalLight
        position={[-40, 30, -60]}
        intensity={0.55}
        color="#bcd4ff"
      />

      {/* Room accent pools (no shadows — kept cheap), current storey only.
          Boosted ~25% for the cinematic grade so each room holds its hue. */}
      {(level === 2 ? ACCENT_LIGHTS_L2 : ACCENT_LIGHTS).map((l, i) => (
        <pointLight
          key={i}
          position={l.position}
          color={l.color}
          intensity={l.intensity * 1.28}
          distance={l.distance * 1.1}
          decay={2}
        />
      ))}

      {/* Two hero spots reuse existing fixture positions: lobby pendant
          wash and chill-screen glow. No shadows — pools only. */}
      <spotLight
        position={[0, 7.6, 17]}
        angle={0.75}
        penumbra={0.9}
        intensity={75}
        distance={24}
        decay={2}
        color="#ffe3b8"
      />
      <spotLight
        position={[-14, 3.4, -18.6]}
        angle={0.6}
        penumbra={1}
        intensity={38}
        distance={15}
        decay={2}
        color="#f9a8d4"
      />
      {/* Warm entrance kiss — daylight spilling through the glass facade */}
      <spotLight
        position={[0, 5.5, 26]}
        angle={0.7}
        penumbra={1}
        intensity={40}
        distance={20}
        decay={2}
        color="#fff1d6"
      />

      {/* Soft contact grounding across the interior floor, baked once.
          frames={Infinity} re-renders the whole scene every frame for a blob
          nobody looks at — the live sun shadows already ground the avatars. */}
      <ContactShadows
        position={[cx, 0.02, cz]}
        scale={Math.max(maxX - minX, maxZ - minZ) + 6}
        resolution={256}
        frames={1}
        far={3.4}
        blur={2.0}
        opacity={0.52}
        color="#14110c"
      />
    </>
  );
}
