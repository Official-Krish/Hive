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
  tex.anisotropy = 8;
  return tex;
}

/** Backlit corridor blade face: accent square + room name on near-black. */
export function bladeTexture(
  label: string,
  accent: string,
): THREE.CanvasTexture {
  const key = `blade:${label}:${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [el, ctx] = canvas(512, 116);
  ctx.clearRect(0, 0, 512, 116);
  // accent square
  ctx.fillStyle = accent;
  ctx.fillRect(28, 30, 56, 56);
  // label
  ctx.fillStyle = "#e8eaf0";
  ctx.font = "600 44px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), 108, 62, 380);
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}

/** Pod door plate: dark plate, light name, accent underline. */
export function plateTexture(
  name: string,
  accent: string,
): THREE.CanvasTexture {
  const key = `plate:${name}:${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [el, ctx] = canvas(512, 112);
  ctx.clearRect(0, 0, 512, 112);
  ctx.fillStyle = "#dfe3ec";
  ctx.font = "600 40px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  // shrink-to-fit for long names
  let size = 40;
  while (ctx.measureText(name.toUpperCase()).width > 470 && size > 20) {
    size -= 2;
    ctx.font = `600 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  }
  ctx.fillText(name.toUpperCase(), 24, 48, 470);
  ctx.fillStyle = accent;
  ctx.fillRect(24, 82, 120, 6);
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
export function directoryTexture(rows: DirectoryRow[]): THREE.CanvasTexture {
  const key = `dir:${rows.map((r) => r.name).join("|")}`;
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
  ctx.fillText("●  YOU ARE HERE — RECEPTION", 48, 972);
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}

/** Faint marker scribbles for whiteboard faces. */
export function whiteboardTexture(): THREE.CanvasTexture {
  const key = "whiteboard:scribble-v1";
  const hit = cache.get(key);
  if (hit) return hit;
  const [el, ctx] = canvas(1024, 640);
  ctx.fillStyle = "#f7f8fa";
  ctx.fillRect(0, 0, 1024, 640);
  ctx.lineCap = "round";
  const ink = (color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
  };
  // headline underline + circle annotation
  ink("#3b4252", 7);
  ctx.beginPath();
  ctx.moveTo(80, 130);
  ctx.lineTo(560, 118);
  ctx.stroke();
  ink("#2563eb", 6);
  ctx.beginPath();
  ctx.ellipse(700, 220, 130, 80, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  // checkbox list
  const items: boolean[] = [true, true, false];
  items.forEach((done, k) => {
    const y = 250 + k * 90;
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
    const w = [300, 220, 360][k] ?? 240;
    ctx.beginPath();
    ctx.moveTo(150, y - 12);
    ctx.lineTo(150 + w, y - 12);
    ctx.stroke();
  });
  // flow arrows
  ink("#7c3aed", 6);
  ctx.beginPath();
  ctx.moveTo(620, 420);
  ctx.quadraticCurveTo(720, 380, 820, 440);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(820, 440);
  ctx.lineTo(792, 436);
  ctx.moveTo(820, 440);
  ctx.lineTo(800, 462);
  ctx.stroke();
  ink("#d97706", 5);
  ctx.beginPath();
  ctx.moveTo(120, 520);
  ctx.lineTo(420, 500);
  ctx.stroke();
  const tex = toTexture(el);
  cache.set(key, tex);
  return tex;
}
