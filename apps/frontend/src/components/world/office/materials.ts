// ============================================================================
// OFFICE WORLD MATERIALS — shared singletons + procedural textures
// ----------------------------------------------------------------------------
// Everything here is generated locally (canvas textures, no network fetches).
// Materials are module-level singletons so every mesh/instance shares the same
// GPU material and texture source (few state changes, low VRAM).
// ============================================================================

import * as THREE from "three";

const HAS_DOM = typeof document !== "undefined";

// Deterministic PRNG so textures are identical every reload.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Non-empty colour palette — the first entry doubles as the fallback. */
type Palette = readonly [string, ...string[]];

/** Wrapping palette read; keeps `noUncheckedIndexedAccess` happy without a cast. */
const swatch = (p: Palette, i: number) => p[i % p.length] ?? p[0];

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  size: number,
  rnd: () => number,
) => void;

function tex(
  size: number,
  repeat: [number, number],
  draw: DrawFn,
  opts: { srgb?: boolean; seed?: number } = {},
): THREE.Texture | null {
  if (!HAS_DOM) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx, size, lcg(opts.seed ?? 1));
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Texture recipes --------------------------------------------------------

/** Fine monochrome grain — reused as a roughness break-up map. */
const grain = tex(
  256,
  [6, 6],
  (ctx, s, rnd) => {
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 150 + Math.floor((rnd() - 0.5) * 18);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  },
  { srgb: false, seed: 7 },
);

/** Large-format stone tile with thin grout + soft veining. One tile per UV. */
const tileTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#e6e2d8";
    ctx.fillRect(0, 0, s, s);
    // veining
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(168,160,146,${0.05 + rnd() * 0.1})`;
      ctx.lineWidth = 0.6 + rnd() * 2.2;
      ctx.beginPath();
      let x = rnd() * s;
      let y = rnd() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (rnd() - 0.5) * s * 0.5;
        y += (rnd() - 0.5) * s * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // speckle
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(120,114,102,${rnd() * 0.14})`;
      ctx.fillRect(rnd() * s, rnd() * s, 1.4, 1.4);
    }
    // grout
    ctx.strokeStyle = "#b7b1a3";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, s, s);
  },
  { seed: 11 },
);

/** Terrazzo — pale base with coloured chips. */
const terrazzoTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#d5d3cb";
    ctx.fillRect(0, 0, s, s);
    const chips: Palette = [
      "#9aa3ab",
      "#b9a68c",
      "#8f8a80",
      "#c2bdb0",
      "#7d858c",
    ];
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = swatch(chips, Math.floor(rnd() * chips.length));
      ctx.globalAlpha = 0.35 + rnd() * 0.45;
      const r = 1 + rnd() * 3.4;
      ctx.beginPath();
      ctx.ellipse(
        rnd() * s,
        rnd() * s,
        r,
        r * (0.6 + rnd() * 0.6),
        rnd() * 3.14,
        0,
        6.3,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  { seed: 23 },
);

/** Carpet tile — tight woven noise with a faint tile seam. */
const carpetTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#4d5663";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        const v = rnd();
        ctx.fillStyle = `rgba(255,255,255,${v * 0.06})`;
        ctx.fillRect(x, y, 2, 1);
        ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.09})`;
        ctx.fillRect(x, y + 1, 2, 1);
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, s, s);
  },
  { seed: 31 },
);

/** Wood planks — 4 planks per tile, grain lines + seams. */
const plankTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    const rows = 4;
    const h = s / rows;
    for (let r = 0; r < rows; r++) {
      const base = 150 + Math.floor(rnd() * 26);
      ctx.fillStyle = `rgb(${base},${Math.floor(base * 0.72)},${Math.floor(base * 0.48)})`;
      ctx.fillRect(0, r * h, s, h);
      // grain
      for (let i = 0; i < 46; i++) {
        ctx.strokeStyle = `rgba(70,46,26,${0.05 + rnd() * 0.14})`;
        ctx.lineWidth = 0.5 + rnd() * 1.4;
        ctx.beginPath();
        const y = r * h + rnd() * h;
        ctx.moveTo(0, y);
        for (let x = 0; x <= s; x += 32) ctx.lineTo(x, y + (rnd() - 0.5) * 4);
        ctx.stroke();
      }
      // plank seam
      ctx.fillStyle = "rgba(48,32,18,0.55)";
      ctx.fillRect(0, r * h, s, 2);
      // stagger butt joint
      const jx = Math.floor(rnd() * s);
      ctx.fillRect(jx, r * h, 2, h);
    }
  },
  { seed: 43 },
);

/** Dark poured epoxy with a faint control-joint grid. */
const epoxyTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#232b34";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`;
      ctx.fillRect(rnd() * s, rnd() * s, 1.6, 1.6);
    }
    ctx.strokeStyle = "rgba(140,170,190,0.16)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, s, s);
  },
  { seed: 57 },
);

/** Exterior paving slabs — 3x3 slabs per tile. */
const pavingTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#a8a9a1";
    ctx.fillRect(0, 0, s, s);
    const n = 3;
    const c = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 158 + Math.floor(rnd() * 22);
        ctx.fillStyle = `rgb(${v},${v + 1},${v - 6})`;
        ctx.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
        for (let k = 0; k < 130; k++) {
          ctx.fillStyle = `rgba(60,60,58,${rnd() * 0.1})`;
          ctx.fillRect(i * c + rnd() * c, j * c + rnd() * c, 1.6, 1.6);
        }
      }
    }
  },
  { seed: 71 },
);

/** Mown lawn — clumped greens with faint mower stripes. */
const grassTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#4e7c44";
    ctx.fillRect(0, 0, s, s);
    // broad tonal clumps
    for (let i = 0; i < 200; i++) {
      const g = 96 + Math.floor(rnd() * 46);
      ctx.fillStyle = `rgba(${Math.floor(g * 0.55)},${g},${Math.floor(g * 0.46)},0.5)`;
      const r = 8 + rnd() * 42;
      ctx.beginPath();
      ctx.arc(rnd() * s, rnd() * s, r, 0, 6.3);
      ctx.fill();
    }
    // blade speckle
    for (let i = 0; i < 9000; i++) {
      ctx.strokeStyle = `rgba(${40 + rnd() * 60},${90 + rnd() * 70},${40 + rnd() * 40},${0.2 + rnd() * 0.35})`;
      ctx.lineWidth = 1;
      const x = rnd() * s;
      const y = rnd() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 3);
      ctx.stroke();
    }
    // mower stripes
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = `rgba(255,255,255,${b % 2 ? 0.035 : 0})`;
      ctx.fillRect(0, (b * s) / 4, s, s / 4);
    }
  },
  { seed: 91 },
);

/** Asphalt — dark aggregate with hairline cracks. */
const asphaltTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#3b3f45";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 7000; i++) {
      const v = 40 + Math.floor(rnd() * 70);
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 6},${0.25 + rnd() * 0.4})`;
      const r = 0.8 + rnd() * 2.2;
      ctx.fillRect(rnd() * s, rnd() * s, r, r);
    }
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(22,24,28,${0.3 + rnd() * 0.35})`;
      ctx.lineWidth = 0.7 + rnd() * 1.3;
      ctx.beginPath();
      let x = rnd() * s;
      let y = rnd() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        x += (rnd() - 0.5) * 70;
        y += (rnd() - 0.5) * 70;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
  { seed: 103 },
);

/** Broom-finished concrete sidewalk — 2x2 bays with control joints. */
const walkTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#b7b5ac";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = `rgba(${120 + rnd() * 90},${120 + rnd() * 90},${115 + rnd() * 85},${rnd() * 0.22})`;
      ctx.fillRect(rnd() * s, rnd() * s, 1.8, 1.4);
    }
    // broom texture
    for (let y = 0; y < s; y += 3) {
      ctx.strokeStyle = `rgba(255,255,255,${rnd() * 0.05})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y + (rnd() - 0.5) * 2);
      ctx.stroke();
    }
    // control joints
    ctx.strokeStyle = "rgba(96,94,88,0.75)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, s, s);
    ctx.beginPath();
    ctx.moveTo(s / 2, 0);
    ctx.lineTo(s / 2, s);
    ctx.moveTo(0, s / 2);
    ctx.lineTo(s, s / 2);
    ctx.stroke();
  },
  { seed: 117 },
);

/** Acoustic felt — soft directional fibre. */ const feltTex = tex(
  256,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#5c6470";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3000; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${rnd() * 0.05})`;
      ctx.lineWidth = 1;
      const x = rnd() * s;
      const y = rnd() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 6, y + (rnd() - 0.5) * 6);
      ctx.stroke();
    }
  },
  { seed: 83 },
);

/** Lit-window grid for distant towers (used as map + emissiveMap). */
function windowGrid(cols: number, rows: number, seed: number, lit = 0.5) {
  return tex(
    256,
    [1, 1],
    (ctx, s, rnd) => {
      ctx.fillStyle = "#10161f";
      ctx.fillRect(0, 0, s, s);
      const cw = s / cols;
      const rh = s / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const on = rnd() < lit;
          const warm = rnd() < 0.6;
          ctx.fillStyle = on
            ? warm
              ? `rgba(255,226,170,${0.55 + rnd() * 0.45})`
              : `rgba(196,226,255,${0.45 + rnd() * 0.4})`
            : "rgba(26,34,44,0.9)";
          ctx.fillRect(
            c * cw + cw * 0.18,
            r * rh + rh * 0.2,
            cw * 0.64,
            rh * 0.56,
          );
        }
      }
    },
    { seed },
  );
}

/** Procedural dashboard content for wall TVs. */
function screenContent(seed: number, hue: "blue" | "green" | "violet") {
  const palettes: Record<typeof hue, Palette> = {
    blue: ["#38bdf8", "#0ea5e9", "#60a5fa"],
    green: ["#34d399", "#10b981", "#6ee7b7"],
    violet: ["#a78bfa", "#8b5cf6", "#c4b5fd"],
  };
  const accents = palettes[hue];
  const lead = accents[0];
  return tex(
    512,
    [1, 1],
    (ctx, s, rnd) => {
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, s, s);
      // header bar
      ctx.fillStyle = "#131c2b";
      ctx.fillRect(0, 0, s, s * 0.11);
      ctx.fillStyle = lead;
      ctx.fillRect(s * 0.03, s * 0.04, s * 0.16, s * 0.035);
      // line chart
      ctx.strokeStyle = lead;
      ctx.lineWidth = 4;
      ctx.beginPath();
      let y = s * 0.45;
      ctx.moveTo(s * 0.05, y);
      for (let x = s * 0.05; x < s * 0.62; x += s * 0.045) {
        y += (rnd() - 0.55) * s * 0.07;
        y = Math.max(s * 0.2, Math.min(s * 0.5, y));
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      // area fill
      ctx.globalAlpha = 0.18;
      ctx.lineTo(s * 0.62, s * 0.55);
      ctx.lineTo(s * 0.05, s * 0.55);
      ctx.fillStyle = lead;
      ctx.fill();
      ctx.globalAlpha = 1;
      // bars
      for (let i = 0; i < 7; i++) {
        const bh = s * (0.06 + rnd() * 0.22);
        ctx.fillStyle = swatch(accents, i);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(s * 0.05 + i * s * 0.055, s * 0.92 - bh, s * 0.036, bh);
      }
      ctx.globalAlpha = 1;
      // side cards
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#152033";
        ctx.fillRect(s * 0.66, s * 0.16 + i * s * 0.2, s * 0.29, s * 0.16);
        ctx.fillStyle = swatch(accents, i);
        ctx.fillRect(s * 0.68, s * 0.19 + i * s * 0.2, s * 0.1, s * 0.022);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = "rgba(148,163,184,0.45)";
          ctx.fillRect(
            s * 0.68,
            s * 0.24 + i * s * 0.2 + k * s * 0.025,
            s * 0.22 * rnd(),
            s * 0.012,
          );
        }
      }
    },
    { seed },
  );
}

const tvA = screenContent(101, "blue");
const tvB = screenContent(202, "green");
const tvC = screenContent(303, "violet");

// Tower facades — generated once each and reused as both map and emissiveMap.
const gridA = windowGrid(10, 26, 11, 0.42);
const gridB = windowGrid(7, 18, 29, 0.34);
const gridC = windowGrid(14, 34, 47, 0.5);

// ============================================================================
// MATERIALS
// ============================================================================
const rmap = grain ?? undefined;

export const M = {
  // --- Architecture ---------------------------------------------------------
  wall: new THREE.MeshStandardMaterial({
    color: "#efece5",
    roughness: 0.9,
    roughnessMap: rmap,
  }),
  wallWarm: new THREE.MeshStandardMaterial({
    color: "#e4dccd",
    roughness: 0.88,
    roughnessMap: rmap,
  }),
  wallAccent: new THREE.MeshStandardMaterial({
    color: "#d5cfc1",
    roughness: 0.82,
  }),
  featureWall: new THREE.MeshStandardMaterial({
    color: "#222c38",
    roughness: 0.55,
    metalness: 0.18,
  }),
  ceiling: new THREE.MeshStandardMaterial({
    color: "#f3f1ea",
    roughness: 0.96,
    side: THREE.DoubleSide,
  }),
  ceilingPanel: new THREE.MeshStandardMaterial({
    color: "#e8e6df",
    roughness: 0.9,
  }),
  plenum: new THREE.MeshStandardMaterial({ color: "#20242a", roughness: 0.95 }),
  baseboard: new THREE.MeshStandardMaterial({
    color: "#3d434b",
    roughness: 0.45,
    metalness: 0.35,
  }),
  slab: new THREE.MeshStandardMaterial({ color: "#12161c", roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({
    color: "#b9b6ae",
    roughness: 0.92,
    roughnessMap: rmap,
  }),
  parapet: new THREE.MeshStandardMaterial({
    color: "#cfcbc1",
    roughness: 0.88,
    roughnessMap: rmap,
  }),

  // --- Glass ----------------------------------------------------------------
  glassHero: new THREE.MeshPhysicalMaterial({
    color: "#e2f0f4",
    transparent: true,
    opacity: 0.22,
    roughness: 0.02,
    metalness: 0,
    transmission: 0.94,
    ior: 1.5,
    reflectivity: 0.55,
    thickness: 0.25,
    side: THREE.DoubleSide,
  }),
  glassCheap: new THREE.MeshStandardMaterial({
    color: "#cfe3ea",
    transparent: true,
    opacity: 0.18,
    roughness: 0.08,
    metalness: 0.25,
    side: THREE.DoubleSide,
  }),
  mullion: new THREE.MeshStandardMaterial({
    color: "#2f343b",
    roughness: 0.28,
    metalness: 0.85,
  }),

  // --- Wood & stone ---------------------------------------------------------
  oak: new THREE.MeshStandardMaterial({ color: "#c3925c", roughness: 0.55 }),
  walnut: new THREE.MeshStandardMaterial({
    color: "#4f3d2c",
    roughness: 0.38,
    metalness: 0.05,
  }),
  woodLight: new THREE.MeshStandardMaterial({
    color: "#cba87a",
    roughness: 0.45,
  }),
  slat: new THREE.MeshStandardMaterial({ color: "#a5763f", roughness: 0.5 }),
  stoneCounter: new THREE.MeshStandardMaterial({
    color: "#efece3",
    roughness: 0.22,
    metalness: 0.12,
    roughnessMap: rmap,
  }),
  marble: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: tileTex ?? undefined,
    roughness: 0.18,
    metalness: 0.1,
  }),

  // --- Metal ----------------------------------------------------------------
  metalDark: new THREE.MeshStandardMaterial({
    color: "#24292f",
    roughness: 0.32,
    metalness: 0.85,
  }),
  metalBrushed: new THREE.MeshStandardMaterial({
    color: "#b3bac4",
    roughness: 0.28,
    metalness: 0.9,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: "#d6dce4",
    roughness: 0.08,
    metalness: 1,
  }),
  blackAnodized: new THREE.MeshStandardMaterial({
    color: "#15181c",
    roughness: 0.4,
    metalness: 0.7,
  }),

  // --- Fabric ---------------------------------------------------------------
  sofa: new THREE.MeshStandardMaterial({ color: "#3d4b5c", roughness: 0.9 }),
  sofaWarm: new THREE.MeshStandardMaterial({
    color: "#a86f45",
    roughness: 0.85,
  }),
  sofaTeal: new THREE.MeshStandardMaterial({
    color: "#2f6f6a",
    roughness: 0.88,
  }),
  chairFabric: new THREE.MeshStandardMaterial({
    color: "#2f3742",
    roughness: 0.75,
  }),
  rug: new THREE.MeshStandardMaterial({
    color: "#9c9182",
    map: carpetTex ?? undefined,
    roughness: 0.98,
  }),
  felt: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: feltTex ?? undefined,
    roughness: 0.98,
  }),

  // --- Greenery -------------------------------------------------------------
  pot: new THREE.MeshStandardMaterial({ color: "#cdc6b6", roughness: 0.6 }),
  potDark: new THREE.MeshStandardMaterial({ color: "#4a5158", roughness: 0.5 }),
  leaf: new THREE.MeshStandardMaterial({ color: "#3f8442", roughness: 0.72 }),
  leafDark: new THREE.MeshStandardMaterial({
    color: "#2c6b38",
    roughness: 0.78,
  }),
  trunk: new THREE.MeshStandardMaterial({ color: "#54402c", roughness: 0.82 }),
  hedge: new THREE.MeshStandardMaterial({ color: "#3a6b3c", roughness: 0.95 }),
  grass: new THREE.MeshStandardMaterial({
    color: "#4c7a43",
    roughness: 0.95,
    roughnessMap: rmap,
  }),

  // --- Tech / emissive ------------------------------------------------------
  screen: new THREE.MeshStandardMaterial({
    color: "#0b1f3a",
    emissive: "#2563eb",
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.3,
  }),
  tvBezel: new THREE.MeshStandardMaterial({
    color: "#0e1116",
    roughness: 0.35,
    metalness: 0.6,
  }),
  tvA: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: tvA ?? undefined,
    emissive: "#ffffff",
    emissiveMap: tvA ?? undefined,
    emissiveIntensity: 1.15,
    roughness: 0.25,
  }),
  tvB: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: tvB ?? undefined,
    emissive: "#ffffff",
    emissiveMap: tvB ?? undefined,
    emissiveIntensity: 1.15,
    roughness: 0.25,
  }),
  tvC: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: tvC ?? undefined,
    emissive: "#ffffff",
    emissiveMap: tvC ?? undefined,
    emissiveIntensity: 1.15,
    roughness: 0.25,
  }),
  whiteboard: new THREE.MeshStandardMaterial({
    color: "#f7f8fa",
    roughness: 0.14,
    metalness: 0.05,
  }),
  serverBody: new THREE.MeshStandardMaterial({
    color: "#14181f",
    roughness: 0.38,
    metalness: 0.65,
  }),
  ledGreen: new THREE.MeshStandardMaterial({
    color: "#10b981",
    emissive: "#10b981",
    emissiveIntensity: 1.8,
    roughness: 0.3,
  }),
  ledCyan: new THREE.MeshStandardMaterial({
    color: "#22d3ee",
    emissive: "#22d3ee",
    emissiveIntensity: 1.9,
    roughness: 0.3,
  }),
  stripWarm: new THREE.MeshStandardMaterial({
    color: "#fff6e6",
    emissive: "#ffe6bd",
    emissiveIntensity: 1.6,
    roughness: 0.2,
  }),
  stripCool: new THREE.MeshStandardMaterial({
    color: "#f2f8ff",
    emissive: "#d8e9ff",
    emissiveIntensity: 1.6,
    roughness: 0.2,
  }),
  logo: new THREE.MeshStandardMaterial({
    color: "#f8fafc",
    emissive: "#38bdf8",
    emissiveIntensity: 1.4,
    roughness: 0.3,
  }),

  // --- Reception / counters -------------------------------------------------
  reception: new THREE.MeshStandardMaterial({
    color: "#26303c",
    roughness: 0.28,
    metalness: 0.4,
  }),

  // --- Outdoor --------------------------------------------------------------
  pavement: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: pavingTex ?? undefined,
    roughness: 0.9,
    roughnessMap: rmap,
  }),
  pavementTrim: new THREE.MeshStandardMaterial({
    color: "#8d918a",
    roughness: 0.88,
  }),
  asphalt: new THREE.MeshStandardMaterial({
    color: "#3a3d42",
    roughness: 0.95,
    roughnessMap: rmap,
  }),
  curb: new THREE.MeshStandardMaterial({ color: "#c4c2b8", roughness: 0.85 }),
  lampPost: new THREE.MeshStandardMaterial({
    color: "#2b3037",
    roughness: 0.4,
    metalness: 0.7,
  }),
  lampGlow: new THREE.MeshStandardMaterial({
    color: "#fff4dd",
    emissive: "#ffe8bb",
    emissiveIntensity: 2.2,
    roughness: 0.2,
  }),

  // Distant towers (three window densities so silhouettes read differently).
  towerA: new THREE.MeshStandardMaterial({
    color: "#8f9aa8",
    map: gridA ?? undefined,
    emissive: "#ffffff",
    emissiveMap: gridA ?? undefined,
    emissiveIntensity: 0.55,
    roughness: 0.4,
    metalness: 0.3,
  }),
  towerB: new THREE.MeshStandardMaterial({
    color: "#7d8794",
    map: gridB ?? undefined,
    emissive: "#ffffff",
    emissiveMap: gridB ?? undefined,
    emissiveIntensity: 0.45,
    roughness: 0.45,
    metalness: 0.25,
  }),
  towerC: new THREE.MeshStandardMaterial({
    color: "#9aa4b0",
    map: gridC ?? undefined,
    emissive: "#ffffff",
    emissiveMap: gridC ?? undefined,
    emissiveIntensity: 0.6,
    roughness: 0.35,
    metalness: 0.35,
  }),
};

// ============================================================================
// FLOORS — textured, per-room, with world-constant tile size
// ============================================================================
export type FloorKind =
  | "lobby"
  | "corridor"
  | "workspace"
  | "lounge"
  | "cafeteria"
  | "wood"
  | "ailab"
  // Outdoor grounds — same tiling system so slabs/blades keep a real-world size.
  | "plaza"
  | "lawn"
  | "asphalt"
  | "walkway";

interface FloorSpec {
  color: string;
  map: THREE.Texture | null;
  /** World size (meters) of one texture repeat. */
  tile: number;
  roughness: number;
  metalness: number;
}

const FLOOR_SPEC: Record<FloorKind, FloorSpec> = {
  lobby: {
    color: "#e9e5db",
    map: tileTex,
    tile: 2.4,
    roughness: 0.3,
    metalness: 0.14,
  },
  corridor: {
    color: "#dedcd4",
    map: terrazzoTex,
    tile: 1.8,
    roughness: 0.38,
    metalness: 0.1,
  },
  workspace: {
    color: "#8e97a4",
    map: carpetTex,
    tile: 1.2,
    roughness: 0.96,
    metalness: 0,
  },
  lounge: {
    color: "#b98d63",
    map: plankTex,
    tile: 2.6,
    roughness: 0.5,
    metalness: 0.04,
  },
  cafeteria: {
    color: "#c99a6b",
    map: plankTex,
    tile: 2.6,
    roughness: 0.42,
    metalness: 0.04,
  },
  wood: {
    color: "#b08b60",
    map: plankTex,
    tile: 2.6,
    roughness: 0.4,
    metalness: 0.04,
  },
  ailab: {
    color: "#9fb4c4",
    map: epoxyTex,
    tile: 3.2,
    roughness: 0.26,
    metalness: 0.3,
  },
  plaza: {
    color: "#cfcec5",
    map: pavingTex,
    tile: 2.7,
    roughness: 0.88,
    metalness: 0.02,
  },
  lawn: {
    color: "#5f8a52",
    map: grassTex,
    tile: 7,
    roughness: 0.96,
    metalness: 0,
  },
  asphalt: {
    color: "#54585f",
    map: asphaltTex,
    tile: 6,
    roughness: 0.94,
    metalness: 0.02,
  },
  walkway: {
    color: "#cbc9c0",
    map: walkTex,
    tile: 2.2,
    roughness: 0.9,
    metalness: 0.02,
  },
};

const floorCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Floor material for a room, with the texture repeat derived from the room's
 * footprint so tiles/planks stay a constant real-world size everywhere.
 */
export function floorFor(
  kind: FloorKind,
  width: number,
  depth: number,
): THREE.MeshStandardMaterial {
  const key = `${kind}|${width.toFixed(1)}|${depth.toFixed(1)}`;
  const hit = floorCache.get(key);
  if (hit) return hit;

  const spec = FLOOR_SPEC[kind];
  let map: THREE.Texture | undefined;
  if (spec.map) {
    map = spec.map.clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(
      Math.max(1, width / spec.tile),
      Math.max(1, depth / spec.tile),
    );
  }
  const mat = new THREE.MeshStandardMaterial({
    color: spec.color,
    map,
    roughness: spec.roughness,
    metalness: spec.metalness,
    roughnessMap: rmap,
  });
  floorCache.set(key, mat);
  return mat;
}

/** Texture handed to the lobby's reflective floor. */
export const LOBBY_FLOOR_MAP = tileTex;
