import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { INTERACTABLES, type Interactable } from "./interactions";

/* ─────────────────────────────────────────────────────────────
   MARKERS — soft floor rings + icon billboards over usable things.
   Driven by the existing INTERACTABLES registry (no new data).
   Desk monitors are skipped — sixty rings would be noise; they keep
   the HUD prompt + target highlight only.
   ───────────────────────────────────────────────────────────── */

const RING_COLOR: Record<Interactable["icon"], string> = {
  coffee: "#fb923c",
  water: "#38bdf8",
  monitor: "#818cf8",
  board: "#e8eaf0",
  ci: "#34d399",
  chill: "#f472b6",
  arcade: "#a78bfa",
};

const RANGE = 8;

function drawGlyph(ctx: CanvasRenderingContext2D, icon: Interactable["icon"]) {
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (icon) {
    case "coffee": // cup + handle + saucer
      ctx.strokeRect(34, 42, 52, 44);
      ctx.beginPath();
      ctx.arc(90, 64, 14, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(28, 100);
      ctx.lineTo(100, 100);
      ctx.stroke();
      break;
    case "water": // droplet
      ctx.beginPath();
      ctx.moveTo(64, 18);
      ctx.bezierCurveTo(88, 58, 96, 74, 96, 88);
      ctx.bezierCurveTo(96, 106, 80, 114, 64, 114);
      ctx.bezierCurveTo(48, 114, 32, 106, 32, 88);
      ctx.bezierCurveTo(32, 74, 40, 58, 64, 18);
      ctx.stroke();
      break;
    case "monitor": // screen + stand
      ctx.strokeRect(28, 34, 72, 48);
      ctx.beginPath();
      ctx.moveTo(64, 82);
      ctx.lineTo(64, 100);
      ctx.moveTo(48, 100);
      ctx.lineTo(80, 100);
      ctx.stroke();
      break;
    case "board": // board + writing lines
      ctx.strokeRect(24, 30, 80, 58);
      ctx.beginPath();
      ctx.moveTo(38, 50);
      ctx.lineTo(90, 50);
      ctx.moveTo(38, 66);
      ctx.lineTo(72, 66);
      ctx.stroke();
      break;
    case "ci": // gauge + needle
      ctx.beginPath();
      ctx.arc(64, 78, 34, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(64, 78);
      ctx.lineTo(88, 52);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(64, 78, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "chill": // play
      ctx.beginPath();
      ctx.moveTo(50, 34);
      ctx.lineTo(92, 64);
      ctx.lineTo(50, 94);
      ctx.closePath();
      ctx.stroke();
      break;
    case "arcade": // joystick
      ctx.beginPath();
      ctx.arc(64, 34, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(64, 46);
      ctx.lineTo(64, 88);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(38, 88);
      ctx.quadraticCurveTo(64, 80, 90, 88);
      ctx.stroke();
      break;
  }
}

const iconCache = new Map<string, THREE.CanvasTexture>();

function iconTexture(icon: Interactable["icon"]): THREE.CanvasTexture {
  const hit = iconCache.get(icon);
  if (hit) return hit;
  const el = document.createElement("canvas");
  el.width = 128;
  el.height = 128;
  drawGlyph(el.getContext("2d")!, icon);
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  iconCache.set(icon, tex);
  return tex;
}

function MarkerSpot({
  spot,
  playerPos,
  targeted,
  reducedMotion,
}: {
  spot: Interactable;
  playerPos: [number, number, number];
  targeted: boolean;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const tex = useMemo(() => iconTexture(spot.icon), [spot.icon]);
  const color = RING_COLOR[spot.icon] ?? "#e8eaf0";
  const phase = useMemo(
    () => (spot.x * 13.7 + spot.z * 7.3) % (Math.PI * 2),
    [spot.x, spot.z],
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const dx = playerPos[0] - spot.x;
    const dz = playerPos[2] - spot.z;
    const inRange = dx * dx + dz * dz < RANGE * RANGE;
    g.visible = inRange;
    if (!inRange) return;
    const pulse = reducedMotion
      ? 1
      : 1 + 0.07 * Math.sin(clock.elapsedTime * 2.4 + phase);
    const s = (targeted ? 1.28 : 1) * pulse;
    g.scale.setScalar(s);
  });

  return (
    <group ref={group} position={[spot.x, spot.y, spot.z]} visible={false}>
      {/* floor ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.52, 0.64, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={targeted ? 1 : 0.8}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      {/* floating icon */}
      <Billboard position={[0, 1.7, 0]}>
        <mesh>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial
            map={tex}
            transparent
            toneMapped={false}
            depthWrite={false}
            opacity={targeted ? 1 : 0.9}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

export function Markers({
  playerPos,
  nearId,
}: {
  playerPos: [number, number, number];
  nearId: string | null;
}) {
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const spots = useMemo(
    () => INTERACTABLES.filter((s) => s.kind !== "monitor"),
    [],
  );
  return (
    <group>
      {spots.map((s) => (
        <MarkerSpot
          key={s.id}
          spot={s}
          playerPos={playerPos}
          targeted={nearId === s.id}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
