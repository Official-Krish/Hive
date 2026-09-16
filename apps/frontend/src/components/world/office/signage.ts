import * as THREE from "three";

/* ─────────────────────────────────────────────────────────────
   SIGNAGE — procedural canvas text textures for wayfinding.
   Same technique as materials.ts (no network, no font loading):
   system grotesk + mono, sRGB, high anisotropy for crisp reads
   at distance. Textures are cached per key — one upload each.
   ───────────────────────────────────────────────────────────── */

const cache = new Map<string, THREE.CanvasTexture>();

function canvas(
  w: number,
  h: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d")!;
  return [el, ctx];
}

function toTexture(el: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

/** Backlit corridor blade face: accent square + room name on near-black.
 *  640×128 canvas maps to the 1.7×0.34m blade without stretch. */
export function bladeTexture(
  label: string,
  accent: string,
): THREE.CanvasTexture {
  const key = `blade:v2:${label}:${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [el, ctx] = canvas(640, 128);
  ctx.clearRect(0, 0, 640, 128);
  // solid near-black plate so the sign reads at distance
  ctx.fillStyle = "#101318";
  ctx.fillRect(0, 0, 640, 128);
  // accent square
  ctx.fillStyle = accent;
  ctx.fillRect(30, 32, 64, 64);
  // label
  ctx.fillStyle = "#f2f4f8";
  ctx.font = "700 52px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), 120, 68, 490);
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}

/** Pod door plate: dark plate, light name, accent underline + dot.
 *  640×160 canvas maps to the 1.1×0.275m plate; min 28px keeps long
 *  names legible past 6m. */
export function plateTexture(
  name: string,
  accent: string,
): THREE.CanvasTexture {
  const key = `plate:v2:${name}:${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [el, ctx] = canvas(640, 160);
  ctx.clearRect(0, 0, 640, 160);
  ctx.fillStyle = "#dfe3ec";
  ctx.font = "700 52px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  // shrink-to-fit for long names, floored for distance legibility
  let size = 52;
  while (ctx.measureText(name.toUpperCase()).width > 590 && size > 28) {
    size -= 2;
    ctx.font = `700 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  }
  ctx.fillText(name.toUpperCase(), 28, 66, 590);
  ctx.fillStyle = accent;
  ctx.fillRect(28, 116, 150, 8);
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}

export interface DirectoryRow {
  name: string;
  accent: string;
  note?: string;
}

/** Lobby directory totem face: title + zone rows + you-are-here. */
export function directoryTexture(
  rows: DirectoryRow[],
  footer = "●  YOU ARE HERE — RECEPTION",
): THREE.CanvasTexture {
  const key = `dir:v2:${footer}:${rows.map((r) => r.name).join("|")}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [el, ctx] = canvas(512, 1024);
  // dark totem face
  ctx.fillStyle = "#14171d";
  ctx.fillRect(0, 0, 512, 1024);
  // hairline frame
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 996);
  // title block
  ctx.fillStyle = "#f2f4f8";
  ctx.font = "700 52px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("HIVE", 48, 96);
  ctx.fillStyle = "#8b93a5";
  ctx.font = "500 26px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("CAMPUS DIRECTORY", 48, 138);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(48, 168, 416, 2);
  // rows
  let y = 232;
  for (const row of rows) {
    ctx.fillStyle = row.accent;
    ctx.beginPath();
    ctx.arc(66, y - 8, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6e9f0";
    ctx.font = "600 30px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText(row.name.toUpperCase(), 96, y, 340);
    if (row.note) {
      ctx.fillStyle = "#8b93a5";
      ctx.font = "500 22px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.fillText(row.note.toUpperCase(), 96, y + 32);
    }
    y += row.note ? 92 : 72;
  }
  // you-are-here footer
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(48, 930, 416, 2);
  ctx.fillStyle = "#f2f4f8";
  ctx.font = "600 26px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(footer, 48, 972);
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}

/** Neighbour marquee: tenant name on near-black, 8:1 canvas for the sign band. */
const MARQUEE_NAMES = [
  "NORTHGATE",
  "FOUNDRY",
  "MERIDIAN",
  "ATLAS",
  "KESTREL",
  "FOUNDRY EAST",
  "HALCYON",
  "VANTAGE",
];
export function marqueeTexture(
  index: number,
  accent: string,
): THREE.CanvasTexture {
  const name = MARQUEE_NAMES[index % MARQUEE_NAMES.length]!;
  const key = `marquee:${name}:${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [el, ctx] = canvas(1024, 128);
  ctx.fillStyle = "#101318";
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = accent;
  ctx.fillRect(36, 38, 52, 52);
  ctx.fillStyle = "#eef1f6";
  ctx.font = "700 64px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 116, 68, 870);
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}
/** Courtyard monument face: Hive mark (pillars + nodes) + HIVE wordmark.
 *  1024×256 canvas maps to the 3.6×0.9m face without stretch. */
export function monumentTexture(): THREE.CanvasTexture {
  const key = "monument:hive-v1";
  const hit = cache.get(key);
  if (hit) return hit;
  const [el, ctx] = canvas(1024, 256);
  ctx.clearRect(0, 0, 1024, 256);
  // mark — five nodes converging on a hub, H in negative space (see HiveMark)
  const k = 2.5;
  const ox = 70;
  const oy = 48;
  ctx.strokeStyle = "#eaf6ff";
  ctx.fillStyle = "#eaf6ff";
  ctx.lineWidth = 6 * k;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(125,211,252,0.8)";
  ctx.shadowBlur = 24;
  const px = (v: number) => ox + v * k;
  const py = (v: number) => oy + v * k;
  ctx.beginPath();
  ctx.moveTo(px(18), py(16));
  ctx.lineTo(px(18), py(48));
  ctx.moveTo(px(46), py(16));
  ctx.lineTo(px(46), py(48));
  ctx.moveTo(px(18), py(29));
  ctx.lineTo(px(46), py(29));
  ctx.stroke();
  for (const [cx, cy, r] of [
    [18, 16, 7],
    [18, 48, 7],
    [46, 16, 7],
    [46, 48, 7],
    [32, 29, 9],
  ] as const) {
    ctx.beginPath();
    ctx.arc(px(cx), py(cy), r * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // wordmark
  ctx.fillStyle = "#f2f4f8";
  ctx.font = "800 118px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = "14px";
  } catch {
    /* older canvas — plain tracking */
  }
  ctx.fillText("HIVE", 300, 140);
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}

/** Faint marker scribbles for whiteboard faces. `variant` shuffles the
 *  composition so neighbouring boards don't show identical scribbles. */
export function whiteboardTexture(variant = 0): THREE.CanvasTexture {
  const key = `whiteboard:scribble-v2:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const seed = variant * 101 + 7;
  const rnd = (() => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  const [el, ctx] = canvas(1024, 640);
  ctx.fillStyle = "#f7f8fa";
  ctx.fillRect(0, 0, 1024, 640);
  ctx.lineCap = "round";
  const ink = (color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
  };
  // headline underline + circle annotation (position varies per variant)
  const hx = 80 + (variant % 2) * 120;
  const cx0 = 700 - variant * 90;
  ink("#3b4252", 7);
  ctx.beginPath();
  ctx.moveTo(hx, 130);
  ctx.lineTo(hx + 480, 118 + variant * 8);
  ctx.stroke();
  ink(variant % 2 ? "#7c3aed" : "#2563eb", 6);
  ctx.beginPath();
  ctx.ellipse(cx0, 220, 130 - variant * 12, 80, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  // checkbox list (count + widths vary)
  const n = 2 + (variant % 2);
  for (let k = 0; k < n; k++) {
    const y = 250 + k * 100;
    const done = (k + variant) % 3 !== 2;
    ink("#3b4252", 5);
    ctx.strokeRect(80, y - 34, 44, 44);
    if (done) {
      ink("#059669", 7);
      ctx.beginPath();
      ctx.moveTo(88, y - 12);
      ctx.lineTo(100, y);
      ctx.lineTo(118, y - 26);
      ctx.stroke();
    }
    ink("rgba(59,66,82,0.55)", 6);
    const w = 200 + rnd() * 220;
    ctx.beginPath();
    ctx.moveTo(150, y - 12);
    ctx.lineTo(150 + w, y - 12);
    ctx.stroke();
  }
  // flow arrows (direction flips on odd variants)
  ink("#7c3aed", 6);
  const flip = variant % 2 === 1;
  ctx.beginPath();
  if (!flip) {
    ctx.moveTo(620, 420);
    ctx.quadraticCurveTo(720, 380, 820, 440);
  } else {
    ctx.moveTo(820, 420);
    ctx.quadraticCurveTo(720, 460, 620, 400);
  }
  ctx.stroke();
  ink("#d97706", 5);
  ctx.beginPath();
  ctx.moveTo(120, 520 - variant * 30);
  ctx.lineTo(420 + variant * 60, 500);
  ctx.stroke();
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}
