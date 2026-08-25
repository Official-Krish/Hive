import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useFBX, useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Uniform scale applied to every avatar GLB. */
const SCALE = 0.55;

/** Per-frame motion state the controller writes and the avatar reads. */
export interface PlayerMotion {
  speed: number; // 0..1 (walk .. run)
  grounded: boolean;
  jumpSeq: number; // increments on each jump launch
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
}

export default function Avatar({
  modelUrl = "/avatars/male/hive_male_01.glb",
  motionRef,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  isMoving = false,
  name = "You",
  status = "Active",
  badgeColor = "bg-sky-500",
}: AvatarProps) {
  const { scene } = useGLTF(modelUrl);
  const idleFBX = useFBX("/Animations/idle.fbx");
  const runFBX = useFBX("/Animations/run.fbx");
  const jumpFBX = useFBX("/Animations/jump.fbx");

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{
    idle?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
    jump?: THREE.AnimationAction;
  }>({});

  // Blend state (driven per-frame).
  const locoRef = useRef(0); // 0 idle .. 1 running
  const jumpWRef = useRef(0); // jump overlay weight
  const jumpingRef = useRef(false);
  const lastJumpSeq = useRef(0);

  // Legacy crossfade bookkeeping.
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // Nameplate sits just above the head — measured from the model, not guessed.
  const [labelY, setLabelY] = useState(1.9);

  // --- Retarget FBX clips onto the GLB skeleton --------------------------------
  useEffect(() => {
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    scene.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) skinnedMesh = obj;
      // Shadows aren't inherited by children of <primitive>, so set them here.
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        if (m.geometry) m.geometry.computeBoundingSphere();
        m.frustumCulled = true;
      }
    });
    if (!skinnedMesh) return;
    const mesh = skinnedMesh as THREE.SkinnedMesh;

    // Measure the rendered height so the nameplate clears the head. The box is
    // taken in the parent's space (scale already applied by the prop below), and
    // feet sit at y=0, so max.y is the head height directly.
    scene.scale.setScalar(SCALE);
    scene.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(scene);
    if (Number.isFinite(bounds.max.y)) {
      setLabelY(bounds.max.y + 0.22);
    }

    const targetBones = new Set(mesh.skeleton.bones.map((b) => b.name));
    const rootBoneName = mesh.skeleton.bones[0]?.name;

    // Each FBX ships TWO clips: the real animation plus a static
    // "0.Targeting Pose" reference (the T-pose). Index 0 is NOT reliably the
    // real one — run.fbx has the pose first — so select by name and fall back
    // to the longest clip. Keep only non-root bone quaternions so all vertical
    // displacement comes from the controller, not the animation.
    const prepareClip = (clipName: string, fbx: THREE.Group) => {
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

      const tracks = sourceClip.tracks.filter((track) => {
        const [boneName, property] = track.name.split(".");
        return (
          boneName !== undefined &&
          boneName !== rootBoneName &&
          property === "quaternion" &&
          targetBones.has(boneName)
        );
      });
      if (tracks.length === 0) {
        console.warn(
          `[Avatar] no matching tracks for "${clipName}" (${sourceClip.name})`,
        );
        return null;
      }
      return new THREE.AnimationClip(clipName, sourceClip.duration, tracks);
    };

    const idleClip = prepareClip("Idle", idleFBX);
    const runClip = prepareClip("Run", runFBX);
    const jumpClip = prepareClip("Jump", jumpFBX);

    const mixer = new THREE.AnimationMixer(scene);
    mixerRef.current = mixer;

    const actions: typeof actionsRef.current = {};
    if (idleClip) {
      actions.idle = mixer.clipAction(idleClip);
      actions.idle.setLoop(THREE.LoopRepeat, Infinity);
      actions.idle.play();
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
    actionsRef.current = actions;
    currentActionRef.current = actions.idle ?? null;

    // Start weights: full idle.
    actions.idle?.setEffectiveWeight(1);
    actions.run?.setEffectiveWeight(0);

    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === actions.jump) jumpingRef.current = false;
    };
    mixer.addEventListener("finished", onFinished);

    return () => {
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      mixerRef.current = null;
    };
  }, [scene, idleFBX, runFBX, jumpFBX]);

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

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
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

    // Smoothly approach targets.
    const locoTarget = m.speed > 0.06 ? 1 : 0;
    locoRef.current = THREE.MathUtils.damp(
      locoRef.current,
      locoTarget,
      10,
      delta,
    );
    jumpWRef.current = THREE.MathUtils.damp(
      jumpWRef.current,
      jumpingRef.current ? 1 : 0,
      14,
      delta,
    );

    const jw = jumpWRef.current;
    const loco = locoRef.current;

    actions.idle.setEffectiveWeight((1 - jw) * (1 - loco));
    actions.run.setEffectiveWeight((1 - jw) * loco);
    if (actions.jump) actions.jump.setEffectiveWeight(jw);

    // Walk feel at low speed, full run at high speed.
    actions.run.setEffectiveTimeScale(
      THREE.MathUtils.lerp(0.75, 1.35, THREE.MathUtils.clamp(m.speed, 0, 1)),
    );
  });

  // When motionRef drives us, a parent group owns the transform (render at origin).
  const groupProps = motionRef ? {} : { position, rotation };

  return (
    <group {...groupProps}>
      <primitive object={scene} scale={SCALE} />

      {/* Small pill floating just above the head. No distanceFactor: the label
          keeps a constant, legible screen size at every zoom level. */}
      <Html
        position={[0, labelY, 0]}
        center
        zIndexRange={[100, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          title={status}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-slate-900/80 px-2 py-[2px] text-[10px] font-semibold leading-none text-white shadow-lg backdrop-blur-sm select-none"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${badgeColor}`} />
          <span>{name}</span>
        </div>
      </Html>
    </group>
  );
}

useGLTF.preload("/avatars/male/hive_male_01.glb");
useGLTF.preload("/avatars/male/hive_male_02.glb");
useGLTF.preload("/avatars/female/hive_female_01.glb");
useGLTF.preload("/avatars/female/hive_female_02.glb");
