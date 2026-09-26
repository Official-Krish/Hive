// ============================================================================
// OFFICE WORLD MATERIALS — shared singletons + procedural textures
// ----------------------------------------------------------------------------
// Everything here is generated locally (canvas textures, no network fetches).
// Materials are module-level singletons so every mesh/instance shares the same
// GPU material and texture source (few state changes, low VRAM).
// ============================================================================

import * as THREE from "three";
import { whiteboardTexture } from "./signage";

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
  // 2x backing store over the nominal size — crisper floors/screens at
  // glancing angles. Draw recipes scale with `s`, so one multiplier upgrades
  // every procedural texture at once.
  const S = size * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx, S, lcg(opts.seed ?? 1));
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 16;
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

/** Large-format stone tile with thin grout + soft veining. One tile per UV.
 *  Ultra-real pass: layered veins (broad wash + hairline), crystalline
 *  speckle, soft vignette and a polished highlight so the lobby reads as
 *  honed marble under the skylight rather than flat plaster. */
const tileTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#e8e4d9";
    ctx.fillRect(0, 0, s, s);
    // broad mineral wash
    for (let i = 0; i < 7; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = s * (0.2 + rnd() * 0.35);
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, `rgba(196,188,172,${0.05 + rnd() * 0.08})`);
      g.addColorStop(1, "rgba(196,188,172,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    // veining: bold + hairline pairs
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(150,142,126,${0.05 + rnd() * 0.1})`;
      ctx.lineWidth = 0.6 + rnd() * 2.4;
      ctx.beginPath();
      let x = rnd() * s;
      let y = rnd() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rnd() - 0.5) * s * 0.45;
        y += (rnd() - 0.5) * s * 0.45;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + rnd() * 0.16})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      let x = rnd() * s;
      let y = rnd() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rnd() - 0.5) * s * 0.3;
        y += (rnd() - 0.5) * s * 0.3;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // crystalline speckle (light + dark)
    for (let i = 0; i < 1100; i++) {
      ctx.fillStyle = `rgba(110,104,92,${rnd() * 0.13})`;
      ctx.fillRect(rnd() * s, rnd() * s, 1.5, 1.5);
    }
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.2})`;
      ctx.fillRect(rnd() * s, rnd() * s, 1.2, 1.2);
    }
    // grout: darker recessed joint + inner highlight
    ctx.strokeStyle = "#a9a294";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(4, 4, s - 8, s - 8);
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

/** Carpet tile — tight woven noise with a faint tile seam.
 *  Ultra-real pass: two-tone heather yarn, directional pile streaks and a
 *  darker bound edge so engineering rows read as contract carpet. */
const carpetTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#434c59";
    ctx.fillRect(0, 0, s, s);
    // heather blend: slate + warm grey yarns
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        const v = rnd();
        if (v > 0.82) {
          ctx.fillStyle = `rgba(150,140,125,${0.05 + rnd() * 0.08})`;
        } else {
          ctx.fillStyle = `rgba(255,255,255,${v * 0.055})`;
        }
        ctx.fillRect(x, y, 2, 1);
        ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.1})`;
        ctx.fillRect(x, y + 1, 2, 1);
      }
    }
    // pile streaks (subtle vertical nap)
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${rnd() * 0.03})`;
      ctx.lineWidth = 1;
      const x = rnd() * s;
      const y = rnd() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 2, y + 6 + rnd() * 10);
      ctx.stroke();
    }
    // bound edge
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(5, 5, s - 10, s - 10);
  },
  { seed: 31 },
);

/** Wood planks — 4 planks per tile, grain lines + seams.
 *  Ultra-real pass: per-plank tone shift, cathedral arcs, pore speckle and
 *  a satin sheen band so lounge/cafeteria oak reads as oiled timber. */
const plankTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    const rows = 4;
    const h = s / rows;
    for (let r = 0; r < rows; r++) {
      const tone = rnd();
      const base = 138 + Math.floor(rnd() * 34);
      const warm = tone > 0.5 ? 1.06 : 0.96;
      ctx.fillStyle = `rgb(${Math.min(255, Math.floor(base * warm))},${Math.floor(base * 0.7)},${Math.floor(base * 0.46)})`;
      ctx.fillRect(0, r * h, s, h);
      // cathedral figure
      for (let c = 0; c < 3; c++) {
        const cxp = rnd() * s;
        for (let k = 0; k < 7; k++) {
          ctx.strokeStyle = `rgba(74,48,26,${0.06 + rnd() * 0.1})`;
          ctx.lineWidth = 1 + rnd() * 1.6;
          ctx.beginPath();
          ctx.ellipse(
            cxp,
            r * h + h / 2,
            14 + k * 13,
            h * (0.32 + k * 0.03),
            0,
            0,
            6.3,
          );
          ctx.stroke();
        }
      }
      // straight grain
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(70,46,26,${0.05 + rnd() * 0.12})`;
        ctx.lineWidth = 0.5 + rnd() * 1.2;
        ctx.beginPath();
        const y = r * h + rnd() * h;
        ctx.moveTo(0, y);
        for (let x = 0; x <= s; x += 32) ctx.lineTo(x, y + (rnd() - 0.5) * 4);
        ctx.stroke();
      }
      // pore speckle
      for (let i = 0; i < 130; i++) {
        ctx.fillStyle = `rgba(52,34,18,${rnd() * 0.2})`;
        ctx.fillRect(rnd() * s, r * h + rnd() * h, 1.6, 1);
      }
      // satin sheen band
      const sheen = ctx.createLinearGradient(0, r * h, 0, r * h + h);
      sheen.addColorStop(0, "rgba(255,244,225,0.07)");
      sheen.addColorStop(0.5, "rgba(255,244,225,0)");
      sheen.addColorStop(1, "rgba(40,24,12,0.08)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, r * h, s, h);
      // plank seam + stagger butt joint
      ctx.fillStyle = "rgba(48,32,18,0.6)";
      ctx.fillRect(0, r * h, s, 2.5);
      const jx = Math.floor(rnd() * s);
      ctx.fillRect(jx, r * h, 2.5, h);
      ctx.fillStyle = "rgba(255,235,205,0.12)";
      ctx.fillRect(0, r * h + 2.5, s, 1);
    }
  },
  { seed: 43 },
);

/** Dark poured epoxy with a faint control-joint grid.
 *  Ultra-real pass: mottled pour clouds, metallic flake and a wet-look
 *  highlight sweep for the AI Lab's glossy mission-control floor. */
const epoxyTex = tex(
  512,
  [1, 1],
  (ctx, s, rnd) => {
    ctx.fillStyle = "#222a33";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 9; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = s * (0.15 + rnd() * 0.3);
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(120,150,175,${0.04 + rnd() * 0.06})`);
      g.addColorStop(1, "rgba(120,150,175,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.055})`;
      ctx.fillRect(rnd() * s, rnd() * s, 1.6, 1.6);
    }
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = `rgba(150,200,230,${rnd() * 0.16})`;
      ctx.fillRect(rnd() * s, rnd() * s, 1.1, 1.1);
    }
    const sweep = ctx.createLinearGradient(0, 0, s, s);
    sweep.addColorStop(0, "rgba(255,255,255,0.05)");
    sweep.addColorStop(0.5, "rgba(255,255,255,0)");
    sweep.addColorStop(1, "rgba(255,255,255,0.04)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(140,170,190,0.2)";
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
    // mower stripes (subtle — the tile repeats far beyond the plaza)
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = `rgba(255,255,255,${b % 2 ? 0.02 : 0})`;
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

/** Lit-window grid for distant towers (used as map + emissiveMap).
 *  Enriched: concrete base gradient (dark podium → pale crown), slab lines
 *  per row and brighter glass toward the top where the sun catches it. */
function windowGrid(cols: number, rows: number, seed: number, lit = 0.5) {
  return tex(
    256,
    [1, 1],
    (ctx, s, rnd) => {
      const base = ctx.createLinearGradient(0, s, 0, 0);
      base.addColorStop(0, "#1a212b");
      base.addColorStop(0.6, "#232c38");
      base.addColorStop(1, "#3a4552");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
      const cw = s / cols;
      const rh = s / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const topness = 1 - r / rows; // 1 at crown
          const on = rnd() < lit * (0.5 + topness * 0.7);
          const warm = rnd() < 0.6;
          const a = on ? (warm ? 0.55 : 0.45) + rnd() * 0.45 : 0.9;
          ctx.fillStyle = on
            ? warm
              ? `rgba(255,226,170,${a})`
              : `rgba(196,226,255,${a})`
            : `rgba(16,22,30,${a})`;
          ctx.fillRect(
            c * cw + cw * 0.18,
            r * rh + rh * 0.2,
            cw * 0.64,
            rh * 0.56,
          );
        }
        // slab shadow per column bay
        ctx.fillStyle = "rgba(8,11,15,0.55)";
        for (let r = 0; r <= rows; r++) ctx.fillRect(c * cw, r * rh - 1, cw, 2);
      }
    },
    { seed },
  );
}

/** Procedural dashboard content for wall TVs. `layout` picks the composition
 *  so adjacent screens never show the same wallpaper. */
export type ScreenLayout =
  "chart" | "pipeline" | "agenda" | "menu" | "heatmap" | "logs";
function screenContent(
  seed: number,
  hue: "blue" | "green" | "violet" | "cyan" | "amber" | "rose",
  layout: ScreenLayout = "chart",
) {
  const palettes: Record<typeof hue, Palette> = {
    blue: ["#38bdf8", "#0ea5e9", "#60a5fa"],
    green: ["#34d399", "#10b981", "#6ee7b7"],
    violet: ["#a78bfa", "#8b5cf6", "#c4b5fd"],
    cyan: ["#22d3ee", "#06b6d4", "#67e8f9"],
    amber: ["#fbbf24", "#f59e0b", "#fcd34d"],
    rose: ["#fb7185", "#f43f5e", "#fda4af"],
  };
  const accents = palettes[hue];
  const lead = accents[0];
  return tex(
    512,
    [1, 1],
    (ctx, s, rnd) => {
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, s, s);
      // header bar (shared chrome so the wall reads as one system)
      ctx.fillStyle = "#131c2b";
      ctx.fillRect(0, 0, s, s * 0.11);
      ctx.fillStyle = lead;
      ctx.fillRect(s * 0.03, s * 0.04, s * 0.16, s * 0.035);
      ctx.fillStyle = "rgba(148,163,184,0.5)";
      ctx.fillRect(s * 0.75, s * 0.045, s * 0.22, s * 0.025);

      if (layout === "pipeline") {
        // CI stages left→right with pass/fail dots
        const stages = 5;
        for (let i = 0; i < stages; i++) {
          const x = s * (0.08 + i * 0.18);
          const y = s * 0.45;
          const pass = rnd() > 0.25;
          ctx.fillStyle = "#152033";
          ctx.fillRect(x - s * 0.07, y - s * 0.14, s * 0.15, s * 0.3);
          ctx.fillStyle = pass ? lead : "#f43f5e";
          ctx.beginPath();
          ctx.arc(x, y - s * 0.05, s * 0.028, 0, 6.3);
          ctx.fill();
          ctx.fillStyle = "rgba(148,163,184,0.55)";
          ctx.fillRect(x - s * 0.05, y + s * 0.03, s * 0.1, s * 0.014);
          ctx.fillRect(x - s * 0.05, y + s * 0.06, s * 0.07 * rnd(), s * 0.014);
          if (i < stages - 1) {
            ctx.fillStyle = "rgba(148,163,184,0.4)";
            ctx.fillRect(x + s * 0.08, y - s * 0.06, s * 0.03, s * 0.02);
          }
        }
        // footer bars
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = swatch(accents, i);
          ctx.globalAlpha = 0.8;
          const bh = s * (0.04 + rnd() * 0.12);
          ctx.fillRect(s * 0.05 + i * s * 0.1, s * 0.94 - bh, s * 0.06, bh);
        }
        ctx.globalAlpha = 1;
        return;
      }

      if (layout === "agenda") {
        // meeting agenda rows with time blocks
        for (let i = 0; i < 5; i++) {
          const y = s * (0.18 + i * 0.15);
          ctx.fillStyle = i === 1 ? lead : "rgba(148,163,184,0.5)";
          ctx.fillRect(s * 0.05, y, s * 0.1, s * 0.05);
          ctx.fillStyle = "#152033";
          ctx.fillRect(s * 0.18, y - s * 0.01, s * 0.5, s * 0.09);
          ctx.fillStyle = "rgba(226,232,240,0.75)";
          ctx.fillRect(
            s * 0.2,
            y + s * 0.015,
            s * (0.2 + rnd() * 0.22),
            s * 0.02,
          );
          if (i === 1) {
            ctx.fillStyle = lead;
            ctx.globalAlpha = 0.25;
            ctx.fillRect(s * 0.18, y - s * 0.01, s * 0.5, s * 0.09);
            ctx.globalAlpha = 1;
          }
        }
        // attendees strip
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = swatch(accents, i);
          ctx.beginPath();
          ctx.arc(s * (0.08 + i * 0.07), s * 0.93, s * 0.025, 0, 6.3);
          ctx.fill();
        }
        return;
      }

      if (layout === "menu") {
        // cafeteria menu list with prices
        const items = 5;
        for (let i = 0; i < items; i++) {
          const y = s * (0.18 + i * 0.15);
          ctx.fillStyle = swatch(accents, i);
          ctx.fillRect(s * 0.05, y, s * 0.05, s * 0.05);
          ctx.fillStyle = "rgba(226,232,240,0.8)";
          ctx.fillRect(
            s * 0.13,
            y + s * 0.008,
            s * (0.25 + rnd() * 0.2),
            s * 0.02,
          );
          ctx.fillStyle = lead;
          ctx.fillRect(s * 0.82, y + s * 0.008, s * 0.08, s * 0.02);
        }
        ctx.fillStyle = "rgba(148,163,184,0.4)";
        ctx.fillRect(s * 0.05, s * 0.9, s * 0.9, s * 0.008);
        return;
      }

      if (layout === "heatmap") {
        // GPU cluster heatmap + side load bars
        const n = 8;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < n; c++) {
            const v = rnd();
            ctx.fillStyle = lead;
            ctx.globalAlpha = 0.15 + v * 0.85;
            ctx.fillRect(
              s * 0.05 + c * s * 0.073,
              s * 0.17 + r * s * 0.12,
              s * 0.06,
              s * 0.09,
            );
          }
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = "#152033";
          ctx.fillRect(s * 0.7, s * 0.17 + i * s * 0.2, s * 0.25, s * 0.15);
          ctx.fillStyle = lead;
          ctx.fillRect(
            s * 0.72,
            s * 0.28 + i * s * 0.2,
            s * 0.2 * rnd(),
            s * 0.02,
          );
        }
        return;
      }

      if (layout === "logs") {
        // terminal log lines with level ticks
        for (let i = 0; i < 12; i++) {
          const y = s * (0.16 + i * 0.065);
          const lvl = rnd();
          ctx.fillStyle =
            lvl > 0.85 ? "#f43f5e" : lvl > 0.6 ? lead : "rgba(148,163,184,0.5)";
          ctx.fillRect(s * 0.05, y, s * 0.03, s * 0.03);
          ctx.fillStyle = `rgba(148,163,184,${0.25 + rnd() * 0.4})`;
          ctx.fillRect(
            s * 0.1,
            y + s * 0.006,
            s * (0.3 + rnd() * 0.5),
            s * 0.014,
          );
        }
        return;
      }

      // default "chart" composition (build overview)
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

const tvA = screenContent(101, "blue", "chart");
const tvB = screenContent(202, "green", "agenda");
const tvC = screenContent(303, "violet", "pipeline");
const tvD = screenContent(404, "cyan", "heatmap");
const tvE = screenContent(505, "amber", "menu");
const tvF = screenContent(606, "rose", "logs");

function tvMat(map: THREE.Texture | null) {
  // Screens glow like real backlit panels: punchy emissive, deep blacks.
  return new THREE.MeshStandardMaterial({
    color: "#0a0f18",
    map: map ?? undefined,
    emissive: "#ffffff",
    emissiveMap: map ?? undefined,
    emissiveIntensity: 2.1,
    roughness: 0.18,
    metalness: 0.1,
    envMapIntensity: 0.7,
  });
}

// Tower facades — generated once each and reused as both map and emissiveMap.
// Dense grids so tall stretched towers keep believable window sizes.
const gridA = windowGrid(16, 40, 11, 0.55);
const gridB = windowGrid(12, 30, 29, 0.47);
const gridC = windowGrid(20, 48, 47, 0.62);

// ============================================================================
// MATERIALS
// ============================================================================
const rmap = grain ?? undefined;

export const M = {
  // --- Architecture ---------------------------------------------------------
  // Ultra-real grade: warm gallery whites with eggshell sheen, deep ink
  // feature wall with a satin clearcoat feel, ceilings kept matte to hold
  // contrast under the cinematic rig.
  wall: new THREE.MeshStandardMaterial({
    color: "#efe9dc",
    roughness: 0.82,
    roughnessMap: rmap,
    bumpMap: rmap,
    bumpScale: 0.012,
    envMapIntensity: 0.55,
  }),
  wallWarm: new THREE.MeshStandardMaterial({
    color: "#e6dcc8",
    roughness: 0.8,
    roughnessMap: rmap,
    bumpMap: rmap,
    bumpScale: 0.012,
    envMapIntensity: 0.55,
  }),
  wallAccent: new THREE.MeshStandardMaterial({
    color: "#d8d0bd",
    roughness: 0.74,
    envMapIntensity: 0.6,
  }),
  featureWall: new THREE.MeshStandardMaterial({
    color: "#1d2733",
    roughness: 0.42,
    metalness: 0.28,
    envMapIntensity: 0.9,
  }),
  ceiling: new THREE.MeshStandardMaterial({
    color: "#f5f3ec",
    roughness: 0.94,
    side: THREE.DoubleSide,
    envMapIntensity: 0.35,
  }),
  ceilingPanel: new THREE.MeshStandardMaterial({
    color: "#ebe9e1",
    roughness: 0.88,
    envMapIntensity: 0.35,
  }),
  plenum: new THREE.MeshStandardMaterial({ color: "#1c2026", roughness: 0.92 }),
  baseboard: new THREE.MeshStandardMaterial({
    color: "#3d434b",
    roughness: 0.45,
    metalness: 0.35,
  }),
  slab: new THREE.MeshStandardMaterial({ color: "#12161c", roughness: 0.9 }),
  concrete: new THREE.MeshStandardMaterial({
    color: "#bdbab1",
    roughness: 0.85,
    roughnessMap: rmap,
    bumpMap: rmap,
    bumpScale: 0.015,
    envMapIntensity: 0.5,
  }),
  parapet: new THREE.MeshStandardMaterial({
    color: "#d3cfc4",
    roughness: 0.8,
    roughnessMap: rmap,
    bumpMap: rmap,
    bumpScale: 0.012,
    envMapIntensity: 0.5,
  }),

  // --- Glass ----------------------------------------------------------------
  // depthWrite off on all glass so stacked panes (facade / pods / guards)
  // blend in draw order instead of flickering against each other's depth.
  // Tiers, far→near: facade/exterior < pod partitions < balustrades/guards
  // (set via mesh renderOrder at the call site; see Shell/Level2/Stairs).
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
    depthWrite: false,
  }),
  glassCheap: new THREE.MeshStandardMaterial({
    color: "#c4dbe4",
    transparent: true,
    opacity: 0.24,
    roughness: 0.06,
    metalness: 0.35,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  mullion: new THREE.MeshStandardMaterial({
    color: "#23282f",
    roughness: 0.32,
    metalness: 0.9,
    envMapIntensity: 1.1,
  }),

  // --- Wood & stone ---------------------------------------------------------
  // Oiled oak, deep walnut with satin sheen, honed stone with a polished top.
  oak: new THREE.MeshStandardMaterial({
    color: "#bd8a52",
    roughness: 0.42,
    envMapIntensity: 0.8,
  }),
  walnut: new THREE.MeshStandardMaterial({
    color: "#54402d",
    roughness: 0.3,
    metalness: 0.08,
    envMapIntensity: 1.0,
  }),
  woodLight: new THREE.MeshStandardMaterial({
    color: "#d2ab7c",
    roughness: 0.38,
    envMapIntensity: 0.8,
  }),
  slat: new THREE.MeshStandardMaterial({
    color: "#a97c42",
    roughness: 0.42,
    envMapIntensity: 0.7,
  }),
  stoneCounter: new THREE.MeshStandardMaterial({
    color: "#f0ece2",
    roughness: 0.16,
    metalness: 0.08,
    roughnessMap: rmap,
    bumpMap: rmap,
    bumpScale: 0.006,
    envMapIntensity: 1.3,
  }),
  marble: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: tileTex ?? undefined,
    roughness: 0.12,
    metalness: 0.08,
    envMapIntensity: 1.2,
  }),

  // --- Metal ----------------------------------------------------------------
  // Darkened bronze-black steel, brushed aluminium with anisotropic feel,
  // mirror chrome reserved for taps/rails/mic.
  metalDark: new THREE.MeshStandardMaterial({
    color: "#20252c",
    roughness: 0.36,
    metalness: 0.88,
    envMapIntensity: 1.1,
  }),
  metalBrushed: new THREE.MeshStandardMaterial({
    color: "#c2c8d1",
    roughness: 0.24,
    metalness: 0.95,
    envMapIntensity: 1.4,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: "#e2e8f0",
    roughness: 0.06,
    metalness: 1,
    envMapIntensity: 1.8,
  }),
  blackAnodized: new THREE.MeshStandardMaterial({
    color: "#101317",
    roughness: 0.34,
    metalness: 0.78,
    envMapIntensity: 1.0,
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
  // Chill Space rug — warmer tint + own seed feel via color shift so the
  // corner reads as a lounge nook instead of a carpet-tile repeat.
  chillRug: new THREE.MeshStandardMaterial({
    color: "#9a7a5c",
    map: carpetTex ?? undefined,
    roughness: 0.98,
    bumpMap: rmap,
    bumpScale: 0.01,
  }),
  // Plush bean-bag fabrics — solid warm hues (no new textures, shared singletons).
  puffA: new THREE.MeshStandardMaterial({
    color: "#c06a3e",
    roughness: 0.95,
  }),
  puffB: new THREE.MeshStandardMaterial({
    color: "#d9a441",
    roughness: 0.95,
  }),
  puffC: new THREE.MeshStandardMaterial({
    color: "#35706a",
    roughness: 0.95,
  }),
  puffD: new THREE.MeshStandardMaterial({
    color: "#b0506b",
    roughness: 0.95,
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
  tvA: tvMat(tvA),
  tvB: tvMat(tvB),
  tvC: tvMat(tvC),
  tvD: tvMat(tvD),
  tvE: tvMat(tvE),
  tvF: tvMat(tvF),
  whiteboard: new THREE.MeshStandardMaterial({
    color: "#f7f8fa",
    roughness: 0.14,
    metalness: 0.05,
  }),
  // Four scribble variants — assigned round-robin so neighbours differ.
  whiteboardMarked: [0, 1, 2, 3].map(
    (v) =>
      new THREE.MeshStandardMaterial({
        map: whiteboardTexture(v),
        roughness: 0.14,
        metalness: 0.05,
      }),
  ),
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
    emissive: "#ffdfae",
    emissiveIntensity: 2.4,
    roughness: 0.2,
    toneMapped: false,
  }),
  stripCool: new THREE.MeshStandardMaterial({
    color: "#f2f8ff",
    emissive: "#d3e7ff",
    emissiveIntensity: 2.2,
    roughness: 0.2,
    toneMapped: false,
  }),
  logo: new THREE.MeshStandardMaterial({
    color: "#f8fafc",
    emissive: "#38bdf8",
    emissiveIntensity: 2.0,
    roughness: 0.3,
    toneMapped: false,
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
  roadPaint: new THREE.MeshStandardMaterial({
    color: "#e8e9ea",
    roughness: 0.7,
  }),
  roadYellow: new THREE.MeshStandardMaterial({
    color: "#d9a62e",
    roughness: 0.7,
  }),
  drainCover: new THREE.MeshStandardMaterial({
    color: "#3a3f45",
    roughness: 0.6,
    metalness: 0.5,
  }),
  asphalt: new THREE.MeshStandardMaterial({
    color: "#3a3d42",
    roughness: 0.95,
    roughnessMap: rmap,
  }),
  curb: new THREE.MeshStandardMaterial({ color: "#c4c2b8", roughness: 0.85 }),
  mulch: new THREE.MeshStandardMaterial({ color: "#4a3826", roughness: 1 }),
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
    color: "#8b95a3",
    map: gridA ?? undefined,
    emissive: "#cfd9e6",
    emissiveMap: gridA ?? undefined,
    emissiveIntensity: 0.95,
    roughness: 0.42,
    metalness: 0.3,
  }),
  towerB: new THREE.MeshStandardMaterial({
    color: "#79828e",
    map: gridB ?? undefined,
    emissive: "#cfd9e6",
    emissiveMap: gridB ?? undefined,
    emissiveIntensity: 0.85,
    roughness: 0.46,
    metalness: 0.25,
  }),
  towerC: new THREE.MeshStandardMaterial({
    color: "#959faa",
    map: gridC ?? undefined,
    emissive: "#cfd9e6",
    emissiveMap: gridC ?? undefined,
    emissiveIntensity: 1.0,
    roughness: 0.38,
    metalness: 0.35,
  }),

  // Neighbouring blocks: precast frame, ground-floor soffit, lit signage.
  precast: new THREE.MeshStandardMaterial({
    color: "#b7b2a7",
    roughness: 0.82,
    metalness: 0.04,
    roughnessMap: rmap ?? undefined,
  }),
  precastDark: new THREE.MeshStandardMaterial({
    color: "#6f6a63",
    roughness: 0.8,
    metalness: 0.06,
  }),
  signBox: new THREE.MeshStandardMaterial({
    color: "#131820",
    emissive: "#7dd3fc",
    emissiveIntensity: 1.5,
    roughness: 0.4,
  }),
  signBoxWarm: new THREE.MeshStandardMaterial({
    color: "#1a1410",
    emissive: "#ffc47a",
    emissiveIntensity: 1.5,
    roughness: 0.4,
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
    color: "#ece7da",
    map: tileTex,
    tile: 2.4,
    roughness: 0.16,
    metalness: 0.1,
  },
  corridor: {
    color: "#e0ddd3",
    map: terrazzoTex,
    tile: 1.8,
    roughness: 0.3,
    metalness: 0.08,
  },
  workspace: {
    color: "#7d8794",
    map: carpetTex,
    tile: 1.0,
    roughness: 0.97,
    metalness: 0,
  },
  lounge: {
    color: "#bd9266",
    map: plankTex,
    tile: 2.4,
    roughness: 0.38,
    metalness: 0.05,
  },
  cafeteria: {
    color: "#cfa06e",
    map: plankTex,
    tile: 2.4,
    roughness: 0.34,
    metalness: 0.05,
  },
  wood: {
    color: "#b69163",
    map: plankTex,
    tile: 2.4,
    roughness: 0.32,
    metalness: 0.05,
  },
  ailab: {
    color: "#a8bdd0",
    map: epoxyTex,
    tile: 3.2,
    roughness: 0.16,
    metalness: 0.35,
  },
  plaza: {
    color: "#cfcec5",
    map: pavingTex,
    tile: 2.7,
    roughness: 0.88,
    metalness: 0.02,
  },
  lawn: {
    color: "#67784f",
    map: grassTex,
    tile: 12,
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
const MAX_CACHED_MATERIALS = 64;

/** Evict the oldest cached material when the cap is hit (dispose GPU state). */
function capCache(cache: Map<string, THREE.MeshStandardMaterial>) {
  if (cache.size < MAX_CACHED_MATERIALS) return;
  const oldest = cache.keys().next();
  if (!oldest.done) {
    cache.get(oldest.value)?.dispose();
    cache.delete(oldest.value);
  }
}

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
  capCache(floorCache);
  floorCache.set(key, mat);
  return mat;
}

/**
 * Curtain-wall panel for the neighbouring blocks: a 4-bay × 3-storey tile
 * with bronze frames, sky-graded vision glass, venetian blinds on some bays,
 * slab shadow lines and a scatter of lit offices. Doubles as its own
 * emissiveMap so the lit bays glow.
 */
function facadeTex(seed: number, tint: string, lit: number) {
  const cols = 4;
  const rows = 3;
  return tex(
    512,
    [1, 1],
    (ctx, s, rnd) => {
      ctx.fillStyle = "#1d232b";
      ctx.fillRect(0, 0, s, s);
      const cw = s / cols;
      const rh = s / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * cw;
          const y = r * rh;
          // Floor slab edge: deep shadow line + thin reglet highlight.
          ctx.fillStyle = "rgba(10,13,17,0.9)";
          ctx.fillRect(x, y + rh - 7, cw, 7);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x, y + rh - 7, cw, 1.5);
          // Opaque spandrel band under the slab.
          const spand = ctx.createLinearGradient(
            0,
            y + rh * 0.7,
            0,
            y + rh - 7,
          );
          spand.addColorStop(0, "#454d56");
          spand.addColorStop(1, "#2c333b");
          ctx.fillStyle = spand;
          ctx.fillRect(x + 2, y + rh * 0.7, cw - 4, rh * 0.3 - 9);
          // Spandrel panel joints.
          ctx.fillStyle = "rgba(12,15,19,0.6)";
          ctx.fillRect(x + cw / 2 - 1, y + rh * 0.7, 2, rh * 0.3 - 9);
          // Vision glass with a sky gradient (bright top → deep sill).
          const on = rnd() < lit;
          const warm = rnd() < 0.55;
          const g = ctx.createLinearGradient(0, y + 2, 0, y + rh * 0.68);
          if (on) {
            g.addColorStop(0, warm ? "#ffedd0" : "#e2f0fc");
            g.addColorStop(0.55, warm ? "#e3b983" : "#a9c2d8");
            g.addColorStop(1, warm ? "#8a6a45" : "#4a5f74");
          } else {
            g.addColorStop(0, "#cfe0ee");
            g.addColorStop(0.35, tint);
            g.addColorStop(1, "#141b23");
          }
          ctx.fillStyle = g;
          ctx.fillRect(x + 3, y + 3, cw - 6, rh * 0.68 - 3);
          // Venetian blinds on ~40% of bays: slat lines in the upper half.
          if (!on && rnd() < 0.42) {
            const bh = rh * 0.68;
            const top = y + 3 + bh * (0.05 + rnd() * 0.15);
            const n = 5 + Math.floor(rnd() * 4);
            for (let k = 0; k < n; k++) {
              ctx.fillStyle = `rgba(228,232,236,${0.5 + rnd() * 0.3})`;
              ctx.fillRect(x + 5, top + k * 4.5, cw - 10, 1.6);
            }
            // blind bottom rail shadow
            ctx.fillStyle = "rgba(15,19,24,0.5)";
            ctx.fillRect(x + 5, top + n * 4.5, cw - 10, 2.5);
          }
          // Interior hint behind lit glass: desk silhouette band.
          if (on && rnd() < 0.5) {
            ctx.fillStyle = warm
              ? "rgba(90,60,30,0.55)"
              : "rgba(30,50,70,0.55)";
            ctx.fillRect(x + 3, y + 3 + (rh * 0.68 - 3) * 0.62, cw - 6, 3);
          }
          // Bronze frame: outer + centre mullion + transom.
          ctx.strokeStyle = "#2a241c";
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, rh - 3);
          ctx.fillStyle = "#33291d";
          ctx.fillRect(x + cw * 0.49, y + 2, 3.5, rh - 4);
          ctx.fillRect(x + 2, y + rh * 0.68 - 1.5, cw - 4, 3);
          // Diagonal sky streak so the glass stays lively.
          ctx.fillStyle = "rgba(255,255,255,0.09)";
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + 3, y + 3, cw - 6, rh * 0.68 - 3);
          ctx.clip();
          ctx.translate(x + cw * (0.2 + rnd() * 0.5), y);
          ctx.rotate(0.35);
          ctx.fillRect(0, 0, cw * 0.16, rh);
          ctx.restore();
        }
      }
    },
    { srgb: true, seed },
  );
}

/**
 * Warehouse brick: running-bond courses, stone piers between bays, punched
 * steel-sash windows with lintels — the Chelsea context around the glass
 * office in the reference. Same 4×3 tile grid so BAY_W/BAY_H still apply.
 */
function brickTex(seed: number, lit: number) {
  const cols = 4;
  const rows = 3;
  return tex(
    512,
    [1, 1],
    (ctx, s, rnd) => {
      // brick field
      ctx.fillStyle = "#7a4f3d";
      ctx.fillRect(0, 0, s, s);
      // per-brick tone variation
      for (let y = 0; y < s; y += 9) {
        const off = (y / 9) % 2 === 0 ? 0 : 14;
        for (let x = -28; x < s + 28; x += 28) {
          const v = rnd();
          ctx.fillStyle =
            v > 0.86
              ? `rgba(30,20,16,${0.2 + rnd() * 0.25})`
              : `rgba(${140 + rnd() * 50},${80 + rnd() * 30},${60 + rnd() * 22},0.35)`;
          ctx.fillRect(x + off, y, 26, 7);
        }
      }
      // mortar joints
      ctx.strokeStyle = "rgba(168,158,146,0.5)";
      ctx.lineWidth = 1;
      for (let y = 0; y <= s; y += 9) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y);
        ctx.stroke();
      }
      // grime wash near the base of the tile
      const grime = ctx.createLinearGradient(0, s * 0.7, 0, s);
      grime.addColorStop(0, "rgba(20,16,12,0)");
      grime.addColorStop(1, "rgba(20,16,12,0.35)");
      ctx.fillStyle = grime;
      ctx.fillRect(0, 0, s, s);

      const cw = s / cols;
      const rh = s / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * cw;
          const y = r * rh;
          // stone pier between bays (left edge of each bay)
          ctx.fillStyle = "#9a958a";
          ctx.fillRect(x, y, 7, rh);
          ctx.fillStyle = "rgba(40,36,30,0.5)";
          ctx.fillRect(x + 7, y, 2, rh);
          // punched window with stone lintel + sill
          const wx = x + cw * 0.24;
          const wy = y + rh * 0.18;
          const ww = cw * 0.56;
          const wh = rh * 0.58;
          ctx.fillStyle = "#b0aa9c";
          ctx.fillRect(wx - 4, wy - 8, ww + 8, 8); // lintel
          ctx.fillRect(wx - 4, wy + wh, ww + 8, 6); // sill
          const on = rnd() < lit;
          const warm = rnd() < 0.6;
          const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
          if (on) {
            g.addColorStop(0, warm ? "#ffe3b0" : "#d8e8f5");
            g.addColorStop(1, warm ? "#9a7040" : "#5a6f84");
          } else {
            g.addColorStop(0, "#3d4a58");
            g.addColorStop(1, "#12171e");
          }
          ctx.fillStyle = g;
          ctx.fillRect(wx, wy, ww, wh);
          // steel sash grid
          ctx.strokeStyle = on ? "rgba(40,30,20,0.8)" : "rgba(12,15,19,0.9)";
          ctx.lineWidth = 2;
          for (let k = 1; k < 3; k++) {
            ctx.beginPath();
            ctx.moveTo(wx + (ww * k) / 3, wy);
            ctx.lineTo(wx + (ww * k) / 3, wy + wh);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(wx, wy + wh / 2);
          ctx.lineTo(wx + ww, wy + wh / 2);
          ctx.stroke();
          // sky streak on dark glass
          if (!on) {
            ctx.fillStyle = "rgba(200,220,235,0.12)";
            ctx.fillRect(wx + 3, wy + 3, ww * 0.3, wh - 6);
          }
        }
      }
    },
    { srgb: true, seed },
  );
}

/**
 * Residential slab: protruding white concrete balcony bands, recessed dark
 * glass strips, scattered AC boxes. One tile = 4 bays × 3 floors.
 */
function slabTex(seed: number, lit: number) {
  const cols = 4;
  const rows = 3;
  return tex(
    512,
    [1, 1],
    (ctx, s, rnd) => {
      ctx.fillStyle = "#20262e";
      ctx.fillRect(0, 0, s, s);
      const cw = s / cols;
      const rh = s / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * cw;
          const y = r * rh;
          // recessed glass strip
          const on = rnd() < lit;
          const warm = rnd() < 0.5;
          const g = ctx.createLinearGradient(0, y + rh * 0.3, 0, y + rh * 0.78);
          if (on) {
            g.addColorStop(0, warm ? "#ffe9c2" : "#dcebf8");
            g.addColorStop(1, warm ? "#a8845a" : "#64798e");
          } else {
            g.addColorStop(0, "#4a5a6c");
            g.addColorStop(1, "#141a21");
          }
          ctx.fillStyle = g;
          ctx.fillRect(x + 3, y + rh * 0.3, cw - 6, rh * 0.48);
          // glass divider + curtain glint
          ctx.fillStyle = "rgba(12,15,19,0.85)";
          ctx.fillRect(x + cw / 2 - 1, y + rh * 0.3, 2, rh * 0.48);
          if (!on && rnd() < 0.5) {
            ctx.fillStyle = "rgba(220,232,242,0.14)";
            ctx.fillRect(x + 5, y + rh * 0.34, cw * 0.28, rh * 0.4);
          }
          // protruding balcony slab band (bright concrete + shadow under)
          ctx.fillStyle = "#cfd3d6";
          ctx.fillRect(x, y + rh * 0.78, cw, rh * 0.16);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(x, y + rh * 0.78, cw, 2);
          ctx.fillStyle = "rgba(10,13,17,0.65)";
          ctx.fillRect(x, y + rh * 0.94, cw, rh * 0.06);
          // railing hint above the slab
          ctx.fillStyle = "rgba(30,36,43,0.9)";
          ctx.fillRect(x + 2, y + rh * 0.78 - 5, cw - 4, 5);
          // AC box on some bays
          if (rnd() < 0.3) {
            ctx.fillStyle = "#9aa0a6";
            const ax = x + cw * (0.15 + rnd() * 0.5);
            ctx.fillRect(ax, y + rh * 0.6, cw * 0.2, rh * 0.14);
            ctx.fillStyle = "rgba(20,24,29,0.6)";
            ctx.fillRect(ax, y + rh * 0.6 + rh * 0.14 - 2, cw * 0.2, 2);
          }
        }
      }
    },
    { srgb: true, seed },
  );
}

/**
 * Art-deco limestone: strong vertical piers, small punched 2-over-2 windows,
 * spandrel ornament lines. Vertical emphasis reads Empire/Downtown at range.
 */
function decoTex(seed: number, lit: number) {
  const cols = 4;
  const rows = 3;
  return tex(
    512,
    [1, 1],
    (ctx, s, rnd) => {
      ctx.fillStyle = "#8f887c";
      ctx.fillRect(0, 0, s, s);
      // stone tone variation per course
      for (let y = 0; y < s; y += 22) {
        ctx.fillStyle = `rgba(${120 + rnd() * 40},${112 + rnd() * 36},${100 + rnd() * 30},0.25)`;
        ctx.fillRect(0, y, s, 20);
      }
      const cw = s / cols;
      const rh = s / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * cw;
          const y = r * rh;
          // pier (full-height vertical fin of limestone)
          const pg = ctx.createLinearGradient(x, 0, x + 16, 0);
          pg.addColorStop(0, "#6f675c");
          pg.addColorStop(0.5, "#b3aa9c");
          pg.addColorStop(1, "#6f675c");
          ctx.fillStyle = pg;
          ctx.fillRect(x, y, 16, rh);
          // window opening between piers
          const wx = x + 16 + (cw - 16) * 0.18;
          const ww = (cw - 16) * 0.64;
          const wy = y + rh * 0.22;
          const wh = rh * 0.52;
          const on = rnd() < lit;
          const warm = rnd() < 0.65;
          const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
          if (on) {
            g.addColorStop(0, warm ? "#ffedc8" : "#e0ecf6");
            g.addColorStop(1, warm ? "#a37c46" : "#5d7186");
          } else {
            g.addColorStop(0, "#46525f");
            g.addColorStop(1, "#10151b");
          }
          ctx.fillStyle = "#3a352e";
          ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
          ctx.fillStyle = g;
          ctx.fillRect(wx, wy, ww, wh);
          // 2-over-2 sash muntins
          ctx.strokeStyle = "rgba(20,22,26,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(wx + ww / 2, wy);
          ctx.lineTo(wx + ww / 2, wy + wh);
          ctx.moveTo(wx, wy + wh / 2);
          ctx.lineTo(wx + ww, wy + wh / 2);
          ctx.stroke();
          // spandrel ornament below the sill
          ctx.fillStyle = "rgba(60,54,46,0.7)";
          ctx.fillRect(wx - 3, wy + wh + 5, ww + 6, 4);
          ctx.fillStyle = "rgba(220,210,195,0.35)";
          ctx.fillRect(wx - 3, wy + wh + 5, ww + 6, 1.5);
        }
      }
    },
    { srgb: true, seed },
  );
}

/**
 * Storefront glass: bronze frame, mullions, warm interior with shelf +
 * silhouette hints. Painted mullions (not geometry) keep every retail band
 * to a single draw.
 */
function storefrontTex(warm: boolean) {
  return tex(
    512,
    [1, 1],
    (ctx, s, rnd) => {
      // interior glow
      const g = ctx.createLinearGradient(0, 0, 0, s);
      if (warm) {
        g.addColorStop(0, "#ffdf9f");
        g.addColorStop(0.6, "#c99a5e");
        g.addColorStop(1, "#5e4326");
      } else {
        g.addColorStop(0, "#d8e8f2");
        g.addColorStop(0.6, "#8fa8bd");
        g.addColorStop(1, "#33424f");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      // shelf lines + goods blobs
      for (let k = 0; k < 4; k++) {
        const y = s * (0.3 + k * 0.16);
        ctx.fillStyle = "rgba(40,28,16,0.55)";
        ctx.fillRect(0, y, s, 4);
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = `rgba(${40 + rnd() * 60},${30 + rnd() * 40},${20 + rnd() * 30},0.7)`;
          ctx.fillRect(
            rnd() * s,
            y - 14 - rnd() * 10,
            10 + rnd() * 16,
            14 + rnd() * 10,
          );
        }
      }
      // customer silhouettes
      for (let i = 0; i < 3; i++) {
        const x = rnd() * s;
        ctx.fillStyle = "rgba(25,20,16,0.75)";
        ctx.beginPath();
        ctx.arc(x, s * 0.52, 12, 0, 6.3);
        ctx.fill();
        ctx.fillRect(x - 14, s * 0.55, 28, s * 0.35);
      }
      // bronze mullions over everything
      ctx.fillStyle = "#241f18";
      for (let i = 0; i <= 6; i++) ctx.fillRect((s * i) / 6 - 3, 0, 6, s);
      ctx.fillRect(0, 0, s, 10);
      ctx.fillRect(0, s - 14, s, 14);
      ctx.fillRect(0, s * 0.12, s, 6);
      // glass sheen diagonal
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.save();
      ctx.translate(s * 0.3, 0);
      ctx.rotate(0.3);
      ctx.fillRect(0, 0, s * 0.12, s * 1.2);
      ctx.restore();
    },
    { srgb: true, seed: warm ? 77 : 78 },
  );
}

/** Dark louver band for mechanical/crown floors. */
function ventTex() {
  return tex(
    128,
    [4, 1],
    (ctx, s) => {
      ctx.fillStyle = "#1c2127";
      ctx.fillRect(0, 0, s, s);
      for (let y = 6; y < s; y += 16) {
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, y, s, 7);
        ctx.fillStyle = "rgba(160,175,190,0.35)";
        ctx.fillRect(0, y, s, 2);
      }
    },
    { srgb: true, seed: 5 },
  );
}

const facadeMaps = [
  facadeTex(211, "#5c7690", 0.42),
  facadeTex(307, "#48607a", 0.34),
  facadeTex(419, "#6b8399", 0.5),
  brickTex(523, 0.4),
];

const slabMaps = [slabTex(611, 0.42), slabTex(617, 0.36)];
const decoMaps = [decoTex(701, 0.45), decoTex(707, 0.38)];

const facadeCache = new Map<string, THREE.MeshStandardMaterial>();

/** One curtain-wall bay is 2.7 m wide by 3.6 m tall, everywhere. */
const BAY_W = 2.7 * 4;
const BAY_H = 3.6 * 3;

/**
 * Facade material for one neighbouring elevation, with the repeat derived from
 * the elevation size so bay width and floor height stay constant across the
 * whole neighbourhood.
 */
export function facadeFor(
  style: 0 | 1 | 2 | 3,
  width: number,
  height: number,
): THREE.MeshStandardMaterial {
  const key = `${style}|${width.toFixed(1)}|${height.toFixed(1)}`;
  const hit = facadeCache.get(key);
  if (hit) return hit;

  const src = facadeMaps[style] ?? facadeMaps[0];
  const brick = style === 3;
  let map: THREE.Texture | undefined;
  if (src) {
    map = src.clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(
      Math.max(1, Math.round(width / BAY_W)),
      Math.max(1, Math.round(height / BAY_H)),
    );
  }
  const mat = new THREE.MeshStandardMaterial({
    color: brick ? "#b99a86" : "#98a2af",
    map,
    emissive: "#dfe8f2",
    emissiveMap: map,
    // dusk grade: lit bays glow harder against the blue hour
    emissiveIntensity: brick ? 0.55 : 0.7,
    roughness: brick ? 0.8 : 0.36,
    metalness: brick ? 0.02 : 0.36,
  });
  capCache(facadeCache);
  facadeCache.set(key, mat);
  return mat;
}

/** Residential slab bay: 3.2 m wide, 3.0 m floor-to-floor. */
const SLAB_BAY_W = 3.2 * 4;
const SLAB_BAY_H = 3.0 * 3;

/** Residential slab facade — white concrete bands, recessed glass. */
export function slabFor(
  variant: 0 | 1,
  width: number,
  height: number,
): THREE.MeshStandardMaterial {
  const key = `slab${variant}|${width.toFixed(1)}|${height.toFixed(1)}`;
  const hit = facadeCache.get(key);
  if (hit) return hit;
  const src = slabMaps[variant] ?? slabMaps[0];
  let map: THREE.Texture | undefined;
  if (src) {
    map = src.clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(
      Math.max(1, Math.round(width / SLAB_BAY_W)),
      Math.max(1, Math.round(height / SLAB_BAY_H)),
    );
  }
  const mat = new THREE.MeshStandardMaterial({
    color: "#c9ced2",
    map,
    emissive: "#dfe8f2",
    emissiveMap: map,
    emissiveIntensity: 0.65,
    roughness: 0.6,
    metalness: 0.08,
  });
  capCache(facadeCache);
  facadeCache.set(key, mat);
  return mat;
}

/** Deco bay: 3.4 m pier spacing, 3.6 m floor-to-floor. */
const DECO_BAY_W = 3.4 * 4;
const DECO_BAY_H = 3.6 * 3;

/** Art-deco limestone facade — vertical piers, punched sash windows. */
export function decoFor(
  variant: 0 | 1,
  width: number,
  height: number,
): THREE.MeshStandardMaterial {
  const key = `deco${variant}|${width.toFixed(1)}|${height.toFixed(1)}`;
  const hit = facadeCache.get(key);
  if (hit) return hit;
  const src = decoMaps[variant] ?? decoMaps[0];
  let map: THREE.Texture | undefined;
  if (src) {
    map = src.clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(
      Math.max(1, Math.round(width / DECO_BAY_W)),
      Math.max(1, Math.round(height / DECO_BAY_H)),
    );
  }
  const mat = new THREE.MeshStandardMaterial({
    color: "#b5ac9e",
    map,
    emissive: "#e8ddc4",
    emissiveMap: map,
    emissiveIntensity: 0.6,
    roughness: 0.75,
    metalness: 0.02,
  });
  capCache(facadeCache);
  facadeCache.set(key, mat);
  return mat;
}

/** Louvered mechanical band material (shared singleton). */
let ventMat: THREE.MeshStandardMaterial | null = null;
export function ventFor(): THREE.MeshStandardMaterial {
  if (!ventMat) {
    const map = ventTex();
    if (map) {
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(10, 1);
    }
    ventMat = new THREE.MeshStandardMaterial({
      color: "#8b95a1",
      map: map ?? undefined,
      roughness: 0.6,
      metalness: 0.5,
    });
  }
  return ventMat;
}

/** Painted storefront glass (shared per warmth — one texture each). */
const storefrontCache = new Map<boolean, THREE.MeshBasicMaterial>();
export function storefrontFor(warm: boolean): THREE.MeshBasicMaterial {
  const hit = storefrontCache.get(warm);
  if (hit) return hit;
  const map = storefrontTex(warm);
  const mat = new THREE.MeshBasicMaterial({
    map: map ?? undefined,
    toneMapped: false,
  });
  storefrontCache.set(warm, mat);
  return mat;
}

/** Texture handed to the lobby's reflective floor. */
export const LOBBY_FLOOR_MAP = tileTex;
