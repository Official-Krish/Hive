import { Html } from "@react-three/drei";
import { parseYouTubeUrl } from "@hive/types";
import { PODIUM_SCREEN } from "./office/layout";

// Same CSS-3D calibration as the chill screen: 100px per metre.
const PX_PER_M = 100;
const SURFACE_Z = PODIUM_SCREEN.z - 0.09;

/**
 * Turn any shared URL into something an iframe can show. YouTube links
 * become privacy-friendly embeds; everything else (photos, videos, pages)
 * loads raw. Sites that forbid framing still fail closed in the frame —
 * the modal always offers "open in a new tab" as the fallback.
 */
export function toScreenEmbedUrl(raw: string): string | null {
  const s = raw.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  const yt = parseYouTubeUrl(s);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt.videoId}`;
  return s;
}

/**
 * Full-wall screen behind the podium mic. A plain iframe in drei's CSS-3D
 * renderer inherits the wall's real world transform, so camera motion
 * cannot slide it off the wall. Unmounted while idle (no URL set).
 */
export function PodiumScreenProjection({ url }: { url: string | null }) {
  if (!url) return null;
  const src = toScreenEmbedUrl(url);
  if (!src) return null;
  return (
    <Html
      transform
      position={[PODIUM_SCREEN.x, PODIUM_SCREEN.y, SURFACE_Z]}
      rotation={PODIUM_SCREEN.rotation}
      scale={0.4}
      // Beneath the React modal layer (z-40).
      zIndexRange={[0, 0]}
      style={{
        width: `${PODIUM_SCREEN.w * PX_PER_M}px`,
        height: `${PODIUM_SCREEN.h * PX_PER_M}px`,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <iframe
        title="Podium wall screen"
        src={src}
        style={{ width: "100%", height: "100%", border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </Html>
  );
}
