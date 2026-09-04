import { useMemo } from "react";
import type * as THREE from "three";
import { Instances, Instance } from "@react-three/drei";
import { InstancedFurniture } from "../InstancedFurniture";
import { M, floorFor } from "./materials";
import { plateTexture } from "./signage";
import {
  ROOMS_L2,
  WALLS_L2,
  POD_WALLS,
  BALUSTRADES,
  PODS,
  POD_DESKS,
  POD_TABLES,
  L2_DESKS,
  L2_DESK_CHAIRS,
  L2_MONITORS,
  L2_SOFAS,
  L2_TABLES,
  L2_PLANTS,
  L2_Y,
  POD_H,
  MEZZ,
  type Pod,
  type Wall,
} from "./layout";

/** One instanced part: unit-cube transform. */
interface Part {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

/**
 * Every glazed partition upstairs — pod enclosures, gallery screens and atrium
 * balustrades — batched into four instanced draws instead of ~500 meshes. The
 * upper floor has a lot of glass; drawing it per-segment was the single biggest
 * draw-call cost in the scene.
 */
function GlazingBatch({ walls }: { walls: Wall[] }) {
  const parts = useMemo(() => {
    const glass: Part[] = [];
    const rails: Part[] = [];
    const posts: Part[] = [];
    const caps: Part[] = [];
    for (const w of walls) {
      const horizontal = Math.abs(w.z1 - w.z0) < 1e-6;
      const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      if (len < 0.06) continue;
      const cx = (w.x0 + w.x1) / 2;
      const cz = (w.z0 + w.z1) / 2;
      const base = w.base ?? 0;
      const rot: [number, number, number] = [
        0,
        horizontal ? 0 : Math.PI / 2,
        0,
      ];
      const thin = w.h < 1.4; // balustrade rather than a full partition

      glass.push({
        position: [cx, base + w.h / 2, cz],
        rotation: rot,
        scale: [len, w.h - 0.16, 0.05],
      });
      for (const y of [base + 0.07, base + w.h - 0.07]) {
        rails.push({
          position: [cx, y, cz],
          rotation: rot,
          scale: [len, 0.13, 0.12],
        });
      }
      // Vertical posts on a wide grid — glass partitions read cleanly with
      // fewer, slimmer mullions than a curtain wall needs.
      const count = Math.max(1, Math.round(len / 4.2));
      for (let i = 0; i <= count; i++) {
        const t = -len / 2 + (len * i) / count;
        posts.push({
          position: [
            cx + (horizontal ? t : 0),
            base + w.h / 2,
            cz + (horizontal ? 0 : t),
          ],
          rotation: rot,
          scale: [0.08, w.h, 0.11],
        });
      }
      if (thin) {
        caps.push({
          position: [cx, base + w.h + 0.04, cz],
          rotation: rot,
          scale: [len + 0.1, 0.08, 0.14],
        });
      }
    }
    return { glass, rails, posts, caps };
  }, [walls]);

  const groups: [Part[], THREE.Material][] = [
    [parts.glass, M.glassCheap],
    [parts.rails, M.blackAnodized],
    [parts.posts, M.mullion],
    [parts.caps, M.metalBrushed],
  ];

  return (
    <>
      {groups.map(([items, mat], gi) =>
        items.length === 0 ? null : (
          <Instances key={gi} range={items.length} limit={items.length}>
            <boxGeometry args={[1, 1, 1]} />
            <primitive object={mat} attach="material" />
            {items.map((p, i) => (
              <Instance
                key={i}
                position={p.position}
                rotation={p.rotation}
                scale={p.scale}
              />
            ))}
          </Instances>
        ),
      )}
    </>
  );
}

/** Executive desk: walnut top on a raking steel base, plus a return credenza. */
function ExecDesk({
  position,
  rotation,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.08, 1.0]} />
        <primitive object={M.walnut} attach="material" />
      </mesh>
      {[-1.05, 1.05].map((dx) => (
        <mesh key={dx} position={[dx, 0.37, 0]} castShadow>
          <boxGeometry args={[0.1, 0.72, 0.85]} />
          <primitive object={M.metalDark} attach="material" />
        </mesh>
      ))}
      {/* modesty panel */}
      <mesh position={[0, 0.42, -0.42]}>
        <boxGeometry args={[2.1, 0.5, 0.05]} />
        <primitive object={M.felt} attach="material" />
      </mesh>
      {/* laptop + monitor */}
      <mesh position={[0, 0.98, -0.22]} castShadow>
        <boxGeometry args={[0.72, 0.42, 0.03]} />
        <primitive object={M.screen} attach="material" />
      </mesh>
      <mesh position={[0, 0.8, -0.22]}>
        <boxGeometry args={[0.12, 0.14, 0.12]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={[0.55, 0.79, 0.2]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.24, 0.02]} />
        <primitive object={M.screen} attach="material" />
      </mesh>
      {/* task chair */}
      <group position={[0, 0, 1.05]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.58, 0.1, 0.56]} />
          <primitive object={M.chairFabric} attach="material" />
        </mesh>
        <mesh position={[0, 0.78, 0.24]} rotation={[0.14, 0, 0]} castShadow>
          <boxGeometry args={[0.54, 0.62, 0.08]} />
          <primitive object={M.chairFabric} attach="material" />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.44, 10]} />
          <primitive object={M.blackAnodized} attach="material" />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.06, 12]} />
          <primitive object={M.metalDark} attach="material" />
        </mesh>
      </group>
      {/* credenza behind */}
      <mesh position={[0, 0.32, -1.35]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.64, 0.5]} />
        <primitive object={M.oak} attach="material" />
      </mesh>
      <mesh position={[0, 0.67, -1.35]}>
        <boxGeometry args={[2.26, 0.05, 0.56]} />
        <primitive object={M.stoneCounter} attach="material" />
      </mesh>
    </group>
  );
}

/** Boardroom / huddle table sized to its pod, with seating and an AV puck. */
function PodTable({
  center,
  size,
  seats,
}: {
  center: [number, number, number];
  size: [number, number];
  seats: number;
}) {
  const [w, d] = size;
  const cols = Array.from(
    { length: seats },
    (_, i) => -w / 2 + (w * (i + 0.5)) / seats,
  );
  return (
    <group position={center}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.09, d]} />
        <primitive object={M.walnut} attach="material" />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[w * 0.7, 0.7, Math.max(0.35, d * 0.4)]} />
        <primitive object={M.metalDark} attach="material" />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[Math.min(0.6, w * 0.3), 0.03, 0.18]} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {cols.map((x) =>
        [-1, 1].map((s) => (
          <group key={`${x}-${s}`} position={[x, 0, s * (d / 2 + 0.42)]}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[0.5, 0.09, 0.48]} />
              <primitive object={M.chairFabric} attach="material" />
            </mesh>
            <mesh
              position={[0, 0.75, s * 0.2]}
              rotation={[s * -0.12, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.48, 0.56, 0.07]} />
              <primitive object={M.chairFabric} attach="material" />
            </mesh>
            <mesh position={[0, 0.21, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.42, 8]} />
              <primitive object={M.blackAnodized} attach="material" />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

/** Door head, jambs, accent signage plate and a floor threshold for one pod. */
function PodTrim({ pod }: { pod: Pod }) {
  const [x0, x1, z0, z1] = pod.rect;
  const base = pod.level === 2 ? L2_Y : 0;
  const { side, at, width } = pod.door;
  const horizontal = side === "n" || side === "s";
  const z = side === "n" ? z0 : z1;
  const x = side === "w" ? x0 : x1;
  const cx = horizontal ? at : x;
  const cz = horizontal ? z : at;
  const jambA: [number, number, number] = horizontal
    ? [at - width / 2, base, z]
    : [x, base, at - width / 2];
  const jambB: [number, number, number] = horizontal
    ? [at + width / 2, base, z]
    : [x, base, at + width / 2];
  const headSize: [number, number, number] = horizontal
    ? [width, 0.12, 0.14]
    : [0.14, 0.12, width];

  return (
    <group>
      {[jambA, jambB].map((p, i) => (
        <mesh key={i} position={[p[0], base + POD_H / 2, p[2]]} castShadow>
          <boxGeometry args={[0.11, POD_H, 0.11]} />
          <primitive object={M.blackAnodized} attach="material" />
        </mesh>
      ))}
      <mesh position={[cx, base + POD_H - 0.06, cz]}>
        <boxGeometry args={headSize} />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      {/* Threshold strip in the doorway */}
      <mesh position={[cx, base + 0.012, cz]}>
        <boxGeometry
          args={horizontal ? [width, 0.02, 0.16] : [0.16, 0.02, width]}
        />
        <primitive object={M.metalBrushed} attach="material" />
      </mesh>
      {/* Named door plate — real pod name, accent underline */}
      <PodDoorPlate pod={pod} />
      {/* Frosted privacy band across the glazing */}
      {(
        [
          ["n", z0],
          ["s", z1],
        ] as const
      ).map(([s, zz]) =>
        side === s ? null : (
          <mesh key={s} position={[(x0 + x1) / 2, base + 1.25, zz]}>
            <boxGeometry args={[x1 - x0, 0.5, 0.11]} />
            <primitive object={M.glassCheap} attach="material" />
          </mesh>
        ),
      )}
    </group>
  );
}

/** Door plate beside a pod opening: dark plate, pod name, accent rule.
 *  Faces outward from the doorway on whichever side the door sits.
 *  Exported so L1 pods (built elsewhere) get the same plates. */
export function PodDoorPlate({ pod }: { pod: Pod }) {
  const [x0, x1, z0, z1] = pod.rect;
  const base = pod.level === 2 ? L2_Y : 0;
  const { side, at, width } = pod.door;
  const horizontal = side === "n" || side === "s";
  const z = side === "n" ? z0 : z1;
  const x = side === "w" ? x0 : x1;
  const cx = horizontal ? at : x;
  const cz = horizontal ? z : at;
  const outward = side === "n" ? -1 : side === "s" ? 1 : 0;
  const outwardX = side === "w" ? -1 : side === "e" ? 1 : 0;
  const signPos: [number, number, number] = [
    cx + outwardX * 0.09 + (horizontal ? width / 2 + 0.45 : 0),
    base + 1.55,
    cz + outward * 0.09 + (horizontal ? 0 : width / 2 + 0.45),
  ];
  const face = useMemo(
    () => plateTexture(pod.name, pod.accent),
    [pod.name, pod.accent],
  );
  // plane normal must point away from the pod, along the door side
  const rotY =
    side === "n"
      ? Math.PI
      : side === "s"
        ? 0
        : side === "w"
          ? -Math.PI / 2
          : Math.PI / 2;
  const off: [number, number, number] =
    side === "n"
      ? [0, 0, -0.02]
      : side === "s"
        ? [0, 0, 0.02]
        : side === "w"
          ? [-0.02, 0, 0]
          : [0.02, 0, 0];
  return (
    <group position={signPos}>
      <mesh castShadow>
        <boxGeometry
          args={[horizontal ? 0.84 : 0.03, 0.18, horizontal ? 0.03 : 0.84]}
        />
        <primitive object={M.blackAnodized} attach="material" />
      </mesh>
      <mesh position={off} rotation={[0, rotY, 0]}>
        <planeGeometry args={[0.78, 0.15]} />
        <meshBasicMaterial map={face} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Every glazed run on the upper deck, batched together. */
const GLAZING: Wall[] = [...WALLS_L2, ...POD_WALLS, ...BALUSTRADES];

/**
 * Level 2 — leadership floor. Zone floors, glazed manager/director/board pods,
 * the mezzanine breakout looking down into the atrium, open-plan senior desks
 * and all the trim that makes the upper deck read as a finished storey.
 */
export function Level2() {
  return (
    <group name="office-level-2">
      {/* --- Zone floor finishes ------------------------------------------- */}
      {ROOMS_L2.map((r) => {
        const [x0, x1, z0, z1] = r.rect;
        return (
          <mesh
            key={r.id}
            position={[(x0 + x1) / 2, L2_Y + 0.012, (z0 + z1) / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[x1 - x0, z1 - z0]} />
            <primitive
              object={floorFor(r.floor, x1 - x0, z1 - z0)}
              attach="material"
            />
          </mesh>
        );
      })}

      {/* Inlaid brass line marking the upper gallery centreline */}
      <mesh position={[0, L2_Y + 0.02, -4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, 30]} />
        <primitive object={M.chrome} attach="material" />
      </mesh>

      {/* --- Glazing: gallery partitions, pods, atrium balustrades --------- */}
      <GlazingBatch walls={GLAZING} />

      {/* --- Pod trim + interiors ------------------------------------------ */}
      {PODS.filter((p) => p.level === 2).map((p) => (
        <PodTrim key={p.id} pod={p} />
      ))}
      {POD_DESKS.map((d, i) => (
        <ExecDesk key={i} position={d.position} rotation={d.rotation} />
      ))}
      {POD_TABLES.map(({ pod, center, size }) => (
        <PodTable
          key={pod.id}
          center={center}
          size={size}
          seats={pod.kind === "board" ? 5 : 2}
        />
      ))}

      {/* --- Open plan + breakout ------------------------------------------ */}
      <InstancedFurniture
        desks={L2_DESKS}
        chairs={L2_DESK_CHAIRS}
        monitors={L2_MONITORS}
        plants={L2_PLANTS}
        sofas={L2_SOFAS}
        coffeeTables={L2_TABLES}
      />

      {/* Mezzanine coffee point */}
      <group position={[0, L2_Y, 13.4]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.6, 1.0, 0.8]} />
          <primitive object={M.wallAccent} attach="material" />
        </mesh>
        <mesh position={[0, 1.03, 0]} receiveShadow>
          <boxGeometry args={[3.8, 0.07, 0.94]} />
          <primitive object={M.stoneCounter} attach="material" />
        </mesh>
        <mesh position={[-1.1, 1.22, 0]} castShadow>
          <boxGeometry args={[0.5, 0.32, 0.4]} />
          <primitive object={M.metalBrushed} attach="material" />
        </mesh>
        <mesh position={[0, 0.06, 0.42]}>
          <boxGeometry args={[3.4, 0.04, 0.03]} />
          <primitive object={M.stripWarm} attach="material" />
        </mesh>
      </group>

      {/* Slatted acoustic screens between the open bays */}
      <Instances range={40} limit={40} castShadow>
        <boxGeometry args={[0.06, 1.35, 0.09]} />
        <primitive object={M.slat} attach="material" />
        {Array.from({ length: 40 }, (_, i) => {
          const bay = i < 20 ? -1 : 1;
          const k = i % 20;
          return (
            <Instance
              key={i}
              position={[
                (bay < 0 ? -21 : 19) + (k - 9.5) * 0.62,
                L2_Y + 0.9,
                bay < 0 ? -3.4 : -3.4,
              ]}
            />
          );
        })}
      </Instances>

      {/* Skirting along the upper perimeter, so walls meet the deck cleanly */}
      {(
        [
          [0, MEZZ.z0 - 0.02, 68, 0.06],
          [0, -19.96, 68, 0.06],
        ] as [number, number, number, number][]
      ).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, L2_Y + 0.07, z]}>
          <boxGeometry args={[w, 0.14, d]} />
          <primitive object={M.baseboard} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
