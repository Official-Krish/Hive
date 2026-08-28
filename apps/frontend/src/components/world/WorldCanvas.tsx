import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import * as THREE from "three";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowLeft, FiMessageSquare } from "react-icons/fi";
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
import { ChatPanel } from "./ChatPanel";
import { GitHubNotificationBell } from "./GitHubNotificationBell";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";

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

const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  on_call: "bg-sky-500",
  busy: "bg-rose-500",
  offline: "bg-neutral-300",
};

/** Inline "set a custom label" row for the presence picker. */
function CustomLabelRow({
  current,
  onApply,
}: {
  current: string;
  onApply: (label: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-1 border-t border-black/[0.07] pt-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onApply(value.trim());
        }}
        placeholder={current === "Online" ? "Custom status…" : current}
        maxLength={60}
        className="w-full rounded-lg border border-black/[0.09] bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-neutral-900/40"
      />
      {value.trim() && (
        <button
          type="button"
          onClick={() => onApply(value.trim())}
          className="mt-1 w-full rounded-lg bg-neutral-950 py-1 text-[11.5px] font-semibold text-white hover:bg-neutral-800"
        >
          Set "{value.trim().slice(0, 24)}"
        </button>
      )}
    </div>
  );
}

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

  const [chatOpen, setChatOpen] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const { client, avatars, nearIds, connectionStatus, setMyPosition } =
    useRealtimeMap(workspaceId, myUserId);
  const nearbyTokens = useNearbyTokens(workspaceId, client, nearIds);
  const chat = useChat(workspaceId, myUserId, client, chatOpen);

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

  // Members whose agent is blocked / waiting on them.
  const needsAttention = [...avatars.entries()].filter(
    ([id, a]) =>
      id !== myUserId &&
      (a.sessionStatus === "blocked" || a.sessionStatus === "waiting_approval"),
  );

  // Chat panel + presence picker state.
  const myPresence = avatars.get(myUserId);
  const myStatusLabel =
    (myPresence?.label as string | undefined) ??
    (
      {
        online: "Online",
        away: "Away",
        on_call: "On call",
        busy: "Busy",
      } as Record<string, string>
    )[myPresence?.status ?? "online"] ??
    "Online";

  // Office ticker: pushes, PRs and test pulses across the workspace.
  interface FeedItem {
    key: string;
    text: string;
    tone: "push" | "pr" | "test";
    at: number;
  }
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const avatarsRef = useRef(avatars);
  avatarsRef.current = avatars;
  const feedSeq = useRef(0);

  useEffect(() => {
    if (!client) return;
    const nameOf = (id: string) =>
      avatarsRef.current.get(id)?.name ?? "Someone";
    const push = (text: string, tone: FeedItem["tone"]) => {
      setFeed((prev) =>
        [
          {
            key: `${Date.now()}-${++feedSeq.current}`,
            text,
            tone,
            at: Date.now(),
          },
          ...prev,
        ].slice(0, 4),
      );
    };
    const offs = [
      client.on("repo.push", (e) =>
        push(
          `${e.commitCount} commit${e.commitCount === 1 ? "" : "s"} → ${e.repoName} (${e.branch.replace("refs/heads/", "")})`,
          "push",
        ),
      ),
      client.on("pr.updated", (e) =>
        push(`PR #${e.prNumber} ${e.status} · ${e.title}`, "pr"),
      ),
      client.on("test.finished", (e) =>
        push(
          `${nameOf(e.developerId)} — tests ${e.passed ? "passed" : "failed"}${
            e.durationMs ? ` (${(e.durationMs / 1000).toFixed(1)}s)` : ""
          }`,
          "test",
        ),
      ),
    ];
    const prune = setInterval(
      () => setFeed((prev) => prev.filter((f) => Date.now() - f.at < 60_000)),
      10_000,
    );
    return () => {
      offs.forEach((off) => off());
      clearInterval(prune);
    };
  }, [client]);

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

        {/* Agents waiting on a human — click cycles through them */}
        {needsAttention.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenMemberId(needsAttention[0]?.[0] ?? null)}
            title={`${needsAttention.length} agent(s) need you — ${needsAttention
              .map(([, a]) => a.name || "member")
              .join(", ")}`}
            className={`${CHIP} pointer-events-auto ml-auto border-amber-500/40 bg-amber-50/95 py-1.5 transition-colors hover:bg-amber-100/95`}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            <span className="text-[12px] font-semibold text-amber-900">
              {needsAttention.length} agent
              {needsAttention.length === 1 ? "" : "s"} need you
            </span>
          </button>
        )}

        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          {/* GitHub notifications */}
          <GitHubNotificationBell workspaceId={workspaceId} client={client} />

          {/* Chat toggle */}
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            title="Messages"
            className={`${CHIP} relative px-3 py-2 transition-colors hover:bg-white/70`}
          >
            <FiMessageSquare className="size-4 text-neutral-700" />
            {chat.totalUnread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold text-white ring-2 ring-[#faf9f6]">
                {chat.totalUnread > 9 ? "9+" : chat.totalUnread}
              </span>
            )}
          </button>

          {/* Status picker + identity */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusMenu((v) => !v)}
              title={`${myStatusLabel} — change status`}
              className={`${CHIP} py-1.5 transition-colors hover:bg-white/70`}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  STATUS_DOT[myPresence?.status ?? "online"] ??
                    "bg-emerald-500",
                )}
              />
              <span className="font-serif text-[13.5px] leading-none text-neutral-900">
                {meName}
              </span>
              {myPresence?.label && (
                <span className="max-w-[140px] truncate text-[11px] font-medium text-neutral-600">
                  · {myPresence.label}
                </span>
              )}
            </button>

            {statusMenu && (
              <div
                className={`${CHIP} absolute right-0 top-full z-20 mt-2 flex w-56 flex-col items-stretch gap-0.5 p-2`}
              >
                {(
                  [
                    ["online", "Online"],
                    ["away", "Away"],
                    ["on_call", "On call"],
                    ["busy", "Busy"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      client?.sendPresence(value);
                      setStatusMenu(false);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-black/[0.05]",
                      (myPresence?.status ?? "online") === value
                        ? "font-semibold text-neutral-900"
                        : "text-neutral-700",
                    )}
                  >
                    <span
                      className={cn("h-2 w-2 rounded-full", STATUS_DOT[value])}
                    />
                    {label}
                  </button>
                ))}
                <CustomLabelRow
                  current={myStatusLabel}
                  onApply={(label) => {
                    client?.sendPresence(
                      (myPresence?.status as
                        "online" | "away" | "on_call" | "busy") ?? "online",
                      label,
                    );
                    setStatusMenu(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
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

      {/* Office ticker — pushes / PRs / test pulses */}
      {feed.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {feed.slice(0, 3).map((f, i) => (
            <div
              key={f.key}
              className={`${CHIP} px-3.5 py-1.5 text-[11px] font-medium text-neutral-700 ${
                i === 0 ? "opacity-100" : i === 1 ? "opacity-70" : "opacity-45"
              }`}
              style={{ transform: `scale(${1 - i * 0.04})` }}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  f.tone === "test"
                    ? "bg-sky-500"
                    : f.tone === "pr"
                      ? "bg-violet-500"
                      : "bg-emerald-500"
                }`}
              />
              <span className="whitespace-nowrap">{f.text}</span>
            </div>
          ))}
        </div>
      )}

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

      {/* Chat panel */}
      {chatOpen && (
        <div className="pointer-events-auto absolute bottom-4 right-4 z-20">
          <ChatPanel
            workspaceId={workspaceId}
            myUserId={myUserId}
            client={client}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export default WorldCanvas;
