import { useCallback, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import * as THREE from "three";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowLeft } from "react-icons/fi";
import { OfficeBuilding } from "./office/OfficeBuilding";
import { OfficeLighting } from "./lighting/OfficeLighting";
import { PlayerController } from "./PlayerController";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import {
  PLAYER_COLLIDERS,
  CAMERA_COLLIDERS,
  SPAWN,
  STEP_UP,
  roomAt,
  supportAt,
} from "./office/layout";
import { AVATARS } from "./AvatarConfig";
import { useRealtimeMap } from "@/hooks/useRealtimeMap";
import { useNearbyTokens } from "@/hooks/useNearbyTokens";
import { http } from "@/lib/http";
import RemoteAvatars from "./RemoteAvatars";
import { MemberDetailPopup } from "./MapHud";

const DEFAULT_AVATAR =
  AVATARS.male[0]?.model ?? "/avatars/male/hive_male_01.glb";

/* HUD material — the console's bone-paper instruments, tuned for the pale
   sky. Shared by every floating control so the frame reads as one system. */
const CHIP =
  "inline-flex items-center gap-2.5 rounded-full bg-[#f4f2ed]/95 ring-1 ring-black/[0.09] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_28px_-16px_rgba(28,25,18,0.5)] " +
  "backdrop-blur-sm";
const EYEBROW =
  "text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400 leading-none";

/** TEMP dev probe: exposes the renderer + scene for perf measurement. */
function PerfProbe() {
  const { gl, scene, camera } = useThree();
  (window as unknown as Record<string, unknown>).__three = {
    gl,
    scene,
    camera,
  };
  return null;
}

interface WorldCanvasProps {
  workspaceId: string;
  myUserId: string;
  myAvatarModel: string | null;
  workspaceName: string;
}

export function WorldCanvas({
  workspaceId,
  myUserId,
  myAvatarModel,
  workspaceName,
}: WorldCanvasProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cameraYaw, setCameraYaw] = useState(0);
  const [currentRoom, setCurrentRoom] = useState("Courtyard");
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const playerGroupRef = useRef<THREE.Group>(null);

  // The avatar is chosen once on /dashboard/avatar — no switching in-world.
  const playerModel = myAvatarModel ?? DEFAULT_AVATAR;

  const { client, avatars, nearIds, connectionStatus, setMyPosition } =
    useRealtimeMap(workspaceId, myUserId);
  const nearbyTokens = useNearbyTokens(workspaceId, client, nearIds);

  const handleRoomChange = useCallback((room: string) => {
    setCurrentRoom((prev) => (prev === room ? prev : room));
  }, []);

  const handleRealtimeMove = useCallback(
    (x: number, z: number, roomId: string | null) => {
      setMyPosition(x, z, roomId);
    },
    [setMyPosition],
  );

  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  const meName = me.data?.user.name ?? "You";

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans select-none">
      {/* Top bar: back · workspace · location · you */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        <button
          type="button"
          onClick={() => {
            const back = searchParams.get("from") ?? "/dashboard";
            navigate(back);
          }}
          className={`${CHIP} pointer-events-auto px-3.5 py-2 text-[12px] font-medium text-neutral-700 transition-colors hover:text-neutral-950 hover:bg-white/70`}
        >
          <FiArrowLeft className="size-3.5" aria-hidden />
          Dashboard
        </button>

        <div className={`${CHIP} px-4 py-1.5`}>
          <span className={EYEBROW}>Workspace</span>
          <span className="font-serif text-[13.5px] leading-none text-neutral-900">
            {workspaceName}
          </span>
        </div>

        <div className={`${CHIP} px-4 py-1.5`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connectionStatus === "open"
                ? "bg-emerald-500"
                : connectionStatus === "connecting" ||
                    connectionStatus === "reconnecting"
                  ? "bg-amber-500"
                  : "bg-rose-500"
            }`}
          />
          <span className={EYEBROW}>Location</span>
          <span className="font-serif text-[13.5px] leading-none text-neutral-900">
            {currentRoom}
          </span>
        </div>

        {/* Your own activity/tokens — remote members get this via their avatar */}
        <button
          type="button"
          onClick={() => setOpenMemberId(myUserId)}
          title="Your session & AI token usage"
          className={`${CHIP} pointer-events-auto ml-auto py-1.5 transition-colors hover:bg-white/70`}
        >
          <span className="font-serif text-[13.5px] leading-none text-neutral-900 px-2">
            {meName}
          </span>
        </button>
      </div>

      {/* Controls legend */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div
          className={`${CHIP} rounded-full px-4 py-2.5 text-[11px] font-medium text-neutral-500`}
        >
          {["W", "A", "S", "D"].map((k) => (
            <kbd
              key={k}
              className="-ml-0.5 rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-800 ring-1 ring-black/[0.09] shadow-[0_1px_0_rgba(28,25,18,0.18)]"
            >
              {k}
            </kbd>
          ))}
          <span className="ml-0.5">Move</span>
          <span className="h-3.5 w-px bg-black/[0.09]" />
          <span>
            <span className="font-semibold text-neutral-900">Shift</span> Run
          </span>
          <span className="h-3.5 w-px bg-black/[0.09]" />
          <span>
            <span className="font-semibold text-neutral-900">Space</span> Jump
          </span>
          <span className="h-3.5 w-px bg-black/[0.09]" />
          <span>
            <span className="font-semibold text-neutral-900">Drag</span> Look ·{" "}
            <span className="font-semibold text-neutral-900">Scroll</span> Zoom
          </span>
        </div>
      </div>

      {/* 3D world */}
      <Canvas
        shadows
        dpr={[1, 1.25]}
        camera={{ position: [0, 3, 46], fov: 50, near: 0.1, far: 900 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        className="w-full h-full"
      >
        <color attach="background" args={["#cdd8e3"]} />

        <OfficeLighting />
        <OfficeBuilding />

        <PlayerController
          playerRef={playerGroupRef}
          cameraYaw={cameraYaw}
          obstacles={PLAYER_COLLIDERS}
          spawn={SPAWN}
          modelUrl={playerModel}
          name={meName}
          status="Online"
          badgeColor="bg-emerald-400"
          onRoomChange={handleRoomChange}
          roomAt={roomAt}
          groundAt={supportAt}
          stepUp={STEP_UP}
          onRealtimeMove={handleRealtimeMove}
        />

        <RemoteAvatars
          avatars={avatars}
          myUserId={myUserId}
          pills={nearbyTokens}
          onAvatarClick={(id) => setOpenMemberId(id)}
        />

        <ThirdPersonCamera
          targetRef={playerGroupRef}
          colliders={CAMERA_COLLIDERS}
          onYawChange={setCameraYaw}
        />

        <Preload all />
        <PerfProbe />
      </Canvas>

      {/* Member modal */}
      <MemberDetailPopup
        workspaceId={workspaceId}
        myUserId={myUserId}
        client={client}
        developerId={openMemberId}
        onClose={() => setOpenMemberId(null)}
      />
    </div>
  );
}

export default WorldCanvas;
