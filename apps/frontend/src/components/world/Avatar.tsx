import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useFBX, useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { ASSET_BASE_URL } from "../../lib/config";

/** Uniform scale applied to every avatar GLB. */
const SCALE = 0.55;
/** Mixamo FBX files are authored in centimeters — scale to meters. */
const FBX_SCALE = 0.01;
/** Default model (also the GLB fallback while an FBX URL loads). */
const DEFAULT_MODEL = `${ASSET_BASE_URL}/avatars/male/hive_male_01.glb`;
/** Animation URL reused as the FBX-hook fallback for GLB models (preloaded). */
const IDLE_URL = `${ASSET_BASE_URL}/Animations/idle.fbx`;

/** True for FBX characters (Mixamo downloads, cm units, namespaced bones). */
export function isFbxModelUrl(url: string | null | undefined): boolean {
  return !!url && /\.fbx($|[?#])/i.test(url.trim());
}

/**
 * Stride matching (kills moonwalk foot-slide). The clips are in-place, so
 * step frequency must be derived: cycles/sec needed = groundSpeed / stride.
 * Strides are Mixamo-archetype estimates for an average humanoid — tune here,
 * not at call sites. Durations are read off the actual clips at load.
 */
const RUN_STRIDE_M = 2.4; // one full run gait cycle
/** Must match PlayerController RUN_SPEED — motion.speed is normalized by it. */
const AV_RUN_SPEED = 7.4; // m/s

/** Per-frame motion state the controller writes and the avatar reads. */
export interface PlayerMotion {
  speed: number; // 0..1 (walk .. run)
  grounded: boolean;
  jumpSeq: number; // increments on each jump launch
  sitting?: boolean; // seated on a chair — overrides locomotion blend
}

interface AvatarProps {
  modelUrl?: string;
  /** When provided, a parent group drives transform and this ref drives animation. */
  motionRef?: MutableRefObject<PlayerMotion>;
  // Legacy / static-avatar props (used when motionRef is absent).
  position?: [number, number, number];
  rotation?: [number, number, number];
  isMoving?: boolean;
  name?: string;
  status?: string;
  badgeColor?: string;
  /** Small context pills stacked under the name (project, tests, tokens…). */
  meta?: Array<{
    text: string;
    tone?: "amber" | "green" | "red" | "violet" | "neutral";
    icon?: ReactNode;
  }>;
  /** Hide the floating nameplate (used for the local player — you know who
   *  you are, and your own tag would sit on top of whatever you face). */
  hideNameplate?: boolean;
  /** When true, the nameplate badge shows a chair icon to indicate seated. */
  sitting?: boolean;
}

const META_TONE: Record<string, string> = {
  amber: "bg-amber-400/95 text-neutral-900",
  green: "bg-emerald-400/95 text-neutral-900",
  red: "bg-rose-500/95 text-white",
  violet: "bg-violet-500/95 text-white",
  neutral: "bg-black/40 text-white/80",
};

const _nameplateWorld = new THREE.Vector3();
const _avatarPos = new THREE.Vector3();

/** Range policy: full label under 10m, fades out by 14m, meta pills under 8m.
 *  Keeps tags off distant components instead of plastering the whole office. */
const TAG_FULL = 10;
const TAG_FADE = 14;
const TAG_META = 8;

/** Max meta pills under a nameplate — the rest collapse into a +n pill. */
const TAG_META_MAX = 2;
/** Nameplate with wall occlusion + proximity fade (meta <8m, gone past 14m). */
function Nameplate({
  labelY,
  name,
  status,
  badgeColor,
  meta,
  sittingRef,
}: {
  labelY: number;
  name: string;
  status: string;
  badgeColor: string;
  meta: AvatarProps["meta"];
  sittingRef?: React.MutableRefObject<boolean>;
}) {
  const anchor = useRef<THREE.Group>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const metaEl = useRef<HTMLDivElement>(null);
  const dotEl = useRef<HTMLSpanElement>(null);
  const chairEl = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const visible = (meta ?? []).slice(0, TAG_META_MAX);
  const overflow = (meta ?? []).length - visible.length;

  useFrame(({ camera }) => {
    if (document.hidden) return;
    const g = anchor.current;
    if (!g) return;
    g.getWorldPosition(_nameplateWorld);
    const d = camera.position.distanceTo(_nameplateWorld);
    if (wrap.current) {
      if (d >= TAG_FADE) {
        wrap.current.style.display = "none";
      } else {
        wrap.current.style.display = "";
        // Exponential fade: stays near-opaque until TAG_FULL then drops off
        // quickly, so the label doesn't visibly dim while still readable.
        wrap.current.style.opacity =
          d <= TAG_FULL
            ? "1"
            : String(Math.pow(1 - (d - TAG_FULL) / (TAG_FADE - TAG_FULL), 2.5));
      }
    }
    if (metaEl.current)
      metaEl.current.style.display = d < TAG_META ? "" : "none";

    // Toggle seated indicator imperatively — no React re-render needed.
    const seated = sittingRef?.current ?? false;
    if (dotEl.current) dotEl.current.style.display = seated ? "none" : "";
    if (chairEl.current) chairEl.current.style.display = seated ? "" : "none";
  });

  return (
    <group ref={anchor} position={[0, labelY, 0]}>
      {/* occlude hides the label behind walls/floors instead of X-raying. */}
      <Html
        center
        occlude
        zIndexRange={[50, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div ref={wrap} className="flex flex-col items-center gap-0.5">
          <div
            title={status}
            className="flex items-center gap-1 whitespace-nowrap rounded-full bg-black/60 px-1.5 py-[2px] text-[9px] font-medium leading-none tracking-[0.01em] text-white/95 shadow-sm ring-1 ring-white/10 backdrop-blur-[2px] select-none"
          >
            {/* Status dot — hidden when seated */}
            <span
              ref={dotEl}
              className={`h-1 w-1 rounded-full ${badgeColor}`}
            />
            {/* Chair icon — hidden when standing, shown when seated */}
            <span ref={chairEl} style={{ display: "none" }}>
              <svg
                viewBox="0 0 12 12"
                className="h-2.5 w-2.5 shrink-0 text-sky-300"
                fill="currentColor"
                aria-label="Seated"
              >
                {/* seat */}
                <rect x="1" y="5" width="10" height="2" rx="0.5" />
                {/* back */}
                <rect x="1" y="1" width="2" height="5" rx="0.5" />
                {/* front legs */}
                <rect x="2" y="7" width="1.5" height="4" rx="0.5" />
                <rect x="8.5" y="7" width="1.5" height="4" rx="0.5" />
              </svg>
            </span>
            <span>{name}</span>
          </div>
          <div ref={metaEl} className="flex flex-col items-center gap-1">
            <AnimatePresence initial={false}>
              {visible.map((m, i) => (
                <motion.div
                  key={`${m.tone ?? "neutral"}-${m.text}-${i}`}
                  className={`flex max-w-[120px] items-center gap-[3px] rounded-full px-1.5 py-[1.5px] text-[8.5px] font-semibold leading-none tabular-nums shadow-sm ring-1 ring-black/20 select-none ${
                    META_TONE[m.tone ?? "neutral"]
                  }`}
                  initial={
                    reduce ? { opacity: 1 } : { opacity: 0, scale: 0.8, y: -3 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                >
                  {m.icon && <span className="shrink-0">{m.icon}</span>}
                  <span className="truncate">{m.text}</span>
                </motion.div>
              ))}
              {overflow > 0 && (
                <motion.div
                  key="overflow"
                  className="whitespace-nowrap rounded-full bg-black/40 px-1.5 py-[1.5px] text-[8.5px] font-bold leading-none tabular-nums text-white/80 shadow-sm ring-1 ring-white/10 select-none"
                  initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                >
                  +{overflow}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Html>
    </group>
  );
}

export default function Avatar({
  modelUrl = DEFAULT_MODEL,
  motionRef,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  isMoving = false,
  name = "You",
  status = "Active",
  badgeColor = "bg-sky-500",
  meta,
  hideNameplate = false,
  sitting: sittingProp = false,
}: AvatarProps) {
  // Dual loader: GLB avatars go through useGLTF, FBX characters through
  // useFBX. Both hooks stay unconditional (rules of hooks) — only the URL
  // varies, and each fallback is preloaded elsewhere so the unused branch
  // never triggers an extra fetch.
  const isFbx = isFbxModelUrl(modelUrl);
  const glb = useGLTF(isFbx ? DEFAULT_MODEL : modelUrl);
  const fbxModel = useFBX(isFbx ? modelUrl : IDLE_URL);
  const scene = (isFbx ? fbxModel : glb.scene) as THREE.Group;
  const modelScale = isFbx ? FBX_SCALE : SCALE;
  const idleFBX = useFBX(`${ASSET_BASE_URL}/Animations/idle.fbx`);
  const runFBX = useFBX(`${ASSET_BASE_URL}/Animations/run.fbx`);
  const jumpFBX = useFBX(`${ASSET_BASE_URL}/Animations/jump.fbx`);

  // Sitting is best-effort so a missing CDN file can never brick the avatar.
  const [sitFBX, setSitFBX] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { FBXLoader } =
          await import("three/examples/jsm/loaders/FBXLoader.js");
        const loader = new FBXLoader();
        const sit = await loader
          .loadAsync(`${ASSET_BASE_URL}/Animations/Sitting.fbx`)
          .catch(() => null);
        if (!alive) return;
        if (sit) setSitFBX(sit);
      } catch {
        // Loader itself failed — same fallback, already warned above.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);

    if (isFbx) {
      // FBX is static — no animation/retargeting.
      cloned.scale.setScalar(FBX_SCALE);

      // Center horizontally and place feet on the ground.
      cloned.updateWorldMatrix(true, true);

      const box = new THREE.Box3().setFromObject(cloned);

      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());

        cloned.position.x -= center.x;
        cloned.position.z -= center.z;
        cloned.position.y -= box.min.y;
      }
    }

    return cloned;
  }, [scene, isFbx]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
    jump?: THREE.AnimationAction;
    sit?: THREE.AnimationAction;
  }>({});

  // Blend state (driven per-frame).
  const idleWRef = useRef(1); // idle weight
  const walkWRef = useRef(0); // walk weight
  const runWRef = useRef(0); // run weight
  const jumpWRef = useRef(0); // jump overlay weight
  const sitWRef = useRef(0); // seated weight (overrides locomotion)
  // Gait-cycle durations read off the run/walk clips.
  const gaitRef = useRef({ runDur: 0, walkDur: 0 });
  const jumpingRef = useRef(false);
  const lastJumpSeq = useRef(0);

  // Legacy crossfade bookkeeping.
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // Nameplate sits just above the head — measured from the model, not guessed.
  const [labelY, setLabelY] = useState(1.9);

  // --- Retarget FBX clips onto the GLB skeleton --------------------------------
  // FBX characters are static by design — no mixer, no track matching.
  useEffect(() => {
    if (isFbx) return;
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    clonedScene.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) skinnedMesh = obj;
      // Shadows aren't inherited by children of <primitive>, so set them here.
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        if (m.geometry) {
          m.geometry.computeBoundingSphere();
          const sphere = m.geometry.boundingSphere;
          if (sphere) {
            // Inflate for animation range (limbs leave the bind pose), then
            // allow frustum culling — off-screen avatars skip main + shadow.
            sphere.radius *= 1.6;
          }
          m.frustumCulled = true;
        } else {
          m.frustumCulled = false;
        }
      }
    });
    if (!skinnedMesh) return;
    const mesh = skinnedMesh as THREE.SkinnedMesh;

    // Measure the rendered height so the nameplate clears the head. The box is
    // taken in the parent's space (scale already applied by the prop below), and
    // feet sit at y=0, so max.y is the head height directly.
    clonedScene.scale.setScalar(modelScale);
    clonedScene.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(clonedScene);
    if (Number.isFinite(bounds.max.y)) {
      setLabelY(bounds.max.y + 0.22);
    }

    const targetBones = new Set(mesh.skeleton.bones.map((b) => b.name));
    const rootBoneName = mesh.skeleton.bones[0]?.name;
    const bindMap = new Map(
      mesh.skeleton.bones.map((b) => [b.name, b.quaternion.clone()] as const),
    );
    const IDENTITY_Q = new THREE.Quaternion();

    // Mixamo rest pose ≠ avatar bind pose (avatar hips bind is 180° about Z,
    // thighs ~180° about X). Fresh downloads therefore render upside-down.
    // Fix per bone: q' = q · rest⁻¹ · stance — the source-relative motion
    // (q·rest⁻¹) replayed onto the avatar stance. NOTE the multiplication
    // ORDER: premultiplying (stance·rest⁻¹·q) mirrors bend direction whenever
    // the offset is ~180° (thighs then bend backward = "legs behind body").
    // Stance comes from the idle clip (relaxed standing — NOT the rigid bind,
    // whose arms sit ~62° out in a half-raised pose that reads as a T-pose
    // mid-stride). Rest is read off the FBX skeleton nodes (true rest preservals) —
    // walk-cycle averaging was tried and biases high-variance bones (knees
    // bend 0–60° mid-stride, dragging R ~35° off and flipping bend direction).
    // Old clips already match stance/bind and must NEVER be rebound.
    // Hemisphere-aware per-bone mean of quaternion tracks (bare names).
    const meanQuats = (fbx: THREE.Group | null) => {
      const out = new Map<string, THREE.Quaternion>();
      if (!fbx) return out;
      const source =
        fbx.animations
          .filter((c) => !/targeting\s*pose/i.test(c.name))
          .reduce<THREE.AnimationClip | null>(
            (best, c) => (!best || c.duration > best.duration ? c : best),
            null,
          ) ?? null;
      const acc = new Map<string, { sum: THREE.Quaternion; n: number }>();
      for (const track of source?.tracks ?? []) {
        const dot = track.name.lastIndexOf(".");
        if (dot < 0) continue;
        const bonePart = track.name.slice(0, dot);
        const bare = bonePart
          .slice(bonePart.lastIndexOf(":") + 1)
          .replace(/^mixamorig/i, "");
        if (track.name.slice(dot + 1) !== "quaternion") continue;
        let entry = acc.get(bare);
        if (!entry) {
          entry = { sum: new THREE.Quaternion(0, 0, 0, 0), n: 0 };
          acc.set(bare, entry);
        }
        const q = new THREE.Quaternion();
        const count = track.values.length / 4;
        for (let i = 0; i < count; i++) {
          q.set(
            track.values[i * 4] ?? 0,
            track.values[i * 4 + 1] ?? 0,
            track.values[i * 4 + 2] ?? 0,
            track.values[i * 4 + 3] ?? 0,
          );
          if (entry.sum.dot(q) < 0 && entry.n > 0) {
            entry.sum.set(
              entry.sum.x - q.x,
              entry.sum.y - q.y,
              entry.sum.z - q.z,
              entry.sum.w - q.w,
            );
          } else {
            entry.sum.set(
              entry.sum.x + q.x,
              entry.sum.y + q.y,
              entry.sum.z + q.z,
              entry.sum.w + q.w,
            );
          }
          entry.n++;
        }
      }
      for (const [bare, entry] of acc) {
        if (entry.n > 0) out.set(bare, entry.sum.normalize());
      }
      return out;
    };
    const restMap = meanQuats(sitFBX);
    const stanceMap = meanQuats(idleFBX);
    // True Mixamo rest, straight from the FBX skeleton (Bone local quats).
    // Preferred over the walk-cycle average above for high-variance bones.
    const nodeRestMap = new Map<string, THREE.Quaternion>();
    if (sitFBX) {
      sitFBX.traverse((obj) => {
        const bone = obj as THREE.Bone;
        if (!bone.isBone || !bone.name) return;
        const bare = bone.name
          .slice(bone.name.lastIndexOf(":") + 1)
          .replace(/^mixamorig/i, "");
        if (!bare || nodeRestMap.has(bare)) return;
        nodeRestMap.set(bare, bone.quaternion.clone());
      });
    }

    // Each FBX ships TWO clips: the real animation plus a static
    // "0.Targeting Pose" reference (the T-pose). Index 0 is NOT reliably the
    // real one — run.fbx has the pose first — so select by name and fall back
    // to the longest clip. Keep only non-root bone quaternions so all vertical
    // displacement comes from the controller, not the animation.
    // Fresh Mixamo downloads namespace bones ("mixamorig:Hips") while the
    // avatar GLB uses bare names ("Hips") — and three's FBXLoader additionally
    // strips the colon ("mixamorigHips"). Normalize all three forms before
    // matching, and rewrite the track name so the mixer binds correctly.
    // `rebind` is ONLY for fresh downloads: their rest pose differs from the
    // avatar bind (hips 180° about Z), so each keyframe is premultiplied by
    // the per-bone offset R = bind · rest⁻¹. Old clips already match bind and
    // must never be rebound (it would invert them).
    //
    // Upper-body / leg exemption for the sit clip:
    //   The rebind offset uses the *idle* stance as the target, which maps
    //   sitting-arm quaternions (arms angled down toward keyboard) onto the
    //   standing-arm stance → arms end up raised. Arms/hands/feet are already
    //   correct in Mixamo space for the sit clip; they only need the bare
    //   name fix, not the idle-stance remap.
    //   Bones that drive the hips 180° flip (Hips, Spine*, Neck, Head) still
    //   need rebinding so the torso doesn't invert.
    const SIT_REBIND_SKIP = new Set([
      // Arms & hands
      "LeftShoulder",
      "RightShoulder",
      "LeftArm",
      "RightArm",
      "LeftForeArm",
      "RightForeArm",
      "LeftHand",
      "RightHand",
      // Fingers (all variants)
      "LeftHandIndex1",
      "LeftHandIndex2",
      "LeftHandIndex3",
      "LeftHandMiddle1",
      "LeftHandMiddle2",
      "LeftHandMiddle3",
      "LeftHandRing1",
      "LeftHandRing2",
      "LeftHandRing3",
      "LeftHandPinky1",
      "LeftHandPinky2",
      "LeftHandPinky3",
      "LeftHandThumb1",
      "LeftHandThumb2",
      "LeftHandThumb3",
      "RightHandIndex1",
      "RightHandIndex2",
      "RightHandIndex3",
      "RightHandMiddle1",
      "RightHandMiddle2",
      "RightHandMiddle3",
      "RightHandRing1",
      "RightHandRing2",
      "RightHandRing3",
      "RightHandPinky1",
      "RightHandPinky2",
      "RightHandPinky3",
      "RightHandThumb1",
      "RightHandThumb2",
      "RightHandThumb3",
      // Legs & feet (their sitting flex is already correct in Mixamo space)
      "LeftUpLeg",
      "RightUpLeg",
      "LeftLeg",
      "RightLeg",
      "LeftFoot",
      "RightFoot",
      "LeftToeBase",
      "RightToeBase",
    ]);

    const prepareClip = (
      clipName: string,
      fbx: THREE.Group,
      rebind = false,
    ) => {
      const usable = fbx.animations.filter(
        (c) => !/targeting\s*pose/i.test(c.name),
      );
      const sourceClip =
        usable.find((c) => new RegExp(clipName, "i").test(c.name)) ??
        usable.reduce<THREE.AnimationClip | null>(
          (best, c) => (!best || c.duration > best.duration ? c : best),
          null,
        );
      if (!sourceClip) return null;

      const tracks: THREE.KeyframeTrack[] = [];
      for (const track of sourceClip.tracks) {
        const dot = track.name.lastIndexOf(".");
        if (dot < 0) continue;
        const boneName = track.name.slice(0, dot);
        const property = track.name.slice(dot + 1);
        const bare = boneName
          .slice(boneName.lastIndexOf(":") + 1)
          .replace(/^mixamorig/i, "");
        if (
          bare === rootBoneName ||
          property !== "quaternion" ||
          !targetBones.has(bare)
        ) {
          continue;
        }
        // New track instance every time — never mutate the cached FBX.
        const count = track.values.length / 4;
        const values = track.values.slice(0);
        if (rebind && !SIT_REBIND_SKIP.has(bare)) {
          const rest = nodeRestMap.get(bare) ?? restMap.get(bare);
          const stance = stanceMap.get(bare) ?? bindMap.get(bare) ?? IDENTITY_Q;
          const offset = rest ? { inv: rest.clone().invert(), stance } : null;
          const q = new THREE.Quaternion();
          for (let i = 0; i < count; i++) {
            q.set(
              values[i * 4] ?? 0,
              values[i * 4 + 1] ?? 0,
              values[i * 4 + 2] ?? 0,
              values[i * 4 + 3] ?? 0,
            );
            // POST-multiply: replay source-relative motion onto the stance.
            // (Premultiplying mirrors bend direction under ~180° offsets.)
            if (offset) q.multiply(offset.inv).multiply(offset.stance);
            values[i * 4] = q.x;
            values[i * 4 + 1] = q.y;
            values[i * 4 + 2] = q.z;
            values[i * 4 + 3] = q.w;
          }
        }
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${bare}.${property}`,
            [...track.times],
            values,
          ),
        );
      }
      if (tracks.length === 0) {
        console.warn(
          `[Avatar] no matching tracks for "${clipName}" (${sourceClip.name})`,
        );
        return null;
      }
      return new THREE.AnimationClip(clipName, sourceClip.duration, tracks);
    };

    const idleClip = prepareClip("Idle", idleFBX);
    // Use the proven run clip at walking speed too. The separate walk FBX was
    // authored for a different rig and made the limbs wobble after retargeting.
    const walkClip = null;
    const runClip = prepareClip("Run", runFBX);
    const jumpClip = prepareClip("Jump", jumpFBX);
    // Sitting.fbx ships a single "mixamo.com" take — longest-clip fallback
    // picks it; rebind maps its rest pose onto the avatar stance.
    const sitClip = sitFBX ? prepareClip("Sitting", sitFBX, true) : null;
    gaitRef.current = { runDur: runClip?.duration ?? 0, walkDur: 0 };

    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    const actions: typeof actionsRef.current = {};
    if (idleClip) {
      actions.idle = mixer.clipAction(idleClip);
      actions.idle.setLoop(THREE.LoopRepeat, Infinity);
      actions.idle.play();
    }
    if (walkClip) {
      actions.walk = mixer.clipAction(walkClip);
      actions.walk.setLoop(THREE.LoopRepeat, Infinity);
      actions.walk.play();
    }
    if (runClip) {
      actions.run = mixer.clipAction(runClip);
      actions.run.setLoop(THREE.LoopRepeat, Infinity);
      actions.run.play();
    }
    if (jumpClip) {
      actions.jump = mixer.clipAction(jumpClip);
      actions.jump.setLoop(THREE.LoopOnce, 1);
      actions.jump.clampWhenFinished = true;
    }
    if (sitClip) {
      actions.sit = mixer.clipAction(sitClip);
      actions.sit.setLoop(THREE.LoopRepeat, Infinity);
      actions.sit.play();
    }
    actionsRef.current = actions;
    currentActionRef.current = actions.idle ?? null;

    // Start weights: full idle.
    actions.idle?.setEffectiveWeight(1);
    actions.walk?.setEffectiveWeight(0);
    actions.run?.setEffectiveWeight(0);
    actions.sit?.setEffectiveWeight(0);

    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === actions.jump) jumpingRef.current = false;
    };
    mixer.addEventListener("finished", onFinished);

    return () => {
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
    };
  }, [clonedScene, idleFBX, runFBX, jumpFBX, sitFBX, isFbx]);

  // --- FBX built-in takes (new characters only; GLB path above untouched) ----
  // The file ships its own Idle/Walk/Run on its own rig, so no retargeting:
  // bind quaternion tracks straight onto the cloned bones. Position/scale
  // tracks are dropped (root motion would fight the controller — same rule
  // as the GLB path). No sit take: seating degrades to idle via the shared
  // guards (sitT requires actions.sit).
  useEffect(() => {
    if (!isFbx) return;
    clonedScene.traverse((obj) => {
      // Shadows aren't inherited by children of <primitive>, so set them here.
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        if (m.geometry) {
          m.geometry.computeBoundingSphere();
          const sphere = m.geometry.boundingSphere;
          if (sphere) sphere.radius *= 1.6;
          m.frustumCulled = true;
        } else {
          m.frustumCulled = false;
        }
      }
    });
    clonedScene.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(clonedScene);
    if (Number.isFinite(bounds.max.y)) {
      setLabelY(bounds.max.y + 0.22);
    }

    const bones = new Set<string>();
    clonedScene.traverse((obj) => {
      if ((obj as THREE.Bone).isBone && obj.name) bones.add(obj.name);
    });
    const takes = (fbxModel.animations ?? []) as THREE.AnimationClip[];
    const pick = (re: RegExp) => takes.find((c) => re.test(c.name)) ?? null;
    const toClip = (take: THREE.AnimationClip | null, label: string) => {
      if (!take) return null;
      const tracks: THREE.KeyframeTrack[] = [];
      for (const track of take.tracks) {
        const dot = track.name.lastIndexOf(".");
        if (dot < 0) continue;
        const node = track.name.slice(0, dot);
        const property = track.name.slice(dot + 1);
        // Quaternion-only, skeleton bones only — never mutate the cached FBX.
        if (property !== "quaternion" || !bones.has(node)) continue;
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${node}.${property}`,
            [...track.times],
            track.values.slice(0),
          ),
        );
      }
      if (tracks.length === 0) {
        console.warn(`[Avatar] no bindable tracks in FBX take "${take.name}"`);
        return null;
      }
      return new THREE.AnimationClip(label, take.duration, tracks);
    };

    const idleClip = toClip(
      pick(/idle_neutral/i) ?? pick(/\|idle$/i) ?? pick(/idle/i),
      "Idle",
    );
    const walkClip = toClip(pick(/\|walk$/i) ?? pick(/walk/i), "Walk");
    const runClip = toClip(pick(/\|run$/i) ?? pick(/run/i), "Run");

    // No sitting for FBX: Sitting.fbx is authored for a foreign (Mixamo)
    // rig and manual bone-by-bone retargeting produced a broken seat pose.
    // With no actions.sit, seating degrades to idle via the shared guards.
    gaitRef.current = {
      runDur: runClip?.duration ?? 0,
      walkDur: walkClip?.duration ?? 0,
    };

    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    const actions: typeof actionsRef.current = {};
    if (idleClip) {
      actions.idle = mixer.clipAction(idleClip);
      actions.idle.setLoop(THREE.LoopRepeat, Infinity);
      actions.idle.play();
    }
    if (walkClip) {
      actions.walk = mixer.clipAction(walkClip);
      actions.walk.setLoop(THREE.LoopRepeat, Infinity);
      actions.walk.play();
    }
    if (runClip) {
      actions.run = mixer.clipAction(runClip);
      actions.run.setLoop(THREE.LoopRepeat, Infinity);
      actions.run.play();
    }
    actionsRef.current = actions;
    currentActionRef.current = actions.idle ?? null;

    // Start weights: full idle.
    actions.idle?.setEffectiveWeight(1);
    actions.walk?.setEffectiveWeight(0);
    actions.run?.setEffectiveWeight(0);

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
    };
  }, [clonedScene, fbxModel, isFbx]);

  // --- Legacy crossfade for static avatars (no motionRef) ----------------------
  useEffect(() => {
    if (motionRef) return; // player path drives blending in useFrame instead
    const actions = actionsRef.current;
    if (!actions.idle || !actions.run) return;
    const target = isMoving ? actions.run : actions.idle;
    const prev = currentActionRef.current;
    if (prev !== target) {
      prev?.fadeOut(0.2);
      target.reset().fadeIn(0.2).play();
      currentActionRef.current = target;
    }
  }, [isMoving, motionRef]);

  const reduceMotionRef = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const groupRef = useRef<THREE.Group>(null);
  // Distant-avatar throttle accumulator (see useFrame below).
  const farAccum = useRef(0);

  useFrame(({ camera }, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    // Reduced motion: hold the first frame — presence without the performance.
    if (reduceMotionRef.current) return;
    // Beyond 16m, 15Hz animation is imperceptible and ~4x cheaper across
    // a crowd of remotes. The local player is always near the lens.
    const g = groupRef.current;
    if (g) {
      g.getWorldPosition(_avatarPos);
      if (_avatarPos.distanceToSquared(camera.position) > 256) {
        farAccum.current += delta;
        if (farAccum.current < 1 / 15) return;
        delta = farAccum.current;
        farAccum.current = 0;
      }
    }
    mixer.update(delta);

    const actions = actionsRef.current;
    if (!motionRef || !actions.idle || !actions.run) return;

    const m = motionRef.current;

    // Jump trigger.
    if (m.jumpSeq !== lastJumpSeq.current) {
      lastJumpSeq.current = m.jumpSeq;
      if (actions.jump) {
        jumpingRef.current = true;
        actions.jump.reset().setEffectiveWeight(1).play();
      }
    }

    // The run clip drives both walking and sprinting. Its playback speed is
    // matched to ground speed below, so walking remains a calm version of the
    // same stable arm-and-leg gait.
    const s = THREE.MathUtils.clamp(m.speed, 0, 1);
    const hasWalk = !!actions.walk;
    const idleT = 1 - THREE.MathUtils.clamp(s / 0.15, 0, 1);
    const runT = hasWalk
      ? THREE.MathUtils.clamp((s - 0.45) / 0.25, 0, 1)
      : s > 0.06
        ? 1
        : 0;
    const walkT = hasWalk ? Math.max(0, 1 - idleT - runT) : 0;
    idleWRef.current = THREE.MathUtils.damp(idleWRef.current, idleT, 10, delta);
    walkWRef.current = THREE.MathUtils.damp(walkWRef.current, walkT, 10, delta);
    runWRef.current = THREE.MathUtils.damp(runWRef.current, runT, 10, delta);
    jumpWRef.current = THREE.MathUtils.damp(
      jumpWRef.current,
      jumpingRef.current ? 1 : 0,
      14,
      delta,
    );

    const jw = jumpWRef.current;
    // Seated overrides everything (no locomotion while on a chair). Without
    // the sit clip this degrades to plain idle.
    const sitT = m.sitting && actions.sit ? 1 : 0;
    sitWRef.current = THREE.MathUtils.damp(sitWRef.current, sitT, 10, delta);
    const sw = sitWRef.current;
    // Damping can leave the three weights summing slightly off 1 — normalize.
    const sum = idleWRef.current + walkWRef.current + runWRef.current || 1;

    actions.idle.setEffectiveWeight(
      ((1 - jw) * (1 - sw) * idleWRef.current) / sum,
    );
    actions.walk?.setEffectiveWeight(
      ((1 - jw) * (1 - sw) * walkWRef.current) / sum,
    );
    actions.run.setEffectiveWeight(
      ((1 - jw) * (1 - sw) * runWRef.current) / sum,
    );
    if (actions.jump) actions.jump.setEffectiveWeight(jw * (1 - sw));
    actions.sit?.setEffectiveWeight(sw);

    // Stride-matched playback: step frequency follows ground speed so feet
    // plant instead of glide. The same run gait is simply slower while walking.
    const v = s * AV_RUN_SPEED;
    const { runDur, walkDur } = gaitRef.current;
    if (runDur > 0) {
      actions.run.setEffectiveTimeScale(
        THREE.MathUtils.clamp((v * runDur) / RUN_STRIDE_M, 0.5, 2.6),
      );
    }
    // FBX only (GLB walkDur is always 0): same matching for the built-in
    // walk take. Walk stride is a rough match for the run constant — tune
    // per character here if feet visibly slide while walking.
    if (walkDur > 0 && actions.walk) {
      actions.walk.setEffectiveTimeScale(
        THREE.MathUtils.clamp((v * walkDur) / RUN_STRIDE_M, 0.5, 2.6),
      );
    }
  });

  // When motionRef drives us, a parent group owns the transform (render at origin).
  const groupProps = motionRef ? {} : { position, rotation };

  // Track sitting state in a ref so Nameplate reads it each frame without
  // React re-renders. Seeded from sittingProp for static avatars.
  const sittingRef = useRef(sittingProp);
  useFrame(() => {
    sittingRef.current = motionRef
      ? (motionRef.current.sitting ?? false)
      : sittingProp;
  });

  return (
    <group {...groupProps} ref={groupRef}>
      <primitive object={clonedScene} />

      {/* Minimal nameplate floating just above the head. No distanceFactor:
          the label keeps a constant, legible screen size at every zoom level.
          The local player gets none — their own tag would cover whatever they
          face. */}
      {!hideNameplate && (
        <Nameplate
          labelY={labelY}
          name={name}
          status={status}
          badgeColor={badgeColor}
          meta={meta}
          sittingRef={sittingRef}
        />
      )}
    </group>
  );
}

useGLTF.preload(`${ASSET_BASE_URL}/avatars/male/hive_male_01.glb`);
useGLTF.preload(`${ASSET_BASE_URL}/avatars/male/hive_male_02.glb`);
useGLTF.preload(`${ASSET_BASE_URL}/avatars/female/hive_female_01.glb`);
useGLTF.preload(`${ASSET_BASE_URL}/avatars/female/hive_female_02.glb`);
useGLTF.preload("https://cdn.krishlabs.tech/hive/avatars/robot.glb");
// Animations stream on first spawn without these — preload to avoid the hitch.
useFBX.preload(`${ASSET_BASE_URL}/Animations/idle.fbx`);
useFBX.preload(`${ASSET_BASE_URL}/Animations/run.fbx`);
useFBX.preload(`${ASSET_BASE_URL}/Animations/jump.fbx`);
