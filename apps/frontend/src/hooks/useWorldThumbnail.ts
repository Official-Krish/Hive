import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { http } from "@/lib/http";

const INTERVAL_MS = 5 * 60 * 1000;
/** First capture lands quickly so new floors get a cover fast. */
const FIRST_DELAY_MS = 30 * 1000;
const WIDTH = 640;
/** Mean per-pixel drift (0-255) that counts as a new scene worth uploading. */
const DRIFT_THRESHOLD = 6;
/** Below this mean luminance the read is a cleared buffer, not a scene. */
const BLACK_THRESHOLD = 10;

function readPixels(
  source: HTMLCanvasElement,
): { canvas: HTMLCanvasElement; sig: Uint8ClampedArray } | null {
  const scale = WIDTH / Math.max(1, source.width);
  const full = document.createElement("canvas");
  full.width = WIDTH;
  full.height = Math.max(1, Math.round(source.height * scale));
  const ctx = full.getContext("2d");
  if (!ctx) return null;
  // Must run synchronously in the same task as gl.render — the drawing
  // buffer is only valid until the frame is presented.
  ctx.drawImage(source, 0, 0, full.width, full.height);
  const tiny = document.createElement("canvas");
  tiny.width = 32;
  tiny.height = 32;
  const tctx = tiny.getContext("2d", { willReadFrequently: true });
  if (!tctx) return null;
  tctx.drawImage(full, 0, 0, 32, 32);
  try {
    return { canvas: full, sig: tctx.getImageData(0, 0, 32, 32).data };
  } catch {
    return null;
  }
}

function luminance(sig: Uint8ClampedArray): number {
  let sum = 0;
  const n = sig.length / 4;
  for (let i = 0; i < sig.length; i += 4) {
    sum += (sig[i]! + sig[i + 1]! + sig[i + 2]!) / 3;
  }
  return sum / Math.max(1, n);
}

function drift(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 4) {
    sum +=
      Math.abs(a[i]! - b[i]!) +
      Math.abs(a[i + 1]! - b[i + 1]!) +
      Math.abs(a[i + 2]! - b[i + 2]!);
  }
  return sum / Math.max(1, (n / 4) * 3);
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.72),
  );
}

/**
 * Renders nothing. Lives inside the R3F <Canvas> and takes over the render
 * loop (priority > 0 disables R3F auto-render): every frame is rendered
 * manually, and when a capture is due the pixels are read synchronously
 * right after gl.render — the only moment the buffer is guaranteed valid
 * without preserveDrawingBuffer.
 *
 * Uploads every INTERVAL_MS plus once on unmount (world exit). Skips hidden
 * tabs, black reads, and near-identical frames so idle offices and bad
 * reads never churn S3 or overwrite a good cover.
 */
export function ThumbnailCapture({ workspaceId }: { workspaceId: string }) {
  const gl = useThree((s) => s.gl);
  const lastAt = useRef(0);
  const lastSig = useRef<Uint8ClampedArray | null>(null);
  const inFlight = useRef(false);
  const wsId = useRef(workspaceId);
  wsId.current = workspaceId;

  const upload = async (
    canvas: HTMLCanvasElement,
    sig: Uint8ClampedArray,
    keepalive: boolean,
  ): Promise<void> => {
    if (inFlight.current) return;
    if (luminance(sig) < BLACK_THRESHOLD) return;
    if (
      lastSig.current &&
      drift(lastSig.current, sig) < DRIFT_THRESHOLD &&
      !keepalive
    ) {
      return;
    }
    inFlight.current = true;
    try {
      const blob = await toJpeg(canvas);
      if (!blob) return;
      lastSig.current = sig;
      await http.workspaces.uploadThumbnail(wsId.current, blob, keepalive);
    } catch {
      /* thumbnails are best-effort — never interrupt the world */
    } finally {
      inFlight.current = false;
    }
  };

  useFrame(({ gl: frameGl, scene, camera }) => {
    frameGl.render(scene, camera);
    const now = Date.now();
    if (now - lastAt.current < INTERVAL_MS) return;
    if (typeof document !== "undefined" && document.hidden) return;
    lastAt.current = now;
    const shot = readPixels(frameGl.domElement);
    if (!shot) return;
    void upload(shot.canvas, shot.sig, false);
  }, 1);

  useEffect(() => {
    lastAt.current = Date.now() - INTERVAL_MS + FIRST_DELAY_MS;
    return () => {
      try {
        const shot = readPixels(gl.domElement);
        if (shot) void upload(shot.canvas, shot.sig, true);
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}

export default ThumbnailCapture;
