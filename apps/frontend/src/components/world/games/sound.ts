/* Tiny WebAudio synth for board feedback — no assets, lazy context. */

export type BoardSound =
  "select" | "move" | "capture" | "check" | "notify" | "drop";

const MUTE_KEY = "hive.board-muted";

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isBoardMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBoardMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* private mode */
  }
}

function blip(
  c: AudioContext,
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  gain: number,
): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + at);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + at);
  osc.stop(c.currentTime + at + dur + 0.02);
}

export function playBoardSound(kind: BoardSound): void {
  if (isBoardMuted()) return;
  const c = ac();
  if (!c) return;
  switch (kind) {
    case "select":
      blip(c, 660, 0, 0.07, "sine", 0.12);
      break;
    case "move":
      blip(c, 440, 0, 0.09, "triangle", 0.18);
      blip(c, 330, 0.03, 0.08, "triangle", 0.1);
      break;
    case "capture":
      blip(c, 220, 0, 0.12, "sawtooth", 0.14);
      blip(c, 147, 0.05, 0.14, "triangle", 0.16);
      break;
    case "check":
      blip(c, 880, 0, 0.1, "square", 0.06);
      blip(c, 880, 0.14, 0.1, "square", 0.06);
      break;
    case "notify":
      blip(c, 523, 0, 0.12, "sine", 0.14);
      blip(c, 784, 0.1, 0.16, "sine", 0.14);
      break;
    case "drop":
      blip(c, 392, 0, 0.08, "triangle", 0.16);
      break;
  }
}
