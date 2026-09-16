import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Canvas,
  events as createPointerEvents,
  useThree,
} from "@react-three/fiber";
import { Preload, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FiArrowLeft,
  FiAward,
  FiFlag,
  FiMessageSquare,
  FiUsers,
} from "react-icons/fi";
import { OfficeBuilding } from "./office/OfficeBuilding";
import { preloadKitFurniture } from "./InstancedFurniture";
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
import { ASSET_BASE_URL } from "@/lib/config";
import { useRealtimeMap } from "@/hooks/useRealtimeMap";
import { useLiveKitCall } from "@/hooks/useLiveKitCall";
import { useNearbyTokens } from "@/hooks/useNearbyTokens";
import { useInteractions } from "@/hooks/useInteractions";
import { useFocusRoom } from "@/hooks/useFocusRoom";
import { usePairSession } from "@/hooks/usePairSession";
import { useGameSession } from "@/hooks/useGameSession";
import { REVIEWER_BOT_ID, useReviewerBot } from "@/hooks/useReviewerBot";
import { http } from "@/lib/http";
import RemoteAvatars from "./RemoteAvatars";
import { Markers } from "./Markers";
import { WaterPour } from "./WaterPour";
import { WorldTour, markTourSeen, shouldShowTour } from "./WorldTour";
import { MemberDetailPopup } from "./MapHud";
import { ChatPanel } from "./ChatPanel";
import { GitHubNotificationBell } from "./GitHubNotificationBell";
import { GameInviteInbox } from "./GameInviteInbox";
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
import { STATUS_DOT, statusLabel, useDismiss } from "./chrome";
import { useChillMedia } from "@/hooks/useChillMedia";
import { ChillScreenProjection } from "./ChillScreenProjection";
import { ChillScreenModal } from "./ChillScreenModal";
import { GamesModal } from "./GamesModal";
import { FleetModal } from "./FleetModal";
import { ReviewerModal } from "./ReviewerModal";
import { VendingModal } from "./VendingModal";
import { useVending } from "@/hooks/useVending";
import { useChat } from "@/hooks/useChat";
import { useWatchdogAlerts } from "@/hooks/useWatchdogAlerts";
import { ThumbnailCapture } from "@/hooks/useWorldThumbnail";
import { AnimatePresence, WPopover, WToast, WToastStack } from "./motion";
import {
  Coffee,
  Clapperboard,
  Droplets,
  Gamepad2,
  Gauge,
  KeyRound,
  Monitor,
  PenLine,
  SearchCheck,
  Server,
  Volume2,
  Zap,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { Interactable, InteractableIcon } from "./interactions";
import { CHAIR_SIT_SPOTS, SIT_RADIUS } from "./interactions";

const DEFAULT_AVATAR =
  AVATARS.male[0]?.model ?? `${ASSET_BASE_URL}/avatars/male/hive_male_01.glb`;

/** Reviewer bot — purpose-built robot, not a human avatar. */
const BOT_MODEL = "https://cdn.krishlabs.tech/hive/avatars/robot.glb";

// Kit furniture GLBs start streaming with the world (tracked by AssetGate).
preloadKitFurniture();

/* HUD material — warm bone paper floating over the 3D scene, same voice
   as the light dashboard. Shared tokens live in ./chrome; these two
   aliases keep the frame terse. */
const CHIP =
  "inline-flex items-center gap-2.5 rounded-full bg-[#f4f2ed]/95 ring-1 ring-black/[0.09] " +
  "backdrop-blur-md";
const EYEBROW =
  "text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-500 leading-none";

const INTERACTABLE_ICONS: Record<InteractableIcon, LucideIcon> = {
  coffee: Coffee,
  water: Droplets,
  monitor: Monitor,
  board: PenLine,
  ci: Gauge,
  chill: Clapperboard,
  arcade: Gamepad2,
  vending: KeyRound,
  reviewer: SearchCheck,
  fleet: Server,
};

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

/** Friendly end-of-match reason for the celebration card. */
function endReason(kind: string, reason: string | null, won: boolean): string {
  const game = kind === "chess" ? "Chess" : "Connect Four";
  switch (reason) {
    case "checkmate":
      return won ? "by checkmate" : `checkmated in ${game}`;
    case "connect-four":
      return won ? "four in a row" : "four in a row";
    case "resign":
      return won ? "opponent resigned" : `you resigned from ${game}`;
    default:
      return reason ?? game;
  }
}
/** Inside-Canvas gate: releases the loading overlay once every tracked
 *  asset (GLBs, textures) has resolved, plus a short settle beat — with a
 *  hard timeout so a hung fetch can never trap the player.
 *  NOTE: timers run mount-only (callback via ref) so parent re-renders
 *  can never reset them — that was the stuck-on-loading bug. */
function AssetGate({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  // NOTE: intentionally polls useProgress.getState() on an interval instead
  // of subscribing via useProgress((s) => s.progress). The drei loading
  // manager emits progress synchronously while suspenseful loaders (useGLTF
  // in Avatar/KitPiece) resolve *during another component's render* — a
  // subscription setStates AssetGate mid-render and React logs
  // "Cannot update a component while rendering a different component".
  // Polling fires outside render, so the warning can never trigger.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (done.current || useProgress.getState().progress < 100) return;
      done.current = true;
      window.clearInterval(id);
      window.setTimeout(() => readyRef.current(), 500);
    }, 150);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!done.current) {
        done.current = true;
        readyRef.current();
      }
    }, 12000);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

/** Members directory popup — rows open the member card. Escape or outside click dismisses. */
function MembersPopup({
  roster,
  onlineCount,
  onClose,
  onOpenMember,
}: {
  roster: Array<{
    userId: string;
    name: string;
    status: string;
    label: string | null;
    workingOn: string | null;
    isMe: boolean;
  }>;
  onlineCount: number;
  onClose: () => void;
  onOpenMember: (userId: string) => void;
}) {
  const ref = useDismiss<HTMLDivElement>(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Members"
      className="fixed top-16 right-4 z-30 w-80"
    >
      <WPopover className="flex max-h-[calc(100vh-6rem)] flex-col">
        <div className="flex items-end justify-between border-b border-black/[0.07] px-4 pb-2 pt-3">
          <span className={EYEBROW}>Members</span>
          <span className="font-mono text-[10.5px] tabular-nums text-neutral-500">
            {onlineCount} online · {roster.length} total
          </span>
        </div>
        <div className="flex flex-col overflow-y-auto p-2">
          {roster.map((row) => (
            <button
              key={row.userId}
              type="button"
              onClick={() => {
                onOpenMember(row.userId);
                onClose();
              }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
              aria-label={`Open ${row.name}'s card`}
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
                    : (row.workingOn ?? row.label ?? statusLabel(row.status))}
                </span>
              </div>
            </button>
          ))}
        </div>
      </WPopover>
    </div>
  );
}

type PresenceValue = "online" | "away" | "on_call" | "busy" | "focusing";

/** Status picker menu — Escape or outside click dismisses. */
function StatusMenu({
  status,
  currentLabel,
  currentWorkingOn,
  onPick,
  onLabel,
  onWorkingOn,
  onClearWorkingOn,
  onFocusChange,
  onClose,
}: {
  status: string;
  currentLabel?: string | null;
  currentWorkingOn?: string | null;
  onPick: (value: PresenceValue) => void;
  onLabel: (label: string) => void;
  onWorkingOn: (workingOn: string) => void;
  onClearWorkingOn: () => void;
  onFocusChange?: (focused: boolean) => void;
  onClose: () => void;
}) {
  const ref = useDismiss<HTMLDivElement>(onClose);
  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Change status"
      className="absolute right-0 top-full z-20 mt-2 w-60"
    >
      <WPopover className="flex flex-col items-stretch gap-0.5 rounded-xl p-2">
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
            role="menuitemradio"
            aria-checked={status === value}
            onClick={() => onPick(value)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-black/[0.05]",
              status === value
                ? "font-semibold text-neutral-900"
                : "text-neutral-700",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[value])} />
            {label}
          </button>
        ))}
        <InlineTextRow
          placeholder="Custom status…"
          action="Set status"
          initialValue={currentLabel ?? ""}
          onFocusChange={onFocusChange}
          onApply={onLabel}
        />
        <InlineTextRow
          placeholder="Working on…"
          action="Set focus"
          initialValue={currentWorkingOn ?? ""}
          onFocusChange={onFocusChange}
          onApply={onWorkingOn}
          onClear={onClearWorkingOn}
          showClear
        />
      </WPopover>
    </div>
  );
}

/** Inline "set a value" row: prefilled with the current value when there is
 *  one; type + Set to change, Clear to remove. Input resets after applying. */
function InlineTextRow({
  placeholder,
  action,
  initialValue = "",
  onApply,
  onFocusChange,
  onClear,
  showClear,
}: {
  placeholder: string;
  action: string;
  initialValue?: string;
  onApply: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onClear?: () => void;
  showClear?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const apply = () => {
    const v = value.trim();
    if (!v) return;
    onApply(v);
    setValue("");
  };
  return (
    <div className="mt-1 border-t border-black/[0.07] pt-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
        }}
        placeholder={placeholder}
        maxLength={60}
        aria-label={placeholder}
        className="w-full rounded-lg border border-black/[0.09] bg-white px-2.5 py-1.5 text-[12px] text-neutral-700 outline-none placeholder:text-neutral-400 focus:border-neutral-900/40"
      />
      {(value.trim() || (showClear && onClear)) && (
        <div className="mt-1 flex items-stretch gap-1">
          {value.trim() ? (
            <button
              type="button"
              onClick={apply}
              className="flex-1 rounded-lg bg-neutral-950 py-1 text-[11.5px] font-semibold text-white hover:bg-neutral-800"
            >
              {action}
            </button>
          ) : (
            showClear &&
            onClear && (
              <button
                type="button"
                onClick={onClear}
                className="flex-1 rounded-lg bg-black/[0.05] py-1 text-[11.5px] font-semibold text-neutral-600 ring-1 ring-black/[0.07] hover:bg-black/[0.08]"
              >
                Clear
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** TEMP dev probe: exposes the renderer + scene for perf measurement. */
function PerfProbe() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    // No env variables in the frontend — dev-only probes gate on localhost.
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return;
    (window as unknown as Record<string, unknown>).__three = {
      gl,
      scene,
      camera,
    };
  }, [gl, scene, camera]);
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
  // Shared camera yaw (radians): written by ThirdPersonCamera on orbit, read
  // by PlayerController for movement. A ref — drag-look never re-renders.
  const sharedYaw = useRef(0);
  const [fpp, setFpp] = useState(false);
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
  const games = useGameSession({ workspaceId, myUserId, client });
  const reviewer = useReviewerBot(client, BOT_MODEL);
  const vending = useVending(workspaceId);
  const closeVending = useCallback(() => {
    vending.dismissReveal();
    setVendingOpen(false);
  }, [vending.dismissReveal]);
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
  // Listener only exists while a session is active.
  useEffect(() => {
    if (!pair.active) return;
    const onMove = (e: MouseEvent) => {
      pair.sendCursor(
        e.clientX / window.innerWidth,
        e.clientY / window.innerHeight,
      );
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [pair.sendCursor, pair.active]);

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
    (x: number, z: number, roomId: string | null, sitting: boolean) => {
      setMyPosition(x, z, roomId, sitting);
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
    statusLabel(myPresence?.status ?? "online");

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
    tone:
      | "push"
      | "pr"
      | "test"
      | "bump"
      | "focusing"
      | "merge"
      | "review"
      | "alert";
    at: number;
  }
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const avatarsRef = useRef(avatars);
  avatarsRef.current = avatars;
  const feedSeq = useRef(0);
  const workingOnSeenRef = useRef<Map<string, string>>(new Map());
  const confettiRef = useRef<ConfettiRef>(null);

  const fireConfetti = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
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

  // Match end celebration — wins get confetti + a title card, losses get a
  // title card. One-shot per match, both games, any decisive reason.
  const [endCelebration, setEndCelebration] = useState<{
    sessionId: string;
    kind: string;
    won: boolean;
    otherName: string;
    reason: string | null;
  } | null>(null);
  const celebratedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const s of games.sessions) {
      if (
        s.status === "finished" &&
        s.winnerUserId &&
        !celebratedRef.current.has(s.id)
      ) {
        const iWon = s.winnerUserId === myUserId;
        const iPlayed = s.members.some((m) => m.userId === myUserId);
        if (!iPlayed) continue;
        celebratedRef.current.add(s.id);
        const other =
          s.members.find((m) => m.userId !== myUserId)?.name ?? "Opponent";
        setEndCelebration({
          sessionId: s.id,
          kind: s.kind,
          won: iWon,
          otherName: other,
          reason: s.resultReason,
        });
        if (iWon) fireConfetti();
      }
    }
  }, [games.sessions, myUserId, fireConfetti]);

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

  // Bot renders through the normal avatar pipeline but stays out of
  // proximity/voice/counts — those keep using the raw member map.
  const avatarsWithBot = useMemo(
    () => new Map([...avatars, [REVIEWER_BOT_ID, reviewer.bot]]),
    [avatars, reviewer.bot],
  );
  const bubblesWithBot = useMemo(
    () => ({
      ...bumpBubbles,
      ...(reviewer.bubble ? { [REVIEWER_BOT_ID]: reviewer.bubble } : {}),
    }),
    [bumpBubbles, reviewer.bubble],
  );

  // Player world position (feet height included) for proximity interactions.
  const [playerPos, setPlayerPos] = useState<[number, number, number]>([
    SPAWN[0],
    SPAWN[1],
    SPAWN[2],
  ]);
  const [coffeeActive, setCoffeeActive] = useState(false);
  const [sitting, setSitting] = useState(false);
  const sitToggleRef = useRef<(() => void) | null>(null);
  // Nearest sittable chair (for the sit/stand hint) — recomputed from the
  // throttled player position, never per-frame. While seated the player is
  // on the chair, so the hint flips to "move to stand".
  const nearChair = useMemo(() => {
    const [x, feetY, z] = playerPos;
    return CHAIR_SIT_SPOTS.some(
      (s) =>
        Math.abs(feetY - s.y) <= 0.9 &&
        Math.hypot(x - s.x, z - s.z) <= SIT_RADIUS,
    );
  }, [playerPos]);
  const [waterActive, setWaterActive] = useState(false);
  interface WorldToast {
    key: string;
    node: React.ReactNode;
    tone: "neutral" | "warn";
  }
  const [toasts, setToasts] = useState<WorldToast[]>([]);
  const toastSeq = useRef(0);

  const showToast = useCallback(
    (node: React.ReactNode, tone: WorldToast["tone"] = "neutral") => {
      const key = `${Date.now()}-${++toastSeq.current}`;
      setToasts((prev) => [...prev.slice(-2), { key, node, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.key !== key));
      }, 3500);
    },
    [],
  );
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [ciOpen, setCiOpen] = useState(false);
  // Touch devices get an honest hint instead of WASD fiction.
  const [isCoarsePointer] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );
  const [whiteboardId, setWhiteboardId] = useState<string | null>(null);
  const [chillScreenOpen, setChillScreenOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [vendingOpen, setVendingOpen] = useState(false);
  const [reviewerOpen, setReviewerOpen] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  // Onboarding: renderer ready, spawn fade, first-run tour.
  const [worldReady, setWorldReady] = useState(false);
  const [spawnFaded, setSpawnFaded] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => shouldShowTour());
  const [loadingTip, setLoadingTip] = useState(0);
  // Stable callback so the in-Canvas gate's timers never reset on re-render.
  const handleWorldReady = useCallback(() => setWorldReady(true), []);

  // DOM-level escape hatch: if the Canvas never mounts (WebGL unavailable,
  // 3D tree error), the in-Canvas gate never runs — never trap the player.
  useEffect(() => {
    if (worldReady) return;
    const t = window.setTimeout(() => setWorldReady(true), 15000);
    return () => window.clearTimeout(t);
  }, [worldReady]);

  useEffect(() => {
    if (worldReady) return;
    const t = window.setInterval(() => setLoadingTip((v) => v + 1), 2600);
    return () => window.clearInterval(t);
  }, [worldReady]);

  useEffect(() => {
    if (!worldReady || spawnFaded) return;
    const t = window.setTimeout(() => setSpawnFaded(true), 900);
    return () => window.clearTimeout(t);
  }, [worldReady, spawnFaded]);

  // First-person toggle (V) — same guards as E so typing never toggles it.
  // Single source of truth: any open overlay blocks world input. Adding a
  // new modal means adding it here once — not in three parallel lists.
  // (The tour is deliberately absent: it's a non-blocking coachmark.)
  const anyOverlayOpen =
    !worldReady ||
    chatOpen ||
    statusInputFocused ||
    membersOpen ||
    statusMenu ||
    openMemberId !== null ||
    workspaceOpen ||
    ciOpen ||
    chillScreenOpen ||
    gamesOpen ||
    vendingOpen ||
    reviewerOpen ||
    fleetOpen ||
    whiteboardId !== null ||
    pair.open;
  const fppBlockedRef = useRef(anyOverlayOpen);
  fppBlockedRef.current = anyOverlayOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyV") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input,textarea,select,[contenteditable]")) return;
      if (fppBlockedRef.current) return;
      setFpp((v) => {
        if (!v) showToast("First-person — V or Esc to exit");
        return !v;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showToast]);

  // Agents waiting on a human — click cycles through them.
  const [attentionIdx, setAttentionIdx] = useState(0);

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
          window.setTimeout(() => setCoffeeActive(false), 4200);
          break;
        }
        case "cooler": {
          client?.sendBump(currentRoom || null);
          setWaterActive(true);
          showToast(
            <span className="inline-flex items-center gap-1.5">
              <Droplets className="size-3.5" />
              Hydrated — filing that cup
            </span>,
          );
          window.setTimeout(() => setWaterActive(false), 3800);
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
        case "vending":
          setVendingOpen(true);
          break;
        case "reviewer":
          setReviewerOpen(true);
          break;
        case "fleet":
          setFleetOpen(true);
          break;
        case "reviewer-console":
          setReviewerOpen(true);
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
    blocked: anyOverlayOpen,
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
      client.on("review.started", (e) =>
        push(`Reviewer started PR #${e.prNumber} · ${e.title}`, "review"),
      ),
      client.on("review.finished", (e) =>
        push(
          e.findingCount === 0
            ? `Reviewer: PR #${e.prNumber} looks clean`
            : `Reviewer: ${e.findingCount} finding${e.findingCount === 1 ? "" : "s"} on PR #${e.prNumber}`,
          "review",
        ),
      ),
      client.on("alert.created", (e) => push(e.message, "alert")),
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
        if (e.status === "offline") {
          // Departed members take their "working on" with them — otherwise
          // it re-fires stale when they reconnect.
          workingOnSeenRef.current.delete(e.developerId);
          return;
        }
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

  // Watchdog: worker-created alerts never hit the WS (separate process), so
  // poll the alerts API and push newly-seen OPEN alerts into the ticker.
  const watchdog = useWatchdogAlerts(workspaceId, client);
  const watchdogSeenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of watchdog.items) {
      if (watchdogSeenRef.current.has(a.id)) continue;
      watchdogSeenRef.current.add(a.id);
      pushFeed(a.message, "alert");
    }
  }, [watchdog.items, pushFeed]);

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans select-none">
      {/* Loading overlay — lifts only once the office assets are actually
          ready (not just renderer creation), with a timeout fallback so a
          hung fetch can never trap the player. */}
      {!worldReady && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#14171d]">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
            Loading Hive
          </div>
          <div className="h-1 w-44 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-400" />
          </div>
          <div className="max-w-[300px] text-center text-[12px] text-neutral-400">
            {
              [
                "Tip: walk north (W) through the glass entrance.",
                "Tip: press E at any glowing desk to open it.",
                "Tip: the west-end stairs lead up to L2.",
              ][loadingTip % 3]
            }
          </div>
        </div>
      )}
      {/* Spawn fade — eases out over the first second in-world */}
      {worldReady && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-30 bg-black/30 transition-opacity duration-700 motion-reduce:hidden ${
            spawnFaded ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      {/* Top bar: back · breadcrumb · you */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        <button
          type="button"
          onClick={() => {
            const back = searchParams.get("from") ?? "/dashboard";
            navigate(back);
          }}
          aria-label="Back to dashboard"
          className={`${CHIP} pointer-events-auto px-3 py-2 text-[12px] font-medium text-neutral-700 transition-colors hover:text-neutral-950 hover:bg-white/70`}
        >
          <FiArrowLeft className="size-3.5" aria-hidden />
        </button>

        <div className={`${CHIP} min-w-0 px-4 py-2`}>
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              connectionStatus === "open"
                ? "bg-emerald-500"
                : connectionStatus === "connecting" ||
                    connectionStatus === "reconnecting"
                  ? "bg-amber-500"
                  : "bg-rose-500"
            }`}
            aria-label={`Connection: ${connectionStatus}`}
          />
          <span className="max-w-[140px] truncate text-[13px] font-medium leading-none text-neutral-500">
            {workspaceName}
          </span>
          <span
            aria-hidden
            className="text-[13px] leading-none text-neutral-300"
          >
            /
          </span>
          <span className="max-w-[140px] truncate text-[13px] font-semibold leading-none text-neutral-900">
            {currentRoom}
          </span>
          <span className="rounded bg-white px-1 py-px font-mono text-[9px] font-semibold text-neutral-600 ring-1 ring-black/[0.09]">
            {playerPos[1] > 3.1 ? "L2" : "L1"}
          </span>
        </div>

        {/* Agents waiting on a human — click opens, advances on multiples */}
        {needsAttention.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const idx = attentionIdx % needsAttention.length;
              setOpenMemberId(needsAttention[idx]?.[0] ?? null);
              setAttentionIdx((i) => (i + 1) % needsAttention.length);
            }}
            title={`${needsAttention.length} agent${needsAttention.length === 1 ? "" : "s"} need${needsAttention.length === 1 ? "s" : ""} you — ${needsAttention
              .map(([, a]) => a.name || "member")
              .join(", ")}. Click to open the next one.`}
            className={`${CHIP} pointer-events-auto border-amber-500/40 bg-amber-50/95 py-2 shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_8px_24px_-8px_rgba(245,158,11,0.5)] transition-all hover:scale-[1.02] hover:bg-amber-100/95 active:scale-[0.98]`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-amber-900">
              {needsAttention.length} agent
              {needsAttention.length === 1 ? "" : "s"} need you
              {needsAttention.length > 1 &&
                ` · ${needsAttention[attentionIdx % needsAttention.length]?.[1]?.name ?? "next"}`}
            </span>
          </button>
        )}

        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          {/* Tour — reopens the first-run walkthrough */}
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            aria-label="Show tour"
            title="Show tour"
            className={`${CHIP} px-3 py-2 text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-white/70`}
          >
            ?
          </button>
          {/* GitHub notifications */}
          <GitHubNotificationBell
            workspaceId={workspaceId}
            client={client}
            onOpenChange={setNotifOpen}
          />

          {/* Game invites inbox — the only place to accept a challenge */}
          <GameInviteInbox
            games={games}
            onJoin={(id) => {
              void games.accept(id);
              setGamesOpen(true);
            }}
          />

          {/* Members directory */}
          <button
            type="button"
            onClick={() => {
              void chat.refreshMembers();
              setMembersOpen((v) => !v);
            }}
            aria-label="Members — who's in this workplace"
            aria-expanded={membersOpen}
            className={`${CHIP} relative px-3 py-2 transition-colors hover:bg-white/70`}
          >
            <FiUsers className="size-4 text-neutral-700" />
            {onlineCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold tabular-nums text-white ring-2 ring-[#faf9f6]">
                {onlineCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {membersOpen && (
              <MembersPopup
                roster={roster}
                onlineCount={onlineCount}
                onClose={() => setMembersOpen(false)}
                onOpenMember={(id) => setOpenMemberId(id)}
              />
            )}
          </AnimatePresence>

          {/* Chat toggle */}
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Messages"
            aria-expanded={chatOpen}
            className={`${CHIP} relative px-3 py-2 transition-colors hover:bg-white/70`}
          >
            <FiMessageSquare className="size-4 text-neutral-700" />
            {chat.totalUnread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold tabular-nums text-white ring-2 ring-[#faf9f6]">
                {chat.totalUnread > 9 ? "9+" : chat.totalUnread}
              </span>
            )}
          </button>

          {/* Status picker + identity */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusMenu((v) => !v)}
              aria-label={`${myStatusLabel} — change status`}
              aria-expanded={statusMenu}
              className={`${CHIP} py-2 transition-colors hover:bg-white/70`}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  STATUS_DOT[myPresence?.status ?? "online"] ??
                    "bg-emerald-500",
                )}
              />
              <span className="max-w-[120px] truncate text-[13px] font-medium leading-none text-neutral-900">
                {meName}
              </span>
              {myPresence?.label && (
                <span className="hidden max-w-[140px] truncate text-[11px] font-medium text-neutral-600 lg:inline">
                  · {myPresence.label}
                </span>
              )}
              {myPresence?.workingOn && (
                <span className="hidden max-w-[150px] items-center gap-1 truncate text-[11px] font-medium text-violet-600 lg:inline-flex">
                  <Zap className="size-3 shrink-0" />
                  <span className="truncate">{myPresence.workingOn}</span>
                </span>
              )}
            </button>

            <AnimatePresence>
              {statusMenu && (
                <StatusMenu
                  status={myPresence?.status ?? "online"}
                  currentLabel={myPresence?.label ?? null}
                  currentWorkingOn={myPresence?.workingOn ?? null}
                  onPick={(value) => {
                    client?.sendPresence(value);
                    setStatusMenu(false);
                  }}
                  onLabel={(label) => {
                    client?.sendPresence(
                      (myPresence?.status as
                        "online" | "away" | "on_call" | "busy" | "focusing") ??
                        "online",
                      label,
                    );
                    setStatusMenu(false);
                  }}
                  onWorkingOn={(workingOn) => {
                    client?.sendPresence(
                      (myPresence?.status as
                        "online" | "away" | "on_call" | "busy" | "focusing") ??
                        "online",
                      myPresence?.label ?? undefined,
                      workingOn,
                    );
                    setStatusMenu(false);
                  }}
                  onClearWorkingOn={() => {
                    client?.sendPresence(
                      (myPresence?.status as
                        "online" | "away" | "on_call" | "busy" | "focusing") ??
                        "online",
                      myPresence?.label ?? undefined,
                      null,
                    );
                    setStatusMenu(false);
                  }}
                  onFocusChange={setStatusInputFocused}
                  onClose={() => setStatusMenu(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Interaction hint + toast (bottom-left, above the movement legend) */}
      {!workspaceOpen &&
        !ciOpen &&
        !whiteboardId &&
        (interaction.near || nearChair || toasts.length > 0) && (
          <WToastStack>
            {interaction.near &&
              (() => {
                const Icon = INTERACTABLE_ICONS[interaction.near.icon];
                return (
                  <WToast id="interact" tone="neutral">
                    <button
                      type="button"
                      onClick={() => interaction.press()}
                      className="flex cursor-pointer items-center gap-2"
                      aria-label={`Interact: ${interaction.near.prompt}`}
                    >
                      <kbd className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-800 ring-1 ring-black/[0.09]">
                        E
                      </kbd>
                      <Icon className="size-3.5 shrink-0 text-neutral-700" />
                      <span className="text-[12px] font-semibold text-neutral-800">
                        {interaction.near.prompt}
                      </span>
                    </button>
                  </WToast>
                );
              })()}
            {/* Sit pill shows alongside (not instead of) the E pill — every
                chair sits inside a monitor spot's radius, so gating on
                !interaction.near hid it exactly when it was relevant. */}
            {nearChair && (
              <WToast key="sit" id="sit" tone="neutral">
                <button
                  type="button"
                  onClick={() => sitToggleRef.current?.()}
                  className="flex cursor-pointer items-center gap-2"
                  aria-label={sitting ? "Stand up" : "Sit down"}
                >
                  <kbd className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-800 ring-1 ring-black/[0.09]">
                    F
                  </kbd>
                  <span className="text-[12px] font-semibold text-neutral-800">
                    {sitting ? "Seated — stand up" : "Sit down"}
                  </span>
                </button>
              </WToast>
            )}
            {toasts.map((t) => (
              <WToast key={t.key} id={t.key} tone={t.tone}>
                <span role="status">{t.node}</span>
              </WToast>
            ))}
          </WToastStack>
        )}

      {/* Controls legend — contextual hint follows room + target */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div
          className={`${CHIP} rounded-full px-4 py-2.5 text-[11px] font-medium text-neutral-500`}
          aria-label="Controls and current hint"
        >
          {isCoarsePointer ? (
            <>
              <span>
                <span className="font-semibold text-neutral-900">
                  Best on desktop
                </span>{" "}
                · drag to look around
              </span>
              <span className="h-3.5 w-px bg-black/[0.09]" />
              <span className="max-w-[220px] truncate font-semibold text-neutral-700">
                {currentRoom === "Courtyard"
                  ? "Walk north → entrance"
                  : playerPos[1] > 3.1
                    ? "Upper floor — stairs go back down"
                    : "Stairs at lobby west end → L2"}
              </span>
            </>
          ) : (
            <>
              {["W", "A", "S", "D"].map((k) => (
                <kbd
                  key={k}
                  className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-800 ring-1 ring-black/[0.09]"
                >
                  {k}
                </kbd>
              ))}
              <span className="ml-0.5">
                Move · Shift run · Space jump · F sit
              </span>
              <span className="h-3.5 w-px bg-black/[0.09]" />
              {!interaction.near && (
                <>
                  <span className="max-w-[220px] truncate font-semibold text-neutral-700">
                    {currentRoom === "Courtyard"
                      ? "Walk north → entrance"
                      : playerPos[1] > 3.1
                        ? "Upper floor — stairs go back down"
                        : "Stairs at lobby west end → L2"}
                  </span>
                  <span className="h-3.5 w-px bg-black/[0.09]" />
                </>
              )}
              <span className="hidden sm:inline">
                <span className="font-semibold text-neutral-900">Drag</span>{" "}
                Look ·{" "}
                <span className="font-semibold text-neutral-900">Scroll</span>{" "}
                Zoom
              </span>
              <span className="hidden h-3.5 w-px bg-black/[0.09] sm:inline" />
              <span>
                <kbd className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-800 ring-1 ring-black/[0.09]">
                  V
                </kbd>{" "}
                <span className="font-semibold text-neutral-900">
                  {fpp ? "Exit first-person (Esc)" : "First-person"}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* First-person crosshair */}
      {fpp && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="h-1.5 w-1.5 rounded-full bg-white/90 ring-1 ring-black/40" />
        </div>
      )}

      {/* First-run tour */}
      <AnimatePresence>
        {tourOpen && (
          <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
            <WorldTour
              onClose={(seen) => {
                if (seen) markTourSeen();
                setTourOpen(false);
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Office ticker — latest pulse always visible (collapsed to one line
          during calls / on small screens); full stack when idle on desktop. */}
      {feed.length > 0 &&
        (() => {
          const fresh = feed.filter((f) => Date.now() - f.at < 60_000);
          if (fresh.length === 0) return null;
          const inCall = nearIds.size > 0;
          const items = inCall ? fresh.slice(0, 1) : fresh.slice(0, 3);
          return (
            <div
              role="status"
              aria-live="polite"
              className={`pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 ${
                inCall ? "bottom-24 left-1/2" : "bottom-4 left-1/2"
              }`}
            >
              {items.map((f, i) => (
                <div
                  key={f.key}
                  className={`${CHIP} max-w-[400px] px-3.5 py-1.5 text-[11px] font-medium text-neutral-700 ${
                    i > 0 ? "hidden md:inline-flex" : ""
                  } ${
                    i === 0
                      ? "opacity-100"
                      : i === 1
                        ? "opacity-70"
                        : "opacity-45"
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
                            ? "bg-emerald-500"
                            : f.tone === "pr"
                              ? "bg-sky-500"
                              : f.tone === "bump"
                                ? "bg-amber-500"
                                : f.tone === "focusing"
                                  ? "bg-violet-500"
                                  : f.tone === "review"
                                    ? "bg-teal-500"
                                    : f.tone === "alert"
                                      ? "bg-rose-500"
                                      : "bg-emerald-500"
                        }`}
                      />
                    )}
                  </span>
                  <span className="min-w-0 truncate">{f.text}</span>
                </div>
              ))}
            </div>
          );
        })()}

      {/* Match-end card — "You won" (+ confetti) or "You lose", both games */}
      {endCelebration && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-neutral-950 px-5 py-3.5 text-white shadow-2xl ring-1 ring-amber-300/50">
            <span
              className={
                endCelebration.won
                  ? "flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-neutral-950 shadow-lg"
                  : "flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60"
              }
            >
              {endCelebration.won ? (
                <FiAward className="size-5" />
              ) : (
                <FiFlag className="size-5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-bold tracking-tight">
                {endCelebration.won ? "You won!" : "You lose"}
              </span>
              <span className="block max-w-[260px] truncate text-[12px] font-medium text-white/60">
                {endCelebration.won
                  ? `${endCelebration.otherName} · ${endReason(endCelebration.kind, endCelebration.reason, true)}`
                  : `${endCelebration.otherName} won · ${endReason(endCelebration.kind, endCelebration.reason, false)}`}
              </span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  games.open(endCelebration.sessionId);
                  setGamesOpen(true);
                  setEndCelebration(null);
                }}
                className={
                  endCelebration.won
                    ? "rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11.5px] font-bold text-neutral-950 transition-colors hover:bg-emerald-400"
                    : "rounded-lg bg-white/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                }
              >
                View board
              </button>
              <button
                type="button"
                onClick={() => setEndCelebration(null)}
                aria-label="Dismiss"
                className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              >
                ✕
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Focus pod widget — presence, mute state and pairing (only inside a focus room) */}
      {focus.inFocus && (
        <div className="pointer-events-none absolute left-1/2 top-[4.5rem] z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {focus.partnerId ? (
            <div className={`${CHIP} pointer-events-auto px-3.5 py-2`}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
              <span className="max-w-[220px] truncate text-[12px] font-semibold text-neutral-800">
                Focusing with {nameOf(focus.partnerId)}
              </span>
              <button
                type="button"
                onClick={focus.endPartner}
                className="cursor-pointer rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-black/[0.09] transition-colors hover:bg-neutral-100"
              >
                End
              </button>
            </div>
          ) : focus.pendingInvite ? (
            <div
              className={`${CHIP} pointer-events-auto border-violet-500/30 bg-violet-50/95 px-3.5 py-2`}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
              <span className="max-w-[220px] truncate text-[12px] font-semibold text-neutral-800">
                {focus.pendingInvite.name} wants to focus together
              </span>
              <button
                type="button"
                onClick={() => focus.accept(focus.pendingInvite!.id)}
                className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => focus.decline(focus.pendingInvite!.id)}
                className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-black/[0.09] transition-colors hover:bg-neutral-100"
              >
                Decline
              </button>
            </div>
          ) : (
            <>
              {focus.invitedId && (
                <div className={`${CHIP} pointer-events-auto px-3.5 py-2`}>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                  <span className="text-[12px] font-semibold text-neutral-800">
                    Invite sent to {nameOf(focus.invitedId)}…
                  </span>
                  <button
                    type="button"
                    onClick={() => focus.decline(focus.invitedId!)}
                    title="Cancel invite"
                    className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 ring-1 ring-black/[0.09] transition-colors hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {focus.suggestPartnerId && !focus.invitedId && (
                <div className={`${CHIP} pointer-events-auto px-3.5 py-2`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <span className="text-[12px] font-semibold text-neutral-800">
                    {nameOf(focus.suggestPartnerId)} is focusing in here
                  </span>
                  <button
                    type="button"
                    onClick={() => focus.invite(focus.suggestPartnerId!)}
                    className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700"
                  >
                    Invite
                  </button>
                </div>
              )}
              {!focus.partnerId &&
                !focus.pendingInvite &&
                !focus.suggestPartnerId && (
                  <div className={`${CHIP} pointer-events-none px-3.5 py-2`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
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
      <AnimatePresence>
        {pair.open && pair.suggestedPartnerId && (
          <PairSessionModal
            workspaceId={workspaceId}
            partnerName={nameOf(pair.suggestedPartnerId)}
            onStart={(repositoryId) => void pair.start(repositoryId)}
            onClose={pair.close}
          />
        )}
      </AnimatePresence>

      {/* 3D world */}
      <Canvas
        shadows
        // A modest cap keeps edges and procedural materials crisp without
        // returning to the memory cost of full device-pixel rendering.
        dpr={[1, 1.15]}
        camera={{ position: [0, 3, 46], fov: 50, near: 0.1, far: 900 }}
        gl={{
          // At a capped DPR, MSAA duplicates the main framebuffer with little
          // visible benefit in this stylised world. Turning it off materially
          // reduces GPU memory at the viewport sizes used by the office.
          antialias: false,
          stencil: false,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        events={safePointerEvents}
        className="w-full h-full"
      >
        <color attach="background" args={["#cdd8e3"]} />
        <AssetGate onReady={handleWorldReady} />
        <ThumbnailCapture workspaceId={workspaceId} />

        <Suspense fallback={null}>
          <OfficeLighting level={playerPos[1] > 3.1 ? 2 : 1} />
          <OfficeBuilding />
        </Suspense>
        {/* The YouTube player is a DOM surface, so it cannot participate in
            WebGL wall occlusion. Keep it visible only while the local player
            is in the Chill Space; elsewhere the real TV wall stays untouched. */}
        <ChillScreenProjection
          active={!!chill.state.videoId && currentRoom === "Chill Space"}
          mounted={!!chill.state.videoId}
        />

        <PlayerController
          playerRef={playerGroupRef}
          yawRef={sharedYaw}
          obstacles={PLAYER_COLLIDERS}
          spawn={SPAWN}
          modelUrl={playerModel}
          name={meName}
          status={myStatusLabel}
          badgeColor={
            STATUS_DOT[myPresence?.status ?? "online"] ?? "bg-emerald-500"
          }
          disabled={anyOverlayOpen}
          onRoomChange={handleRoomChange}
          onPositionUpdate={(pos) => setPlayerPos(pos)}
          roomAt={roomAt}
          groundAt={supportAt}
          stepUp={STEP_UP}
          onRealtimeMove={handleRealtimeMove}
          coffee={coffeeActive}
          firstPerson={fpp}
          sitSpots={CHAIR_SIT_SPOTS}
          sitToggleRef={sitToggleRef}
          onSitChange={(seated) => {
            setSitting(seated);
          }}
        />

        <RemoteAvatars
          avatars={avatarsWithBot}
          myUserId={myUserId}
          pills={nearbyTokens}
          bubbles={bubblesWithBot}
          groundAt={supportAt}
          onAvatarClick={(id) => {
            if (id !== REVIEWER_BOT_ID) setOpenMemberId(id);
          }}
        />

        {/* Wayfinding markers over usable things + desk proximity dots */}
        <Markers playerPos={playerPos} nearId={interaction.near?.id ?? null} />

        {/* Transient water pour at the cooler */}
        {waterActive && <WaterPour />}

        <ThirdPersonCamera
          targetRef={playerGroupRef}
          colliders={CAMERA_COLLIDERS}
          sharedYaw={sharedYaw}
          mode={fpp ? "first" : "third"}
          onPointerLockExit={() => setFpp(false)}
        />

        <Preload all />
        <PerfProbe />
      </Canvas>

      {/* Member modal */}
      <AnimatePresence>
        {openMemberId && (
          <MemberDetailPopup
            workspaceId={workspaceId}
            myUserId={myUserId}
            client={client}
            developerId={openMemberId}
            onClose={() => setOpenMemberId(null)}
          />
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
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
      </AnimatePresence>

      {/* Desk monitor — "open workspace" */}
      <AnimatePresence>
        {workspaceOpen && (
          <WorkspaceModal
            workspaceId={workspaceId}
            myUserId={myUserId}
            client={client}
            onClose={() => setWorkspaceOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Engineering CI wall screen */}
      <AnimatePresence>
        {ciOpen && (
          <CiDashboardModal
            workspaceId={workspaceId}
            client={client}
            onClose={() => setCiOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Whiteboard — shared canvas for the board you pressed E on */}
      <AnimatePresence>
        {whiteboardId && (
          <WhiteboardModal
            boardId={whiteboardId}
            client={client}
            onClose={() => setWhiteboardId(null)}
          />
        )}
      </AnimatePresence>

      {/* Chill Space shared screen + arcade station */}
      <AnimatePresence>
        {chillScreenOpen && (
          <ChillScreenModal
            client={client}
            state={chill.state}
            queue={chill.queue}
            currentItemId={chill.currentItemId}
            onClose={() => setChillScreenOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gamesOpen && (
          <GamesModal
            myUserId={myUserId}
            members={chat.members}
            games={games}
            onClose={() => setGamesOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {vendingOpen && (
          <VendingModal vending={vending} onClose={closeVending} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reviewerOpen && (
          <ReviewerModal
            workspaceId={workspaceId}
            onClose={() => setReviewerOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {fleetOpen && (
          <FleetModal
            workspaceId={workspaceId}
            client={client}
            onClose={() => setFleetOpen(false)}
          />
        )}
      </AnimatePresence>

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
            <div
              role="alert"
              className="pointer-events-none rounded-full bg-rose-50/95 px-3 py-1.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-500/30 backdrop-blur-md"
            >
              Voice unavailable — check mic permissions
            </div>
          )}
          {call.mediaError && onlineCount >= 2 && (
            <div
              role="alert"
              className="pointer-events-none max-w-[420px] truncate rounded-full bg-rose-50/95 px-3 py-1.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-500/30 backdrop-blur-md"
            >
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

      {/* Chill Space shared-screen volume — only while inside the room.
          Sits above the legend so it never covers the top chips. */}
      {currentRoom === "Chill Space" && (
        <div className="absolute bottom-36 left-4 z-10">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-[#f4f2ed]/95 py-2 pl-3 pr-4 text-neutral-700 ring-1 ring-black/[0.09] backdrop-blur-md">
            <Volume2 className="h-4 w-4 text-neutral-500" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Screen
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(chill.volume * 100)}
              onChange={(e) => chill.setVolume(Number(e.target.value) / 100)}
              className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-neutral-900/15 accent-emerald-600"
              aria-label="Chill space volume"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default WorldCanvas;
