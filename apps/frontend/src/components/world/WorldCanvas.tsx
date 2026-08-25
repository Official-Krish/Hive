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
import { http } from "@/lib/http";
import RemoteAvatars from "./RemoteAvatars";
import { NearbyPanel, MemberDetailPopup } from "./MapHud";

const AVATAR_OPTIONS = [...AVATARS.male, ...AVATARS.female];
const DEFAULT_AVATAR =
  AVATAR_OPTIONS[0]?.model ?? "/avatars/male/hive_male_01.glb";

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
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    myAvatarModel ?? DEFAULT_AVATAR,
  );
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const playerGroupRef = useRef<THREE.Group>(null);

  const { client, avatars, nearIds, connectionStatus, setMyPosition } =
    useRealtimeMap(workspaceId, myUserId);

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

  const connTone =
    connectionStatus === "open"
      ? "bg-emerald-400"
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div className="relative w-full h-screen bg-[#0b1017] overflow-hidden font-sans select-none">
      {/* Top bar: back + workspace + location + status + avatar picker */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-start justify-between gap-3 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              const back = searchParams.get("from") ?? "/dashboard";
              navigate(back);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/85 px-3 py-2.5 text-[12.5px] font-medium text-slate-200 shadow-2xl backdrop-blur-md transition-colors hover:text-white"
          >
            <FiArrowLeft className="size-4" aria-hidden />
            Dashboard
          </button>
          <div className="rounded-xl border border-white/10 bg-slate-900/85 px-4 py-2.5 shadow-2xl backdrop-blur-md">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
              Workspace
            </div>
            <div className="text-sm font-bold text-slate-50">
              {workspaceName}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/85 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${connTone} animate-pulse`}
            />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
                Location
              </div>
              <div className="text-sm font-bold text-slate-50">
                {currentRoom}
              </div>
            </div>
          </div>
        </div>

        <select
          value={selectedAvatar}
          onChange={(e) => setSelectedAvatar(e.target.value)}
          className="pointer-events-auto bg-slate-900/85 backdrop-blur-md border border-white/10 text-slate-200 text-xs rounded-xl px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-sky-500 shadow-2xl cursor-pointer"
        >
          {AVATAR_OPTIONS.map((a) => (
            <option key={a.model} value={a.model}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Controls legend */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className="bg-slate-900/85 backdrop-blur-md border border-white/10 text-slate-300 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            {["W", "A", "S", "D"].map((k) => (
              <kbd
                key={k}
                className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono font-bold text-white"
              >
                {k}
              </kbd>
            ))}
            <span className="ml-1 text-slate-400 font-medium">Move</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <span>
            <span className="text-slate-100 font-semibold">Shift</span> Run
          </span>
          <div className="h-4 w-px bg-white/10" />
          <span>
            <span className="text-slate-100 font-semibold">Space</span> Jump
          </span>
          <div className="h-4 w-px bg-white/10" />
          <span>
            <span className="text-slate-100 font-semibold">Drag</span> Look ·{" "}
            <span className="text-slate-100 font-semibold">Scroll</span> Zoom
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
          modelUrl={selectedAvatar}
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

      {/* HUD overlays */}
      <NearbyPanel
        myUserId={myUserId}
        avatars={avatars}
        nearIds={nearIds}
        onPickMember={(id) => setOpenMemberId(id)}
      />

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
