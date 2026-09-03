import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas,
  events as createPointerEvents,
  useThree,
} from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import * as THREE from "three";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowLeft, FiMessageSquare, FiUsers } from "react-icons/fi";
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
import { useLiveKitCall } from "@/hooks/useLiveKitCall";
import { useNearbyTokens } from "@/hooks/useNearbyTokens";
import { useInteractions } from "@/hooks/useInteractions";
import { useFocusRoom } from "@/hooks/useFocusRoom";
import { usePairSession } from "@/hooks/usePairSession";
import { http } from "@/lib/http";
import RemoteAvatars from "./RemoteAvatars";
import { MemberDetailPopup } from "./MapHud";
import { ChatPanel } from "./ChatPanel";
import { GitHubNotificationBell } from "./GitHubNotificationBell";
import { CallStage } from "./CallStage";
import { CallControls } from "./CallControls";
import { WorkspaceModal } from "./WorkspaceModal";
import { CiDashboardModal } from "./CiDashboardModal";
import { WhiteboardModal } from "./WhiteboardModal";
import { PairSessionModal } from "./PairSessionModal";
import { PairModeBar } from "./PairModeBar";
import { PeerCursorOverlay } from "./PeerCursorOverlay";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { cn } from "@/lib/utils";
import { useChillMedia } from "@/hooks/useChillMedia";
import { ChillScreenProjection } from "./ChillScreenProjection";
import { ChillScreenModal } from "./ChillScreenModal";
import { GamesModal } from "./GamesModal";
import { useChat } from "@/hooks/useChat";
import {
  Coffee,
  Clapperboard,
  Droplets,
  Gamepad2,
  Gauge,
  Monitor,
  PenLine,
  Volume2,
  Zap,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { Interactable, InteractableIcon } from "./interactions";

const DEFAULT_AVATAR =
  AVATARS.male[0]?.model ?? "/avatars/male/hive_male_01.glb";

/* HUD material — the console's bone-paper instruments, tuned for the pale
   sky. Shared by every floating control so the frame reads as one system. */
const INTERACTABLE_ICONS: Record<InteractableIcon, LucideIcon> = {
  coffee: Coffee,
  water: Droplets,
  monitor: Monitor,
  board: PenLine,
  ci: Gauge,
  chill: Clapperboard,
  arcade: Gamepad2,
};

const CHIP =
  "inline-flex items-center gap-2.5 rounded-full bg-[#f4f2ed]/95 ring-1 ring-black/[0.09] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_28px_-16px_rgba(28,25,18,0.5)] " +
  "backdrop-blur-sm";
const EYEBROW =
  "text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400 leading-none";

/* r3f v9.7 `events.connect(target)` can fire with a null container during a
   Provider remount when the tree churns (upstream #3754). Unlike `disconnect`
   it is unguarded, so we no-op null targets — the next real connect re-attaches
   listeners cleanly, instead of unmounting the whole app with a TypeError. */
const safePointerEvents: typeof createPointerEvents = (store) => {
  const manager = createPointerEvents(store);
  const connect = manager.connect?.bind(manager);
  manager.connect = (target) => {
    if (!target) return;
    connect?.(target);
  };
  return manager;
};

const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  on_call: "bg-sky-500",
  busy: "bg-rose-500",
  focusing: "bg-purple-500",
  offline: "bg-neutral-300",
};

const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  away: "Away",
  on_call: "On call",
  busy: "Busy",
  focusing: "Focusing",
  offline: "Offline",
};

/** Inline "set a value" row for the presence picker: custom label and
 *  "working on" both use this; a Set button appears on text, a Clear button
 *  when a value is currently set. */
function InlineTextRow({
  placeholder,
  button,
  onApply,
  onFocusChange,
  onClear,
  showClear,
}: {
  placeholder: string;
  button: (value: string) => string;
  onApply: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onClear?: () => void;
  showClear?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-1 border-t border-black/[0.07] pt-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onApply(value.trim());
        }}
        placeholder={placeholder}
        maxLength={60}
        className="w-full rounded-lg text-neutral-700 border border-black/[0.09] bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-neutral-900/40"
      />
      {(value.trim() || showClear) && (
        <div className="mt-1 flex items-stretch gap-1">
          {value.trim() && (
            <button
              type="button"
              onClick={() => onApply(value.trim())}
              className="flex-1 rounded-lg bg-neutral-950 py-1 text-[11.5px] font-semibold text-white hover:bg-neutral-800"
            >
              {button(value.trim())}
            </button>
          )}
          {showClear && onClear && !value.trim() && (
            <button
              type="button"
              onClick={onClear}
              className="flex-1 rounded-lg bg-black/[0.06] py-1 text-[11.5px] font-semibold text-neutral-600 hover:bg-black/[0.1]"
            >
              Clear
            </button>
          )}
        </div>
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
  const [, setNotifOpen] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [statusInputFocused, setStatusInputFocused] = useState(false);
  const { client, avatars, nearIds, connectionStatus, setMyPosition } =
    useRealtimeMap(workspaceId, myUserId);
  const onlineCount = useMemo(
    () =>
      [...avatars.values()].filter((a) => a.status && a.status !== "offline")
        .length,
    [avatars],
  );
  const focus = useFocusRoom({
    myUserId,
    currentRoom,
    client,
    avatars,
  });
  const pair = usePairSession({
    workspaceId,
    myUserId,
    currentRoom,
    client,
    avatars,
  });
  const call = useLiveKitCall(workspaceId, myUserId, nearIds, onlineCount, {
    volumePeers: focus.allowedPeers,
    muteRemote: focus.inFocus,
    suppressPublish: focus.inFocus && !focus.partnerId,
    forcePublish: pair.active !== null,
  });
  const nearbyTokens = useNearbyTokens(workspaceId, client, nearIds);
  const chat = useChat(workspaceId, myUserId, client, chatOpen);
  const chill = useChillMedia(client, currentRoom === "Chill Space");

  // Pair-session collaborative cursor: forward my pointer to the active
  // session as normalised window coordinates (throttled inside the hook).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pair.sendCursor(
        e.clientX / window.innerWidth,
        e.clientY / window.innerHeight,
      );
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [pair.sendCursor]);

  const CURSOR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"];
  const cursorColorOf = (id: string): string =>
    CURSOR_COLORS[
      [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
        CURSOR_COLORS.length
    ] ?? "#6366f1";

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
  const nameOf = (id: string) => avatars.get(id)?.name ?? id;

  const repoQuery = useQuery({
    queryKey: ["repository", workspaceId, pair.active?.repositoryId],
    queryFn: () =>
      http.reads.repository(workspaceId, pair.active!.repositoryId!),
    enabled: !!pair.active?.repositoryId,
  });
  const repoName = repoQuery.data?.name ?? null;

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
    STATUS_LABEL[myPresence?.status ?? "online"] ??
    "Online";

  // Members directory: full workspace roster stamped with live presence.
  const roster = useMemo(() => {
    const rank = (s?: string) =>
      s === "online"
        ? 0
        : s === "on_call"
          ? 1
          : s === "focusing"
            ? 2
            : s === "busy"
              ? 3
              : s === "away"
                ? 4
                : 5;
    return chat.members
      .map((m) => {
        const live = avatars.get(m.userId);
        return {
          userId: m.userId,
          name: m.name,
          status: live?.status ?? "offline",
          label: live?.label ?? null,
          workingOn: live?.workingOn ?? null,
          isMe: m.userId === myUserId,
        };
      })
      .sort(
        (a, b) =>
          (a.isMe === b.isMe ? 0 : a.isMe ? -1 : 1) ||
          rank(a.status) - rank(b.status) ||
          a.name.localeCompare(b.name),
      );
  }, [chat.members, avatars, myUserId]);

  // Office ticker: pushes, PRs and test pulses across the workspace.
  interface FeedItem {
    key: string;
    text: string;
    tone: "push" | "pr" | "test" | "bump" | "focusing" | "merge";
    at: number;
  }
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const avatarsRef = useRef(avatars);
  avatarsRef.current = avatars;
  const feedSeq = useRef(0);
  const workingOnSeenRef = useRef<Map<string, string>>(new Map());
  const confettiRef = useRef<ConfettiRef>(null);

  const fireConfetti = useCallback(() => {
    void confettiRef.current?.fire({
      particleCount: 140,
      spread: 75,
      startVelocity: 42,
      scalar: 1.05,
      ticks: 220,
      zIndex: 9999,
      origin: { y: 0.7 },
      colors: ["#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#38bdf8"],
    });
  }, []);

  const pushFeed = useCallback((text: string, tone: FeedItem["tone"]) => {
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
  }, []);

  // Short-lived "speech bubble" texts pinned above remote avatars.
  const [bumpBubbles, setBumpBubbles] = useState<Record<string, string>>({});
  const addBubble = useCallback((id: string, text: string) => {
    setBumpBubbles((prev) => ({ ...prev, [id]: text }));
    window.setTimeout(() => {
      setBumpBubbles((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 5000);
  }, []);

  // Player world position (feet height included) for proximity interactions.
  const [playerPos, setPlayerPos] = useState<[number, number, number]>([
    SPAWN[0],
    SPAWN[1],
    SPAWN[2],
  ]);
  const [coffeeActive, setCoffeeActive] = useState(false);
  const [toast, setToast] = useState<React.ReactNode | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [ciOpen, setCiOpen] = useState(false);
  const [whiteboardId, setWhiteboardId] = useState<string | null>(null);
  const [chillScreenOpen, setChillScreenOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);

  const showToast = useCallback((node: React.ReactNode) => {
    setToast(node);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleInteract = useCallback(
    (it: Interactable) => {
      switch (it.kind) {
        case "coffee": {
          setCoffeeActive(true);
          showToast(
            <span className="inline-flex items-center gap-1.5">
              <Coffee className="size-3.5" />
              +10 energy — freshly roasted
            </span>,
          );
          window.setTimeout(() => setCoffeeActive(false), 4500);
          break;
        }
        case "cooler": {
          client?.sendBump(currentRoom || null);
          pushFeed("You're at the water cooler", "bump");
          break;
        }
        case "monitor":
          setWorkspaceOpen(true);
          break;
        case "ci":
          setCiOpen(true);
          break;
        case "chill-screen":
          setChillScreenOpen(true);
          break;
        case "arcade":
          setGamesOpen(true);
          break;
        case "whiteboard":
          setWhiteboardId(it.id);
          break;
      }
    },
    [client, currentRoom, myUserId, addBubble, pushFeed, showToast],
  );

  const interaction = useInteractions({
    pos: playerPos,
    blocked:
      chatOpen ||
      statusInputFocused ||
      membersOpen ||
      statusMenu ||
      openMemberId !== null ||
      workspaceOpen ||
      ciOpen ||
      chillScreenOpen ||
      gamesOpen ||
      whiteboardId !== null,
    onPress: handleInteract,
  });

  useEffect(() => {
    if (!client) return;
    const nameOf = (id: string) =>
      avatarsRef.current.get(id)?.name ?? "Someone";
    const push = pushFeed;
    const offs = [
      client.on("repo.push", (e) =>
        push(
          `${e.commitCount} commit${e.commitCount === 1 ? "" : "s"} → ${e.repoName} (${e.branch.replace("refs/heads/", "")})`,
          "push",
        ),
      ),
      client.on("pr.updated", (e) => {
        if (e.status === "merged") {
          const who = e.authorName
            ? (e.authorId && avatarsRef.current.get(e.authorId)?.name) ||
              e.authorName
            : e.authorId && avatarsRef.current.get(e.authorId)?.name;
          if (e.authorId && e.authorId === myUserId) {
            push("You merged PR #" + e.prNumber, "merge");
            fireConfetti();
          } else {
            const label = who ? `${who} — ` : "";
            push(`${label}PR #${e.prNumber} merged`, "merge");
          }
        } else {
          push(`PR #${e.prNumber} ${e.status} · ${e.title}`, "pr");
        }
      }),
      client.on("test.finished", (e) =>
        push(
          `${nameOf(e.developerId)} — tests ${e.passed ? "passed" : "failed"}${
            e.durationMs ? ` (${(e.durationMs / 1000).toFixed(1)}s)` : ""
          }`,
          "test",
        ),
      ),
      client.on("social.bump", (e) => {
        if (e.developerId === myUserId) return;
        push(
          `${nameOf(e.developerId)} is at the water cooler${
            e.roomId ? ` · ${e.roomId}` : ""
          }`,
          "bump",
        );
      }),
      client.on("chill.media.state", (e) => {
        if (!e.videoUrl || !e.setByName) return;
        showToast(`${e.setByName} put up a video in Chill Space`);
      }),
      client.on("presence.changed", (e) => {
        if (e.developerId === myUserId) return;
        if (e.status === "focusing") {
          push(`${nameOf(e.developerId)} is focusing`, "focusing");
        }
        if (
          e.workingOn &&
          workingOnSeenRef.current.get(e.developerId) !== e.workingOn
        ) {
          workingOnSeenRef.current.set(e.developerId, e.workingOn);
          push(
            `${nameOf(e.developerId)} is working on ${e.workingOn}`,
            "focusing",
          );
        }
        if (!e.workingOn && workingOnSeenRef.current.has(e.developerId)) {
          workingOnSeenRef.current.delete(e.developerId);
        }
      }),
    ];
    const prune = setInterval(
      () => setFeed((prev) => prev.filter((f) => Date.now() - f.at < 60_000)),
      10_000,
    );
    return () => {
      offs.forEach((off) => off());
      clearInterval(prune);
    };
  }, [client, myUserId, pushFeed, addBubble, fireConfetti, showToast]);

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
          <GitHubNotificationBell
            workspaceId={workspaceId}
            client={client}
            onOpenChange={setNotifOpen}
          />

          {/* Members directory */}
          <button
            type="button"
            onClick={() => {
              void chat.refreshMembers();
              setMembersOpen((v) => !v);
            }}
            title="Members — who's in this workplace"
            className={`${CHIP} relative px-3 py-2 transition-colors hover:bg-white/70`}
          >
            <FiUsers className="size-4 text-neutral-700" />
            {onlineCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold text-white ring-2 ring-[#faf9f6]">
                {onlineCount}
              </span>
            )}
          </button>

          {membersOpen && (
            <div className="fixed top-16 right-4 z-30 flex max-h-[calc(100vh-6rem)] w-80 flex-col overflow-hidden rounded-2xl bg-[#f4f2ed]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_48px_-20px_rgba(28,25,18,0.5)] ring-1 ring-black/[0.09] backdrop-blur-md">
              <div className="flex items-end justify-between border-b border-black/[0.06] px-4 pb-2 pt-3">
                <span className={EYEBROW}>Members</span>
                <span className="text-[10.5px] font-medium text-neutral-500">
                  {onlineCount} online · {roster.length} total
                </span>
              </div>
              <div className="flex flex-col overflow-y-auto p-2">
                {roster.map((row) => (
                  <div
                    key={row.userId}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        STATUS_DOT[row.status] ?? "bg-neutral-300",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-neutral-900">
                        {row.name}
                        {row.isMe && (
                          <span className="ml-1.5 font-normal text-neutral-400">
                            (you)
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[10.5px] text-neutral-500">
                        {row.label && row.workingOn
                          ? `${row.label} · ${row.workingOn}`
                          : (row.workingOn ??
                            row.label ??
                            STATUS_LABEL[row.status] ??
                            row.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {myPresence?.workingOn && (
                <span className="inline-flex max-w-[150px] items-center gap-1 truncate text-[11px] font-medium text-violet-600">
                  <Zap className="size-3 shrink-0" />
                  <span className="truncate">{myPresence.workingOn}</span>
                </span>
              )}
            </button>

            {statusMenu && (
              <div className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col items-stretch gap-0.5 rounded-xl bg-[#f4f2ed]/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_48px_-20px_rgba(28,25,18,0.5)] ring-1 ring-black/[0.09] backdrop-blur-md">
                {(
                  [
                    ["online", "Online"],
                    ["away", "Away"],
                    ["on_call", "On call"],
                    ["busy", "Busy"],
                    ["focusing", "Focusing"],
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
                <InlineTextRow
                  placeholder={
                    myStatusLabel === "Online"
                      ? "Custom status…"
                      : myStatusLabel
                  }
                  button={(v) => `Set "${v.slice(0, 24)}"`}
                  onFocusChange={setStatusInputFocused}
                  onApply={(label) => {
                    client?.sendPresence(
                      (myPresence?.status as
                        "online" | "away" | "on_call" | "busy" | "focusing") ??
                        "online",
                      label,
                    );
                    setStatusMenu(false);
                  }}
                />
                <InlineTextRow
                  placeholder="Working on…"
                  button={(v) => `Working on "${v.slice(0, 24)}"`}
                  onFocusChange={setStatusInputFocused}
                  onApply={(workingOn) => {
                    client?.sendPresence(
                      (myPresence?.status as
                        "online" | "away" | "on_call" | "busy" | "focusing") ??
                        "online",
                      myPresence?.label ?? undefined,
                      workingOn,
                    );
                    setStatusMenu(false);
                  }}
                  onClear={() => {
                    client?.sendPresence(
                      (myPresence?.status as
                        "online" | "away" | "on_call" | "busy" | "focusing") ??
                        "online",
                      myPresence?.label ?? undefined,
                      null,
                    );
                    setStatusMenu(false);
                  }}
                  showClear={!!myPresence?.workingOn}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interaction hint + toast (bottom-left, above the movement legend) */}
      {!workspaceOpen &&
        !ciOpen &&
        !whiteboardId &&
        (interaction.near || toast) && (
          <div className="pointer-events-none absolute bottom-20 left-4 z-10 flex flex-col items-start gap-1.5">
            {interaction.near &&
              (() => {
                const Icon = INTERACTABLE_ICONS[interaction.near.icon];
                return (
                  <div className={`${CHIP} px-3.5 py-2`}>
                    <kbd className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-800 ring-1 ring-black/[0.09] shadow-[0_1px_0_rgba(28,25,18,0.18)]">
                      E
                    </kbd>
                    <Icon className="size-3.5 shrink-0" />
                    <span className="text-[12px] font-semibold text-neutral-800">
                      {interaction.near.prompt}
                    </span>
                  </div>
                );
              })()}
            {toast && (
              <div
                className={`${CHIP} border-amber-500/30 bg-amber-50/95 px-3.5 py-1.5`}
              >
                <span className="text-[11.5px] font-semibold text-amber-800">
                  {toast}
                </span>
              </div>
            )}
          </div>
        )}

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

      {/* Office ticker — pushes / PRs / test pulses (hidden while a call is active) */}
      {feed.length > 0 && nearIds.size === 0 && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {feed.slice(0, 3).map((f, i) => (
            <div
              key={f.key}
              className={`${CHIP} max-w-[400px] px-3.5 py-1.5 text-[11px] font-medium text-neutral-700 ${
                i === 0 ? "opacity-100" : i === 1 ? "opacity-70" : "opacity-45"
              }`}
              style={{ transform: `scale(${1 - i * 0.04})` }}
            >
              <span className="shrink-0">
                {f.tone === "merge" ? (
                  <Trophy className="size-3 text-amber-500" />
                ) : (
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      f.tone === "test"
                        ? "bg-sky-500"
                        : f.tone === "pr"
                          ? "bg-violet-500"
                          : f.tone === "bump"
                            ? "bg-amber-500"
                            : f.tone === "focusing"
                              ? "bg-purple-500"
                              : "bg-emerald-500"
                    }`}
                  />
                )}
              </span>
              <span className="min-w-0 truncate">{f.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Focus pod widget — presence, mute state and pairing (only inside a focus room) */}
      {focus.inFocus && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {focus.partnerId ? (
            <div className={`${CHIP} pointer-events-auto px-3.5 py-2`}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
              <span className="text-[12px] font-semibold text-neutral-800">
                Focusing with {nameOf(focus.partnerId)}
              </span>
              <span className="hidden h-3.5 w-px shrink-0 bg-black/[0.09] sm:block" />
              <span className="text-[10.5px] font-medium text-neutral-500">
                audio on — spatial audio muted for everyone else
              </span>
              <button
                type="button"
                onClick={focus.endPartner}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-black/[0.09] shadow-[0_1px_0_rgba(28,25,18,0.18)] transition-colors hover:bg-neutral-50"
              >
                End
              </button>
            </div>
          ) : focus.pendingInvite ? (
            <div
              className={`${CHIP} pointer-events-auto border-purple-500/30 bg-purple-50/95 px-3.5 py-2`}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
              <span className="text-[12px] font-semibold text-neutral-800">
                {focus.pendingInvite.name} wants to focus together
              </span>
              <button
                type="button"
                onClick={() => focus.accept(focus.pendingInvite!.id)}
                className="rounded-lg bg-purple-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_1px_0_rgba(28,25,18,0.25)] transition-colors hover:bg-purple-700"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => focus.decline(focus.pendingInvite!.id)}
                className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-black/[0.09] shadow-[0_1px_0_rgba(28,25,18,0.18)] transition-colors hover:bg-neutral-50"
              >
                Decline
              </button>
            </div>
          ) : (
            <>
              {focus.invitedId && (
                <div className={`${CHIP} pointer-events-auto px-3.5 py-2`}>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
                  <span className="text-[12px] font-semibold text-neutral-800">
                    Invite sent to {nameOf(focus.invitedId)}…
                  </span>
                  <button
                    type="button"
                    onClick={() => focus.decline(focus.invitedId!)}
                    title="Cancel invite"
                    className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-black/[0.09] shadow-[0_1px_0_rgba(28,25,18,0.18)] transition-colors hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {focus.suggestPartnerId && !focus.invitedId && (
                <div className={`${CHIP} pointer-events-auto px-3.5 py-2`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span className="text-[12px] font-semibold text-neutral-800">
                    {nameOf(focus.suggestPartnerId)} is focusing in here
                  </span>
                  <button
                    type="button"
                    onClick={() => focus.invite(focus.suggestPartnerId!)}
                    className="rounded-lg bg-purple-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_1px_0_rgba(28,25,18,0.25)] transition-colors hover:bg-purple-700"
                  >
                    Invite
                  </button>
                </div>
              )}
              {!focus.partnerId &&
                !focus.pendingInvite &&
                !focus.suggestPartnerId && (
                  <div className={`${CHIP} pointer-events-none px-3.5 py-2`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                    <span className="text-[11.5px] font-semibold text-neutral-700">
                      Focusing — mic muted until someone joins
                    </span>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {/* Pair-programming session bar (only inside an active pair room) */}
      {pair.active && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <PairModeBar
            repoName={repoName}
            memberNames={pair.active.members
              .filter((m) => m.userId !== myUserId)
              .map((m) => m.name)}
            onEnd={() => void pair.end()}
            onOpenLink={() => {}}
          />
        </div>
      )}

      {/* Collaborative cursors while pairing */}
      <PeerCursorOverlay
        cursors={pair.peerCursors}
        nameOf={nameOf}
        colorOf={cursorColorOf}
      />

      {/* Pair-session setup modal (auto-shown when two people meet in a
          pair-programming room without a session) */}
      {pair.open && pair.suggestedPartnerId && (
        <PairSessionModal
          workspaceId={workspaceId}
          partnerName={nameOf(pair.suggestedPartnerId)}
          onStart={(repositoryId) => void pair.start(repositoryId)}
          onClose={pair.close}
        />
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
        events={safePointerEvents}
        className="w-full h-full"
      >
        <color attach="background" args={["#cdd8e3"]} />

        <OfficeLighting />
        <OfficeBuilding />
        <ChillScreenProjection active={!!chill.state.videoId} />

        <PlayerController
          playerRef={playerGroupRef}
          cameraYaw={cameraYaw}
          obstacles={PLAYER_COLLIDERS}
          spawn={SPAWN}
          modelUrl={playerModel}
          name={meName}
          status={myStatusLabel}
          badgeColor={
            STATUS_DOT[myPresence?.status ?? "online"] ?? "bg-emerald-500"
          }
          disabled={chatOpen || statusInputFocused}
          onRoomChange={handleRoomChange}
          onPositionUpdate={(pos) => setPlayerPos(pos)}
          roomAt={roomAt}
          groundAt={supportAt}
          stepUp={STEP_UP}
          onRealtimeMove={handleRealtimeMove}
          coffee={coffeeActive}
          hidden={workspaceOpen || whiteboardId !== null}
        />

        <RemoteAvatars
          avatars={avatars}
          myUserId={myUserId}
          pills={nearbyTokens}
          bubbles={bumpBubbles}
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
            presence={avatars}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}

      {/* Desk monitor — "open workspace" */}
      {workspaceOpen && (
        <WorkspaceModal
          workspaceId={workspaceId}
          myUserId={myUserId}
          client={client}
          onClose={() => setWorkspaceOpen(false)}
        />
      )}

      {/* Engineering CI wall screen */}
      {ciOpen && (
        <CiDashboardModal
          workspaceId={workspaceId}
          client={client}
          onClose={() => setCiOpen(false)}
        />
      )}

      {/* Whiteboard — shared canvas for the board you pressed E on */}
      {whiteboardId && (
        <WhiteboardModal
          boardId={whiteboardId}
          client={client}
          onClose={() => setWhiteboardId(null)}
        />
      )}

      {/* Chill Space shared screen + arcade station */}
      {chillScreenOpen && (
        <ChillScreenModal
          client={client}
          state={chill.state}
          onClose={() => setChillScreenOpen(false)}
        />
      )}
      {gamesOpen && <GamesModal onClose={() => setGamesOpen(false)} />}

      {/* Proximity voice/video — only when near other members.
          Bottom-center column: video tiles above the mic/camera controls. */}
      {nearIds.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex flex-col items-center gap-2">
          <div className="pointer-events-auto">
            <CallStage
              room={call.room}
              nearIds={nearIds}
              myUserId={myUserId}
              nameOf={(id) => avatars.get(id)?.name ?? id}
            />
          </div>
          {call.error && onlineCount >= 2 && (
            <div className="pointer-events-none rounded-full bg-rose-50/95 px-3 py-1.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-500/30">
              Voice unavailable
            </div>
          )}
          {call.mediaError && onlineCount >= 2 && (
            <div className="pointer-events-none rounded-full bg-rose-50/95 px-3 py-1.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-500/30">
              {call.mediaError}
            </div>
          )}
          <div className="pointer-events-auto">
            <CallControls
              micOn={call.micOn}
              cameraOn={call.cameraOn}
              sharing={call.sharing}
              toggleMic={call.toggleMic}
              toggleCamera={call.toggleCamera}
              toggleShare={call.toggleShare}
            />
          </div>
        </div>
      )}

      {/* Merge celebration — fires only when one of MY pull requests merges. */}
      <Confetti
        ref={confettiRef}
        manualstart
        className="pointer-events-none fixed inset-0 z-[9999] h-full w-full"
      />

      {/* Chill Space shared-screen volume — only while inside the room. */}
      {currentRoom === "Chill Space" && (
        <div className="fixed left-1/2 top-4 z-30 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#0b0d12]/85 py-2 pl-3 pr-2 text-neutral-200 ring-1 ring-white/10">
            <Volume2 className="h-4 w-4 text-neutral-400" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(chill.volume * 100)}
              onChange={(e) => chill.setVolume(Number(e.target.value) / 100)}
              className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-neutral-700 accent-[#6ee7b7]"
              aria-label="Chill space volume"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default WorldCanvas;
