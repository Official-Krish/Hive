import { useMemo, useRef } from "react";
import { Instances, Instance } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { M, floorFor } from "./materials";
import {
  DESKS,
  L2_DESKS,
  POD_DESKS,
  PODS,
  MEZZ,
  DOOR,
  L2_Y,
  WHITEBOARDS,
  INTERIOR,
} from "./layout";

/** Deterministic 0..1 hash — same input, same clutter, every reload. */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Kit desk-top height (see InstancedFurniture DESK_TOP_Y = 0.768). */
const DESK_TOP = 0.768;
/** Bespoke exec-desk top (see Level2 ExecDesk: 0.74 + 0.04). */
const EXEC_TOP = 0.78;

// ---------------------------------------------------------------------------
// Sun shafts + dust — the lobby is triple-height under a glazed lantern, so
// golden-hour sun rakes through it. Three broad additive blades angled along
// the sun direction + a warm pool on the stone sell the volume. Dust motes
// drift inside the blades (one Points draw, CPU drift, zero shadow cost).
// ---------------------------------------------------------------------------

function LobbyLightShafts() {
  // Blades sit off the entrance walkway (x=0 is the walking axis — a plane
  // there flashes full-screen when the camera crosses it), tilted along the
  // sun direction. Low opacity: presence, not fog.
  return (
    <group name="ultra-shafts">
      {[-16, -7, 13].map((x, i) => (
        <mesh
          key={i}
          position={[x, 4.6, 17.5]}
          rotation={[0.28, 0.1 * (i - 1), 0.42]}
          renderOrder={40}
        >
          <planeGeometry args={[5.5 - (i % 2), 11]} />
          <meshBasicMaterial
            color="#ffedcb"
            transparent
            opacity={0.045 + (i === 1 ? 0.02 : 0)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.FrontSide}
            fog={false}
          />
        </mesh>
      ))}
      {/* warm pool where the shafts land on the lobby stone */}
      <mesh position={[2, 0.025, 17.5]} rotation={[-Math.PI / 2, 0, -0.2]}>
        <planeGeometry args={[22, 7]} />
        <meshBasicMaterial
          color="#ffe9c2"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

/** Soft round dot sprite — PointsMaterial without a map renders squares,
 *  which read as glitchy artifacts floating in the lobby. */
function dotSprite(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const el = document.createElement("canvas");
  el.width = el.height = 64;
  const ctx = el.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,244,221,1)");
  g.addColorStop(0.5, "rgba(255,244,221,0.4)");
  g.addColorStop(1, "rgba(255,244,221,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function DustMotes({ count = 150 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const sprite = useMemo(() => dotSprite(), []);
  const { base, seed } = useMemo(() => {
    const base = new Float32Array(count * 3);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      // lobby + atrium volume, kept off the entrance axis: |x| 5..30
      const side = i % 2 === 0 ? -1 : 1;
      base[i * 3] = side * (5 + hash(i, 1) * 25);
      base[i * 3 + 1] = 0.3 + hash(i, 2) * 7.2;
      base[i * 3 + 2] = 12 + hash(i, 3) * 10;
      seed[i * 2] = hash(i, 4) * Math.PI * 2;
      seed[i * 2 + 1] = 0.3 + hash(i, 5) * 0.9;
    }
    return { base, seed };
  }, [count]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    return g;
  }, [base]);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame(({ clock }) => {
    const pts = ref.current;
    if (!pts || reduced) return;
    const t = clock.elapsedTime;
    const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const s = seed[i * 2] ?? 0;
      const sp = seed[i * 2 + 1] ?? 1;
      arr[i * 3] = (base[i * 3] ?? 0) + Math.sin(t * 0.12 * sp + s) * 0.9;
      arr[i * 3 + 1] =
        (base[i * 3 + 1] ?? 0) + Math.sin(t * 0.18 * sp + s * 2) * 0.45;
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geom} renderOrder={41} frustumCulled={false}>
      <pointsMaterial
        color="#fff4dd"
        size={0.09}
        map={sprite ?? undefined}
        transparent
        opacity={0.5}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Desk dressing — every desk from layout gets deterministic lived-in clutter:
// a mug (side), a notebook (other side), an occasional succulent (back
// corner) and an under-desk PC tower with a status LED. All sit on / under
// the desk tops the player already collides with, so no new colliders.
// ---------------------------------------------------------------------------

interface DeskSample {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

function allDesks(): {
  l1: DeskSample[];
  l2: DeskSample[];
  exec: DeskSample[];
} {
  const l1 = DESKS.map((d) => ({
    x: d.position[0],
    y: d.position[1],
    z: d.position[2],
    yaw: d.rotation ? d.rotation[1] : 0,
  }));
  const l2 = L2_DESKS.map((d) => ({
    x: d.position[0],
    y: d.position[1],
    z: d.position[2],
    yaw: d.rotation ? d.rotation[1] : 0,
  }));
  const exec = POD_DESKS.map((d) => ({
    x: d.position[0],
    y: d.position[1],
    z: d.position[2],
    yaw: d.rotation ? d.rotation[1] : 0,
  }));
  return { l1, l2, exec };
}

/** Local (lx, lz) on the desk top → world, for yaw ∈ {0, PI} rows. */
function onTop(
  d: DeskSample,
  lx: number,
  lz: number,
  top: number,
): [number, number, number] {
  const flip = Math.abs(Math.abs(d.yaw) - Math.PI) < 0.1 ? -1 : 1;
  return [d.x + lx * flip, d.y + top, d.z + lz * flip];
}

const MUG_COLORS = [
  "#b3402e",
  "#2f6f6a",
  "#3b5bdb",
  "#e8eaf0",
  "#d9a441",
] as const;
const NOTE_COLORS = ["#e8e4d8", "#d7e3f4", "#f3d9c8", "#d9e8d4"] as const;

function DeskClutter() {
  const { mugs, notes, plants, towers, leds } = useMemo(() => {
    const { l1, l2, exec } = allDesks();
    const mugs: { p: [number, number, number]; c: string }[] = [];
    const notes: { p: [number, number, number]; r: number; c: string }[] = [];
    const plants: [number, number, number][] = [];
    const towers: [number, number, number][] = [];
    const leds: [number, number, number][] = [];
    const feed = (d: DeskSample, top: number, i: number, salt: number) => {
      // mug — right side of the keyboard
      if (hash(i, salt + 1) > 0.3) {
        mugs.push({
          p: onTop(d, 0.48, 0.18, top),
          c:
            MUG_COLORS[Math.floor(hash(i, salt + 2) * MUG_COLORS.length)] ??
            "#e8eaf0",
        });
      }
      // notebook — left side, slight yaw
      if (hash(i, salt + 3) > 0.5) {
        notes.push({
          p: onTop(d, -0.42, 0.12, top),
          r: d.yaw + (hash(i, salt + 4) - 0.5) * 0.7,
          c:
            NOTE_COLORS[Math.floor(hash(i, salt + 5) * NOTE_COLORS.length)] ??
            "#e8e4d8",
        });
      }
      // succulent — back corner, occasional
      if (hash(i, salt + 6) > 0.74) {
        plants.push(onTop(d, -0.55, -0.28, top));
      }
      // under-desk tower — half the desks, tucked to the left leg
      if (hash(i, salt + 7) > 0.5) {
        const flip = Math.abs(Math.abs(d.yaw) - Math.PI) < 0.1 ? -1 : 1;
        towers.push([d.x - 0.55 * flip, d.y, d.z - 0.1 * flip]);
        leds.push([
          d.x - 0.55 * flip,
          d.y + 0.32,
          d.z - 0.1 * flip + 0.21 * flip,
        ]);
      }
    };
    l1.forEach((d, i) => feed(d, DESK_TOP, i, 11));
    l2.forEach((d, i) => feed(d, DESK_TOP, i, 101));
    exec.forEach((d, i) => feed(d, EXEC_TOP, i, 201));
    return { mugs, notes, plants, towers, leds };
  }, []);

  return (
    <group name="ultra-desk-clutter">
      {/* mugs */}
      {mugs.length > 0 && (
        <Instances range={mugs.length} limit={mugs.length} castShadow>
          <cylinderGeometry args={[0.045, 0.04, 0.1, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
          {mugs.map((m, i) => (
            <Instance
              key={i}
              position={[m.p[0], m.p[1] + 0.05, m.p[2]]}
              color={m.c}
            />
          ))}
        </Instances>
      )}
      {/* notebooks */}
      {notes.length > 0 && (
        <Instances
          range={notes.length}
          limit={notes.length}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.3, 0.025, 0.22]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
          {notes.map((n, i) => (
            <Instance
              key={i}
              position={[n.p[0], n.p[1] + 0.013, n.p[2]]}
              rotation={[0, n.r, 0]}
              color={n.c}
            />
          ))}
        </Instances>
      )}
      {/* succulent pots + rosettes (two draws) */}
      {plants.length > 0 && (
        <>
          <Instances range={plants.length} limit={plants.length} castShadow>
            <cylinderGeometry args={[0.05, 0.04, 0.08, 10]} />
            <primitive object={M.pot} attach="material" />
            {plants.map((p, i) => (
              <Instance key={i} position={[p[0], p[1] + 0.04, p[2]]} />
            ))}
          </Instances>
          <Instances range={plants.length} limit={plants.length}>
            <icosahedronGeometry args={[0.055, 0]} />
            <primitive object={M.leaf} attach="material" />
            {plants.map((p, i) => (
              <Instance key={i} position={[p[0], p[1] + 0.11, p[2]]} />
            ))}
          </Instances>
        </>
      )}
      {/* under-desk towers + status LEDs */}
      {towers.length > 0 && (
        <>
          <Instances range={towers.length} limit={towers.length} castShadow>
            <boxGeometry args={[0.22, 0.44, 0.42]} />
            <primitive object={M.metalDark} attach="material" />
            {towers.map((p, i) => (
              <Instance key={i} position={[p[0], p[1] + 0.22, p[2]]} />
            ))}
          </Instances>
          <Instances range={leds.length} limit={leds.length}>
            <boxGeometry args={[0.03, 0.015, 0.012]} />
            <primitive object={M.ledGreen} attach="material" />
            {leds.map((p, i) => (
              <Instance key={i} position={p} />
            ))}
          </Instances>
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Wayfinding + wall dressing — EXIT signs above the entrance + every pod
// door (y ≈ 2.6, above head height, zero collision), two analogue wall
// clocks fixed at 10:10, brushed door pulls on each pod door leaf.
// ---------------------------------------------------------------------------

function exitTexture(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const el = document.createElement("canvas");
  el.width = 256;
  el.height = 96;
  const ctx = el.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#0d2818";
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = "#34d399";
  ctx.font = "700 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXIT", 128, 52);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ExitSigns() {
  const face = useMemo(() => exitTexture(), []);
  const signs = useMemo(() => {
    const out: { p: [number, number, number]; ry: number }[] = [];
    // main entrance (inside face, above the door gap)
    out.push({
      p: [(DOOR.x0 + DOOR.x1) / 2, 3.35, INTERIOR.maxZ - 0.45],
      ry: Math.PI,
    });
    for (const pod of PODS) {
      const [x0, x1, z0, z1] = pod.rect;
      const base = pod.level === 2 ? L2_Y : 0;
      const { side, at } = pod.door;
      if (side === "n")
        out.push({ p: [at, base + 2.62, z0 - 0.12], ry: Math.PI });
      else if (side === "s")
        out.push({ p: [at, base + 2.62, z1 + 0.12], ry: 0 });
      else if (side === "w")
        out.push({ p: [x0 - 0.12, base + 2.62, at], ry: -Math.PI / 2 });
      else out.push({ p: [x1 + 0.12, base + 2.62, at], ry: Math.PI / 2 });
    }
    return out;
  }, []);
  const faceMat = useMemo(
    () =>
      face
        ? new THREE.MeshBasicMaterial({ map: face, toneMapped: false })
        : null,
    [face],
  );
  if (!face || !faceMat) return null;
  // Both box + lit face are instanced: 2 draws for all 13 signs.
  const faces = signs.map((s) => {
    const fx = Math.sin(s.ry);
    const fz = Math.cos(s.ry);
    return {
      p: [s.p[0] + fx * 0.048, s.p[1], s.p[2] + fz * 0.048] as [
        number,
        number,
        number,
      ],
      ry: s.ry,
    };
  });
  return (
    <group name="ultra-exit">
      <Instances range={signs.length} limit={signs.length}>
        <boxGeometry args={[0.62, 0.24, 0.09]} />
        <primitive object={M.blackAnodized} attach="material" />
        {signs.map((s, i) => (
          <Instance key={i} position={s.p} rotation={[0, s.ry, 0]} />
        ))}
      </Instances>
      <Instances range={faces.length} limit={faces.length}>
        <planeGeometry args={[0.56, 0.2]} />
        <primitive object={faceMat} attach="material" />
        {faces.map((f, i) => (
          <Instance key={i} position={f.p} rotation={[0, f.ry, 0]} />
        ))}
      </Instances>
    </group>
  );
}

function WallClock({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 28]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.028]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.25, 28]} />
        <meshStandardMaterial color="#f6f4ee" roughness={0.4} />
      </mesh>
      {/* 10:10 hands — the showroom default */}
      <mesh position={[0.055, 0.075, 0.034]} rotation={[0, 0, -2.1]}>
        <boxGeometry args={[0.02, 0.15, 0.008]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[-0.055, 0.075, 0.034]} rotation={[0, 0, 2.1]}>
        <boxGeometry args={[0.02, 0.15, 0.008]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.038]}>
        <cylinderGeometry args={[0.018, 0.018, 0.012, 10]} />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
    </group>
  );
}

/** Pod doorways are open gaps (no leaves) — pulls would float mid-air.
 *  Instead: brushed kick-plates on the jamb posts flanking each opening,
 *  which always have real geometry behind them. */
function DoorKickPlates() {
  const plates = useMemo(() => {
    const out: { p: [number, number, number]; ry: number }[] = [];
    for (const pod of PODS) {
      const [x0, x1, z0, z1] = pod.rect;
      const base = pod.level === 2 ? L2_Y : 0;
      const { side, at, width } = pod.door;
      const a = at - width / 2;
      const b = at + width / 2;
      if (side === "n" || side === "s") {
        const z = side === "n" ? z0 : z1;
        const fz = side === "n" ? -0.065 : 0.065;
        out.push({ p: [a, base + 0.35, z + fz], ry: 0 });
        out.push({ p: [b, base + 0.35, z + fz], ry: 0 });
      } else {
        const x = side === "w" ? x0 : x1;
        const fx = side === "w" ? -0.065 : 0.065;
        out.push({ p: [x + fx, base + 0.35, a], ry: Math.PI / 2 });
        out.push({ p: [x + fx, base + 0.35, b], ry: Math.PI / 2 });
      }
    }
    return out;
  }, []);
  return (
    <Instances range={plates.length} limit={plates.length}>
      <boxGeometry args={[0.14, 0.5, 0.02]} />
      <primitive object={M.metalBrushed} attach="material" />
      {plates.map((p, i) => (
        <Instance key={i} position={p.p} rotation={[0, p.ry, 0]} />
      ))}
    </Instances>
  );
}

// ---------------------------------------------------------------------------
// Floor dressing — entrance mat + grand lobby rug (border + field), so the
// arrival axis feels dressed rather than bare stone.
// ---------------------------------------------------------------------------

function FloorDressing() {
  return (
    <group name="ultra-floor">
      {/* entrance mat */}
      <mesh
        position={[(DOOR.x0 + DOOR.x1) / 2, 0.022, INTERIOR.maxZ - 1.6]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[6.4, 2.0]} />
        <meshStandardMaterial color="#2b3138" roughness={0.98} />
      </mesh>
      <mesh
        position={[(DOOR.x0 + DOOR.x1) / 2, 0.024, INTERIOR.maxZ - 1.6]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[6.0, 1.6]} />
        <meshStandardMaterial color="#3a424c" roughness={0.98} />
      </mesh>
      {/* grand lobby rug: walnut border + tiled carpet field. The field
          uses floorFor so the weave tiles at a real-world scale — a shared
          1×1 material stretched over 19 m smears into a glitchy blur. */}
      <mesh
        position={[0, 0.02, 17.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 6.4]} />
        <primitive object={M.walnut} attach="material" />
      </mesh>
      <mesh
        position={[0, 0.026, 17.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[19.2, 5.6]} />
        <primitive
          object={floorFor("workspace", 19.2, 5.6)}
          attach="material"
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Industrial dressing — cable tray + coloured runs above the AI-lab aisle,
// whiteboard marker trays, hanging pothos along the mezzanine edge, coffee
// steam over the cafeteria machine.
// ---------------------------------------------------------------------------

function CableTray() {
  const hangers = useMemo(() => [-9, -3, 3, 9], []);
  return (
    <group name="ultra-tray" position={[0, 3.28, -14.6]}>
      <mesh castShadow>
        <boxGeometry args={[21, 0.07, 0.5]} />
        <primitive object={M.metalDark} attach="material" />
      </mesh>
      {/* threaded rods up to the ceiling slab — the tray never floats */}
      <Instances range={hangers.length} limit={hangers.length}>
        <cylinderGeometry args={[0.015, 0.015, 0.32, 6]} />
        <primitive object={M.metalDark} attach="material" />
        {hangers.map((x) => (
          <Instance key={x} position={[x, 0.2, 0]} />
        ))}
      </Instances>
      {(
        [
          [-0.14, "#f43f5e"],
          [0, "#38bdf8"],
          [0.14, "#fbbf24"],
        ] as [number, string][]
      ).map(([dz, c]) => (
        <mesh key={c} position={[0, 0.06, dz]}>
          <boxGeometry args={[21, 0.045, 0.07]} />
          <meshStandardMaterial color={c} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function WhiteboardTrays() {
  // Markers batched by colour + erasers in one draw: 4 draws for 4 boards.
  const { markers, erasers } = useMemo(() => {
    const markers: { p: [number, number, number]; ry: number; c: 0 | 1 | 2 }[] =
      [];
    const erasers: { p: [number, number, number]; ry: number }[] = [];
    WHITEBOARDS.forEach((w) => {
      const yaw = w.rotation[1] ?? 0;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const bx = w.position[0] + fx * 0.1;
      const by = w.position[1] - w.size[1] / 2 - 0.09;
      const bz = w.position[2] + fz * 0.1;
      const right: [number, number] = [Math.cos(yaw), -Math.sin(yaw)];
      ([-0.5, -0.32, -0.14] as const).forEach((dx, k) => {
        markers.push({
          p: [bx + right[0] * dx, by + 0.03, bz + right[1] * dx],
          ry: yaw,
          c: k as 0 | 1 | 2,
        });
      });
      erasers.push({
        p: [bx + right[0] * 0.45, by + 0.035, bz + right[1] * 0.45],
        ry: yaw,
      });
    });
    return { markers, erasers };
  }, []);
  const markerCols = ["#1e293b", "#b3402e", "#2456c8"] as const;
  return (
    <group name="ultra-trays">
      {markerCols.map((c, ci) => {
        const items = markers.filter((m) => m.c === ci);
        if (items.length === 0) return null;
        return (
          <Instances key={c} range={items.length} limit={items.length}>
            <cylinderGeometry args={[0.016, 0.016, 0.13, 8]} />
            <meshStandardMaterial color={c} roughness={0.5} />
            {items.map((m, i) => (
              <Instance
                key={i}
                position={m.p}
                rotation={[0, m.ry, Math.PI / 2]}
              />
            ))}
          </Instances>
        );
      })}
      <Instances range={erasers.length} limit={erasers.length}>
        <boxGeometry args={[0.13, 0.05, 0.06]} />
        <primitive object={M.felt} attach="material" />
        {erasers.map((e, i) => (
          <Instance key={i} position={e.p} rotation={[0, e.ry, 0]} />
        ))}
      </Instances>
    </group>
  );
}

/** Mezzanine planter row — pots sit ON the L2 deck behind the balustrade
 *  (never floating mid-air), softening the atrium edge from below. */
function HangingPlants() {
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 6; i++) {
      out.push([-25 + i * 10, L2_Y, MEZZ.z1 - 0.75]);
    }
    return out;
  }, []);
  return (
    <group name="ultra-hanging">
      <Instances
        range={spots.length}
        limit={spots.length}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.22, 0.17, 0.34, 12]} />
        <primitive object={M.pot} attach="material" />
        {spots.map((p, i) => (
          <Instance key={i} position={[p[0], p[1] + 0.17, p[2]]} />
        ))}
      </Instances>
      <Instances range={spots.length} limit={spots.length} castShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
        <primitive object={M.leaf} attach="material" />
        {spots.map((p, i) => (
          <Instance
            key={i}
            position={[p[0], p[1] + 0.62, p[2]]}
            scale={[1, 1.2, 1]}
          />
        ))}
      </Instances>
      <Instances range={spots.length} limit={spots.length}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <primitive object={M.leafDark} attach="material" />
        {spots.map((p, i) => (
          <Instance
            key={i}
            position={[p[0] + (i % 2 === 0 ? 0.2 : -0.2), p[1] + 0.44, p[2]]}
            scale={[1, 1.4, 1]}
          />
        ))}
      </Instances>
    </group>
  );
}

function CoffeeSteam() {
  const group = useRef<THREE.Group>(null);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || reduced) return;
    const t = clock.elapsedTime;
    g.children.forEach((c, i) => {
      const k = (((t * 0.35 + i / 3) % 1) + 1) % 1;
      c.position.y = 1.62 + k * 0.75;
      c.position.x = 27.2 + Math.sin((k + i) * 5) * 0.06;
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = 0.22 * (1 - k);
      const s = 0.1 + k * 0.22;
      c.scale.set(s, s, s);
    });
  });
  return (
    <group ref={group} name="ultra-steam" position={[0, 0, 5.2]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[27.2, 1.62, 0]}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.2}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Mount point — everything here is additive dressing. No layout, collider,
// interactable or room change: delete this group and the world plays
// identically, only less dressed.
// ---------------------------------------------------------------------------

export function UltraRealism({ simple = false }: { simple?: boolean }) {
  return (
    <group name="ultra-realism">
      {/* Volumetrics + steam rest in simple view; all static dressing stays. */}
      {!simple && <LobbyLightShafts />}
      {!simple && <DustMotes />}
      <DeskClutter />
      <ExitSigns />
      <WallClock position={[10.5, 4.35, 17.86]} rotation={[0, Math.PI, 0]} />
      <WallClock position={[22, 2.6, 2.16]} rotation={[0, 0, 0]} />
      <DoorKickPlates />
      <FloorDressing />
      <CableTray />
      <WhiteboardTrays />
      <HangingPlants />
      {!simple && <CoffeeSteam />}
    </group>
  );
}
