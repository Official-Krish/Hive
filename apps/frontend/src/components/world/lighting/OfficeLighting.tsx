import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { INTERIOR, ACCENT_LIGHTS } from "../office/layout";

const SUN: [number, number, number] = [60, 80, -40];

/**
 * Local lighting rig — no remote HDRI. A Lightformer-built environment provides
 * image-based fill + glass/metal reflections, a single shadow-casting sun gives
 * crisp grounding, and the layout's accent point lights pool warm/cool light
 * into each room. ContactShadows softly grounds furniture on the interior floor.
 */
export function OfficeLighting() {
  const { minX, maxX, minZ, maxZ } = INTERIOR;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  return (
    <>
      {/* Atmospheric depth for the courtyard / skyline */}
      <fogExp2 attach="fog" args={["#cdd8e3", 0.0055]} />

      {/* Baked-once environment (IBL fill + reflections), no network fetch */}
      <Environment resolution={256} frames={1}>
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
      </Environment>

      {/* Global fills */}
      <ambientLight intensity={0.28} />
      <hemisphereLight args={["#bcd3ff", "#2c2820", 0.55]} />

      {/* Sun — the only shadow caster */}
      <directionalLight
        position={SUN}
        intensity={2.6}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-70, 70, 70, -70, 0.5, 220]}
        />
      </directionalLight>

      {/* Room accent pools (no shadows — kept cheap) */}
      {ACCENT_LIGHTS.map((l, i) => (
        <pointLight
          key={i}
          position={l.position}
          color={l.color}
          intensity={l.intensity}
          distance={l.distance}
          decay={2}
        />
      ))}

      {/* Soft contact grounding across the interior floor */}
      <ContactShadows
        position={[cx, 0.02, cz]}
        scale={Math.max(maxX - minX, maxZ - minZ) + 6}
        resolution={1024}
        far={3.2}
        blur={2.6}
        opacity={0.5}
        color="#1a1712"
      />
    </>
  );
}
