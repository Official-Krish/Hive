import { useMemo } from "react";
import { useGLTF, Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import { kitUrl, KIT_SCALE, KIT_YAW, type KitModelKey } from "./kitManifest";
import type { TransformData } from "../InstancedFurniture";

interface BakedPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

interface KitInstancesProps {
  model: KitModelKey;
  items: TransformData[];
  /** Extra lift on top of auto-grounding (e.g. screens sit on desk tops). */
  yOffset?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  name?: string;
}

/**
 * Renders a Kenney kit GLB at every `items` transform with one `<Instances>`
 * draw per source mesh part. Handles multi-mesh GLBs, inconsistent origins
 * (corner vs center, Y offsets) and dollhouse scale:
 * - geometries are cloned, baked with node transforms, XZ-centered and
 *   Y-grounded from the measured scene bbox, so feet sit at `position.y`.
 * - per-instance scale comes from `KIT_SCALE[model]` (+ item.scale).
 * - never mutates the useGLTF cache (geometries are cloned before baking).
 */
export function KitInstances({
  model,
  items,
  yOffset = 0,
  castShadow = true,
  receiveShadow = true,
  name,
}: KitInstancesProps) {
  const gltf = useGLTF(kitUrl(model));

  const parts = useMemo<BakedPart[]>(() => {
    const scene = gltf.scene;
    scene.updateWorldMatrix(true, true);
    const bbox = new THREE.Box3().setFromObject(scene);
    const cx = (bbox.min.x + bbox.max.x) / 2;
    const cz = (bbox.min.z + bbox.max.z) / 2;
    const minY = bbox.min.y;
    const out: BakedPart[] = [];
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mesh = obj as THREE.Mesh;
      const src = mesh.geometry as THREE.BufferGeometry;
      if (!src) return;
      const geo = src.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      // Normalize: center XZ, ground Y.
      geo.translate(-cx, -minY, -cz);
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      // InstancedMesh supports a single material — Kenney parts are single
      // materials; if a part ever carries an array, keep the first.
      const mat = Array.isArray(mesh.material)
        ? (mesh.material[0] as THREE.Material)
        : (mesh.material as THREE.Material);
      if (!mat) return;
      out.push({ geometry: geo, material: mat });
    });
    return out;
  }, [gltf]);

  const baseScale = KIT_SCALE[model];
  const yawFix = KIT_YAW[model];

  // Decompose item transforms once (instances count is static per mount).
  const placements = useMemo(
    () =>
      items.map((t) => {
        const p = t.position;
        const r = t.rotation ?? [0, 0, 0];
        const s = t.scale ?? [1, 1, 1];
        return {
          position: [p[0], p[1] + yOffset, p[2]] as [number, number, number],
          rotation: [r[0], r[1] + yawFix, r[2]] as [number, number, number],
          scale: [
            baseScale[0] * s[0],
            baseScale[1] * s[1],
            baseScale[2] * s[2],
          ] as [number, number, number],
        };
      }),
    [items, yOffset, yawFix, baseScale],
  );

  if (items.length === 0 || parts.length === 0) return null;

  return (
    <group name={name ?? `kit-${model}`}>
      {parts.map((part, pi) => (
        <Instances
          key={pi}
          limit={placements.length}
          range={placements.length}
          geometry={part.geometry}
          material={part.material}
          frustumCulled={false}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        >
          {placements.map((pl, i) => (
            <Instance
              key={i}
              position={pl.position}
              rotation={pl.rotation}
              scale={pl.scale}
            />
          ))}
        </Instances>
      ))}
    </group>
  );
}

interface KitPieceProps {
  model: KitModelKey;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scaleMul?: number;
  yOffset?: number;
  castShadow?: boolean;
}

/** Single-placement kit model (dressing props, pod chairs, appliances). */
export function KitPiece({
  model,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scaleMul = 1,
  yOffset = 0,
  castShadow = true,
}: KitPieceProps) {
  const gltf = useGLTF(kitUrl(model));
  const baseScale = KIT_SCALE[model];
  const yawFix = KIT_YAW[model];

  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const bbox = new THREE.Box3().setFromObject(clone);
    const cx = (bbox.min.x + bbox.max.x) / 2;
    const cz = (bbox.min.z + bbox.max.z) / 2;
    const minY = bbox.min.y;
    const inner = new THREE.Group();
    inner.position.set(-cx, -minY, -cz);
    // Move children into the normalizing wrapper (keeps materials/shadows).
    while (clone.children.length > 0) {
      const child = clone.children[0];
      if (child) inner.add(child);
    }
    clone.add(inner);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf, castShadow]);

  return (
    <group
      position={[position[0], position[1] + yOffset, position[2]]}
      rotation={[rotation[0], rotation[1] + yawFix, rotation[2]]}
      scale={[
        baseScale[0] * scaleMul,
        baseScale[1] * scaleMul,
        baseScale[2] * scaleMul,
      ]}
    >
      <primitive object={scene} />
    </group>
  );
}
