import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { GALLERY_FRAMES, type GalleryFrame } from "./layout";
import { M } from "./materials";

/* ─────────────────────────────────────────────────────────────
   COMMUNITY GALLERY — 8 shared frames anyone can fill with an
   image link (or clear). WorldCanvas syncs the hub state into the
   module store below; these meshes just render it. Arbitrary hosts
   often block hotlinking (no CORS) — failed loads fall back to a
   blank canvas instead of breaking the wall.
   ───────────────────────────────────────────────────────────── */

type GalleryState = Record<string, string | null>;

let snapshot: GalleryState = {};
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function setGalleryFrame(frameId: string, imageUrl: string | null) {
  snapshot = { ...snapshot, [frameId]: imageUrl };
  notify();
}

export function setGalleryState(
  frames: Array<{ frameId: string; imageUrl: string | null }>,
) {
  snapshot = Object.fromEntries(frames.map((f) => [f.frameId, f.imageUrl]));
  notify();
}

export function useGalleryStore(): GalleryState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => snapshot,
  );
}

const texCache = new Map<string, THREE.Texture | null>();

function useGalleryTexture(url: string | null): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(() =>
    url ? (texCache.get(url) ?? null) : null,
  );
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    if (texCache.has(url)) {
      setTex(texCache.get(url) ?? null);
      return;
    }
    let live = true;
    new THREE.TextureLoader()
      .setCrossOrigin("anonymous")
      .loadAsync(url)
      .then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        texCache.set(url, t);
        if (live) setTex(t);
      })
      .catch(() => {
        texCache.set(url, null);
        if (live) setTex(null);
      });
    return () => {
      live = false;
    };
  }, [url]);
  return tex;
}

function GalleryFrameMesh({ frame }: { frame: GalleryFrame }) {
  const gallery = useGalleryStore();
  const url = gallery[frame.id] ?? null;
  const tex = useGalleryTexture(url);
  const [w, h] = frame.size;
  const face = useMemo(
    () =>
      tex
        ? new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.85,
            metalness: 0,
          })
        : M.wallAccent,
    [tex],
  );
  useEffect(() => {
    return () => {
      if (tex && face !== M.wallAccent) face.dispose();
    };
  }, [face, tex]);
  return (
    <group position={frame.position} rotation={frame.rotation}>
      {/* walnut frame */}
      <mesh castShadow>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.06]} />
        <primitive object={M.walnut} attach="material" />
      </mesh>
      {/* image face (blank canvas when empty or unloadable) */}
      <mesh position={[0, 0, 0.036]}>
        <planeGeometry args={[w, h]} />
        <primitive object={face} attach="material" />
      </mesh>
    </group>
  );
}

export function GalleryFrames() {
  return (
    <group name="gallery-frames">
      {GALLERY_FRAMES.map((f) => (
        <GalleryFrameMesh key={f.id} frame={f} />
      ))}
    </group>
  );
}
