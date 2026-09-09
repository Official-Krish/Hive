import { useEffect, useMemo, useState } from "react";
import {
  FiX,
  FiEdit3,
  FiActivity,
  FiArrowLeft,
  FiZap,
  FiClock,
  FiFlag,
  FiRotateCcw,
  FiPlay,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";
import { type UseGameSessionResult } from "@/hooks/useGameSession";
import type { GameKind, GameMove, GameSession } from "@hive/types";
import {
  LUDO_YARD_COLORS,
  ludoStateFromString,
  ludoYard,
  unoPublicFromString,
} from "@hive/games";
import { cn } from "@/lib/utils";
import { ChessBoard } from "./games/ChessBoard";
import { Connect4Board } from "./games/Connect4Board";
import { LudoBoard } from "./games/LudoBoard";
import { UnoBoard } from "./games/UnoBoard";
import { DieIcon } from "./games/GameIcons";
import { isBoardMuted, setBoardMuted } from "./games/sound";

interface GamesModalProps {
  myUserId: string;
  members: Array<{ userId: string; name: string }>;
  games: UseGameSessionResult;
  onClose: () => void;
}

const KIND_LABEL: Record<GameKind, string> = {
  chess: "Chess",
  connect4: "Connect Four",
  ludo: "Ludo",
  uno: "Uno",
};

const KIND_BLURB: Record<GameKind, string> = {
  chess: "Classic · 2P",
  connect4: "Quick · 2P",
  ludo: "Race · 2–4P",
  uno: "Cards · 2–4P",
};

/** Human end-reason for the game-over overlay. */
function endReasonLabel(reason: string | null): string {
  switch (reason) {
    case "checkmate":
      return "by checkmate";
    case "connect-four":
      return "with four in a row";
    case "home":
      return "brought it home";
    case "empty-hand":
      return "went out";
    case "last-standing":
      return "last player standing";
    case "resign":
      return "by resignation";
    case "cancelled":
    case "declined":
      return "before it started";
    default:
      return reason ? ` · ${reason}` : "";
  }
}

/** Party games seat 2–4 via multi-invite; duels are a single challenge. */
export function isPartyKind(kind: GameKind): boolean {
  return kind === "ludo" || kind === "uno";
}

/** Seat dot colors per kind (chess: white/black, c4: red/yellow, party: 4-way). */
const SEAT_DOT: Record<GameKind, string[]> = {
  chess: ["bg-neutral-100 ring-black/20", "bg-neutral-900 ring-black/40"],
  connect4: ["bg-rose-600", "bg-amber-500"],
  ludo: ["bg-rose-500", "bg-amber-400", "bg-sky-500", "bg-violet-500"],
  uno: ["bg-rose-500", "bg-amber-400", "bg-sky-500", "bg-violet-500"],
};

type SeatName = "first" | "second" | "third" | "fourth";

function seatOf(session: GameSession, userId: string): SeatName | null {
  return session.members.find((m) => m.userId === userId)?.seat ?? null;
}

function seatIndexOf(session: GameSession, userId: string): number {
  return session.members.findIndex((m) => m.userId === userId);
}

function nameOf(
  session: GameSession,
  members: GamesModalProps["members"],
  userId: string | null,
): string {
  if (!userId) return "—";
  return (
    session.members.find((m) => m.userId === userId)?.name ??
    members.find((m) => m.userId === userId)?.name ??
    "Someone"
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/* ── Small atoms ─────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
      {children}
    </div>
  );
}

/** Game glyph tile — knight, four-dot rack, die, card stack. */
function GameGlyph({
  kind,
  size = "md",
}: {
  kind: GameKind;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "size-12 text-[26px]" : "size-10 text-[22px]";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
        box,
        kind === "chess"
          ? "bg-gradient-to-br from-neutral-800 to-neutral-950"
          : kind === "connect4"
            ? "bg-gradient-to-br from-rose-600 to-amber-500"
            : kind === "ludo"
              ? "bg-gradient-to-br from-emerald-600 to-teal-800"
              : "bg-gradient-to-br from-violet-600 to-fuchsia-600",
      )}
      aria-hidden
    >
      {kind === "chess" ? (
        <span className="font-serif leading-none">♞</span>
      ) : kind === "connect4" ? (
        <span className="flex gap-[3px] leading-none">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="size-[7px] rounded-full bg-white/95" />
          ))}
        </span>
      ) : kind === "ludo" ? (
        <span className="leading-none">
          <DieIcon value={5} className="size-6" />
        </span>
      ) : (
        <span className="relative leading-none">
          <span className="absolute -left-1.5 top-0.5 block h-5 w-3.5 rotate-[-8deg] rounded-[3px] bg-white/40" />
          <span className="relative block h-5 w-3.5 rounded-[3px] bg-white/95" />
        </span>
      )}
    </div>
  );
}

function SeatDot({ seat, kind }: { seat: SeatName; kind: GameKind }) {
  const idx = ["first", "second", "third", "fourth"].indexOf(seat);
  return (
    <span
      className={cn(
        "size-2.5 rounded-full ring-2 ring-offset-1 ring-offset-[#f4f2ed]",
        SEAT_DOT[kind]?.[idx] ?? "bg-neutral-400",
      )}
    />
  );
}

/* ── Modal ───────────────────────────────────────────────────── */

export function GamesModal({
  myUserId,
  members,
  games,
  onClose,
}: GamesModalProps) {
  const [kind, setKind] = useState<GameKind>("chess");
  const [opponentIds, setOpponentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openSession = games.openId
    ? (games.sessions.find((s) => s.id === games.openId) ?? null)
    : null;

  // Uno hands travel unicast — pull the private state when opening a table
  // (move broadcasts refresh it automatically via the hook).
  const openSessionId = openSession?.id;
  const openSessionHand = openSession?.hand;
  const openSessionKind = openSession?.kind;
  const openSessionStatus = openSession?.status;
  const openSessionSeated = openSession?.members.some(
    (m) => m.userId === myUserId,
  );
  const requestState = games.requestState;
  useEffect(() => {
    if (
      openSessionKind === "uno" &&
      openSessionStatus === "active" &&
      openSessionSeated &&
      !openSessionHand &&
      openSessionId
    ) {
      requestState(openSessionId);
    }
  }, [
    openSessionId,
    openSessionHand,
    openSessionKind,
    openSessionStatus,
    openSessionSeated,
    requestState,
  ]);

  const opponents = useMemo(
    () => members.filter((m) => m.userId !== myUserId),
    [members, myUserId],
  );

  const party = isPartyKind(kind);
  const toggleOpponent = (id: string): void => {
    setOpponentIds((prev) => {
      if (prev.includes(id)) return prev.filter((o) => o !== id);
      // Duels take one opponent, party tables up to three.
      return party ? [...prev, id].slice(0, 3) : [id];
    });
  };

  const start = async () => {
    if (opponentIds.length === 0 || creating) return;
    setCreating(true);
    try {
      await games.create(kind, party ? opponentIds : opponentIds[0]!);
      setOpponentIds([]);
    } finally {
      setCreating(false);
    }
  };

  const openTables = games.sessions.filter((s) => s.status !== "finished");
  // Invites addressed to me live in the inbox — not duplicated here.
  const listedTables = openTables.filter(
    (s) =>
      s.status !== "pending" ||
      s.startedBy === myUserId ||
      !s.members.some((m) => m.userId === myUserId),
  );

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(92vh,700px)] w-[min(720px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.09]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3">
          <div className="flex items-center gap-2.5">
            {openSession && (
              <button
                type="button"
                onClick={() => games.open(null)}
                aria-label="Back to lobby"
                className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
              >
                <FiArrowLeft className="size-4" />
              </button>
            )}
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Play Area
              </div>
              <div className="text-[15px] font-semibold tracking-tight text-neutral-900">
                {openSession
                  ? KIND_LABEL[openSession.kind]
                  : "Multiplayer games"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close games"
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
          >
            <FiX className="size-4" />
          </button>
        </div>

        {/* Body — fixed height, never page-scrolls. Lobby scrolls
            internally; the match view always fits. */}
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {openSession ? (
            <MatchView
              session={openSession}
              myUserId={myUserId}
              members={members}
              rejected={games.rejected}
              onMove={(move) => games.sendMove(openSession.id, move)}
              onResign={() => void games.resign(openSession.id)}
              onDecline={() => void games.decline(openSession.id)}
              onStart={() => {
                setStartingId(openSession.id);
                void games
                  .start(openSession.id)
                  .finally(() => setStartingId(null));
              }}
              onExit={() => games.open(null)}
              onSync={() => games.requestState(openSession.id)}
              starting={startingId === openSession.id}
              onRematch={() => {
                const opps = openSession.members
                  .filter((m) => m.userId !== myUserId)
                  .map((m) => m.userId);
                if (opps.length > 0) {
                  void games.create(
                    openSession.kind,
                    isPartyKind(openSession.kind) ? opps : opps[0]!,
                  );
                }
              }}
            />
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-0.5">
              {/* Resume banner */}
              {games.active && (
                <button
                  type="button"
                  onClick={() => games.open(games.active!.id)}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-neutral-950 px-4 py-3 text-left text-white shadow-lg transition-transform hover:scale-[1.01]"
                >
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">
                      Your {KIND_LABEL[games.active.kind]} game is live
                    </span>
                    <span className="block text-[11.5px] font-medium text-white/60">
                      {games.active.turnUserId === myUserId
                        ? "Your move — they're waiting"
                        : `${nameOf(games.active, members, games.active.turnUserId)} to move`}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold transition-colors group-hover:bg-white/20">
                    Resume →
                  </span>
                </button>
              )}

              {/* Open tables */}
              {listedTables.length > 0 && (
                <section>
                  <Eyebrow>Open tables · {listedTables.length}</Eyebrow>
                  <div className="flex flex-col gap-2">
                    {listedTables.map((s) => {
                      const turnName = nameOf(s, members, s.turnUserId);
                      const mine = s.turnUserId === myUserId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => games.open(s.id)}
                          className="group flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left ring-1 ring-black/[0.07] transition-all hover:-translate-y-px hover:shadow-md"
                        >
                          <GameGlyph kind={s.kind} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-neutral-900">
                              {s.members.length > 2
                                ? `${s.members[0]?.name} +${s.members.length - 1} more`
                                : s.members.map((m) => m.name).join("  vs  ")}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-500">
                              {s.status === "pending" ? (
                                <>
                                  <FiClock className="size-3" />
                                  Waiting to start
                                </>
                              ) : mine ? (
                                <>
                                  <FiZap className="size-3 text-amber-500" />
                                  <span className="text-amber-600">
                                    Your move
                                  </span>
                                </>
                              ) : (
                                `${turnName} to move`
                              )}
                              <span className="text-neutral-300">·</span>
                              {KIND_LABEL[s.kind]}
                            </span>
                          </span>
                          <span className="shrink-0 text-[13px] font-semibold text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-neutral-600">
                            →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Challenge */}
              <section className="overflow-hidden rounded-2xl bg-neutral-950 text-white shadow-lg">
                <div className="px-4 pb-4 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
                      Start a match
                    </span>
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 font-mono text-[10px] font-bold text-white/60 ring-1 ring-white/10">
                      {party ? "2–4 PLAYERS" : "HEAD TO HEAD"}
                    </span>
                  </div>
                  {games.actionError && (
                    <div
                      role="alert"
                      className="mb-2 rounded-xl bg-rose-500/15 px-3.5 py-2 text-[12px] font-medium text-rose-200 ring-1 ring-rose-400/40"
                    >
                      {games.actionError}
                    </div>
                  )}
                  {/* Game picker — arcade art tiles */}
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="radiogroup"
                    aria-label="Game"
                  >
                    {(
                      [
                        {
                          k: "chess",
                          art: "from-neutral-700 via-neutral-900 to-black",
                          tag: "Outthink them",
                        },
                        {
                          k: "connect4",
                          art: "from-rose-500 via-rose-700 to-amber-600",
                          tag: "Four in a row",
                        },
                        {
                          k: "ludo",
                          art: "from-emerald-500 via-emerald-700 to-teal-900",
                          tag: "Race them home",
                        },
                        {
                          k: "uno",
                          art: "from-violet-500 via-purple-700 to-fuchsia-800",
                          tag: "Shed every card",
                        },
                      ] as Array<{
                        k: GameKind;
                        art: string;
                        tag: string;
                      }>
                    ).map(({ k, art, tag }) => {
                      const selected = kind === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setKind(k);
                            setOpponentIds([]);
                          }}
                          className={cn(
                            "group relative overflow-hidden rounded-2xl text-left ring-2 transition-all",
                            selected
                              ? "ring-amber-300"
                              : "ring-white/10 hover:ring-white/30",
                          )}
                        >
                          <span
                            className={cn(
                              "flex items-center gap-3 bg-gradient-to-br px-3 py-3",
                              art,
                            )}
                          >
                            <GameGlyph kind={k} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[14px] font-black leading-tight tracking-tight">
                                {KIND_LABEL[k]}
                              </span>
                              <span className="block text-[11px] font-medium text-white/70">
                                {tag}
                              </span>
                              <span className="mt-1 inline-block rounded-full bg-black/35 px-2 py-px font-mono text-[9.5px] font-bold tracking-wide text-white/90">
                                {KIND_BLURB[k].toUpperCase()}
                              </span>
                            </span>
                          </span>
                          {selected && (
                            <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-amber-300 text-[11px] font-black text-neutral-950">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* Opponent picker */}
                  <div className="mt-3 flex items-baseline justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
                    <span>{party ? "Invite up to 3" : "Challenge"}</span>
                    {party && opponentIds.length > 0 && (
                      <span className="text-emerald-300">
                        {opponentIds.length + 1} players
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
                    {opponents.length === 0 && (
                      <div className="col-span-2 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[12px] text-white/50 ring-1 ring-white/10">
                        No one else is around yet — invite a teammate to the
                        workspace first.
                      </div>
                    )}
                    {opponents.map((m) => {
                      const picked = opponentIds.includes(m.userId);
                      return (
                        <button
                          key={m.userId}
                          type="button"
                          onClick={() => toggleOpponent(m.userId)}
                          aria-pressed={picked}
                          className={cn(
                            "relative flex items-center gap-2 rounded-xl px-2 py-1.5 text-left ring-1 transition-all",
                            picked
                              ? "bg-emerald-400/15 ring-emerald-300/70"
                              : "bg-transparent ring-white/10 hover:bg-white/[0.07]",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-black ring-2",
                              picked
                                ? "bg-emerald-400 text-neutral-950 ring-emerald-200"
                                : "bg-white/15 text-white ring-transparent",
                            )}
                          >
                            {initials(m.name)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                            {m.name}
                          </span>
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ring-1",
                              picked
                                ? "bg-emerald-400 text-neutral-950 ring-emerald-200"
                                : "text-transparent ring-white/25",
                            )}
                          >
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => void start()}
                    disabled={opponentIds.length === 0 || creating}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-[13.5px] font-bold text-neutral-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <FiPlay className="size-3.5" />
                    {creating
                      ? "Sending invite…"
                      : party
                        ? `Invite ${opponentIds.length > 0 ? `(${opponentIds.length + 1}P) ` : ""}to play`
                        : "Challenge to play"}
                  </button>
                </div>
              </section>

              {/* On the bench */}
              <section>
                <Eyebrow>On the bench</Eyebrow>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      name: "Pictionary",
                      seats: "2–8P",
                      icon: <FiEdit3 className="size-4" />,
                    },
                    {
                      name: "Table Tennis",
                      seats: "2/4P",
                      icon: <FiActivity className="size-4" />,
                    },
                  ].map((g) => (
                    <div
                      key={g.name}
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 opacity-70 ring-1 ring-black/[0.07]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900/[0.05] text-neutral-400">
                        {g.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-neutral-800">
                          {g.name}
                        </span>
                        <span className="block font-mono text-[10px] uppercase tracking-wide text-neutral-400">
                          {g.seats} · soon
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Match view ──────────────────────────────────────────────── */

function MatchView({
  session,
  myUserId,
  members,
  rejected,
  onMove,
  onResign,
  onRematch,
  onDecline,
  onStart,
  onExit,
  onSync,
  starting,
}: {
  session: GameSession;
  myUserId: string;
  members: GamesModalProps["members"];
  rejected: string | null;
  onMove: (move: GameMove) => void;
  onResign: () => void;
  onRematch: () => void;
  onDecline: () => void;
  onStart: () => void;
  onExit: () => void;
  onSync: () => void;
  starting: boolean;
}) {
  const mySeat = seatOf(session, myUserId);
  const mySeatIdx = seatIndexOf(session, myUserId);
  const finished = session.status === "finished";
  const pending = session.status === "pending";
  const party = isPartyKind(session.kind);
  const iAmHost = session.startedBy === myUserId;
  const [muted, setMutedState] = useState(() => isBoardMuted());
  const setMuted = (v: boolean | ((p: boolean) => boolean)) => {
    setMutedState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      setBoardMuted(next);
      return next;
    });
  };
  const iAmInvitee = pending && !iAmHost && mySeat !== null;
  const first = session.members.find((m) => m.seat === "first");
  const second = session.members.find((m) => m.seat === "second");
  const opponentName = nameOf(
    session,
    members,
    mySeat === "second" ? (first?.userId ?? null) : (second?.userId ?? null),
  );
  const acceptedCount = session.members.filter((m) =>
    session.accepted.includes(m.userId),
  ).length;
  const canStart = iAmHost && acceptedCount >= 2;

  // Party sub-labels per chip (uno counts / ludo progress). Hoisted above
  // the pending early-return — hooks must run unconditionally.
  const chipSubs = useMemo(() => {
    if (session.kind === "uno") {
      try {
        const pub = unoPublicFromString(session.board);
        return session.members.map((_, i) => `${pub.counts[i] ?? 0} cards`);
      } catch {
        return [];
      }
    }
    if (session.kind === "ludo") {
      try {
        const st = ludoStateFromString(session.board);
        return session.members.map((_, i) => {
          const home = st.tokens[i]?.filter((t) => t >= 32).length ?? 0;
          const out = st.tokens[i]?.filter((t) => t >= 0 && t < 32).length ?? 0;
          if (home === 4) return "All home ★";
          if (out === 0) return "In base";
          return `${home}/4 home`;
        });
      } catch {
        return [];
      }
    }
    return [];
  }, [session.board, session.kind, session.members]);

  const chipAccent = (index: number): string | undefined =>
    session.kind === "ludo"
      ? LUDO_YARD_COLORS[ludoYard(session.members.length, index)]
      : undefined;

  if (pending) {
    return (
      <div className="m-auto flex w-full max-w-[420px] flex-col items-center gap-3 rounded-2xl bg-neutral-950 px-4 py-10 text-center text-white shadow-md">
        <GameGlyph kind={session.kind} size="lg" />
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
          {party ? "Table filling" : "Invite sent"} · {KIND_LABEL[session.kind]}
        </div>
        {party ? (
          <>
            <div className="flex w-full max-w-[300px] flex-col gap-1.5">
              {session.members.map((m) => {
                const ok = session.accepted.includes(m.userId);
                return (
                  <div
                    key={m.userId}
                    className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2 text-left ring-1 ring-white/10"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white">
                      {initials(m.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {m.name}
                      {m.userId === myUserId && (
                        <span className="text-white/45"> (you)</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        ok ? "text-emerald-300" : "text-amber-300/80",
                      )}
                    >
                      {ok ? "✓ in" : "… waiting"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="max-w-[320px] text-[12.5px] text-white/55">
              {iAmHost
                ? "Start with 2+ players, or wait for the rest to accept — the table fills automatically."
                : `${first?.name ?? "Someone"} invited you. Accept it from the game invites inbox in the top bar.`}
            </p>
            <div className="flex items-center gap-2">
              {iAmHost && (
                <button
                  type="button"
                  onClick={onStart}
                  disabled={!canStart || starting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-[13px] font-bold text-neutral-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <FiPlay className="size-3.5" />
                  {starting
                    ? "Starting…"
                    : `Start (${acceptedCount}/${session.members.length})`}
                </button>
              )}
              {(iAmHost || iAmInvitee) && (
                <button
                  type="button"
                  onClick={iAmHost ? onResign : onDecline}
                  className="rounded-xl bg-white/10 px-3.5 py-2 text-[12px] font-semibold text-white/70 ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
                >
                  {iAmHost ? "Cancel table" : "Decline"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-[16px] font-semibold">
              Waiting for {iAmInvitee ? "you" : opponentName}
            </div>
            {/* Invite → accept → play */}
            <ol className="flex items-center gap-1.5 text-[11px] font-medium">
              <li className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300 ring-1 ring-emerald-400/40">
                <span>✓ Invite sent</span>
              </li>
              <li aria-hidden className="text-white/25">
                →
              </li>
              <li className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-white/70 ring-1 ring-white/15">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-amber-300" />
                </span>
                <span>Opponent joins</span>
              </li>
              <li aria-hidden className="text-white/25">
                →
              </li>
              <li className="rounded-full bg-white/[0.07] px-2.5 py-1 text-white/40 ring-1 ring-white/10">
                Game starts
              </li>
            </ol>
            <p className="max-w-[320px] text-[12.5px] text-white/55">
              {iAmInvitee
                ? `${first?.name ?? "Someone"} challenged you. Accept it from the game invites inbox in the top bar — the board opens automatically.`
                : `${opponentName} has been notified in their top bar. Stay here and the board opens the moment they join.`}
            </p>
            {!iAmInvitee && mySeat && (
              <button
                type="button"
                onClick={onResign}
                className="rounded-xl bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold text-white/70 ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
              >
                Cancel invite
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const myTurn = !finished && session.turnUserId === myUserId;
  const turnName = nameOf(session, members, session.turnUserId);
  const winnerName = nameOf(session, members, session.winnerUserId);
  const iWon = finished && session.winnerUserId === myUserId;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Scoreboard */}
      <div className="shrink-0 rounded-2xl bg-neutral-950 px-4 py-3 text-white shadow-md">
        {session.members.length > 2 ? (
          <div className="grid grid-cols-2 gap-2">
            {session.members.map((m, i) => (
              <PlayerChip
                key={m.userId}
                name={m.name}
                seat={m.seat}
                kind={session.kind}
                sub={chipSubs[i]}
                accent={chipAccent(i)}
                active={!finished && session.turnUserId === m.userId}
                dim={finished && session.winnerUserId !== m.userId}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <PlayerChip
              name={first?.name ?? "—"}
              seat="first"
              kind={session.kind}
              active={!finished && session.turnUserId === first?.userId}
              dim={finished && session.winnerUserId !== first?.userId}
            />
            <span className="shrink-0 font-mono text-[11px] font-bold text-white/40">
              {session.moveCount}
            </span>
            <PlayerChip
              name={second?.name ?? "—"}
              seat="second"
              kind={session.kind}
              active={!finished && session.turnUserId === second?.userId}
              dim={finished && session.winnerUserId !== second?.userId}
              align="right"
            />
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 truncate text-[12px] font-semibold",
              finished
                ? iWon
                  ? "text-emerald-400"
                  : "text-white/80"
                : myTurn
                  ? "text-amber-300"
                  : "text-white/60",
            )}
          >
            {finished ? (
              <>
                <FiFlag className="size-3.5 shrink-0" />
                <span className="truncate">
                  {session.winnerUserId
                    ? `${winnerName} wins${session.resultReason ? ` · ${session.resultReason}` : ""}`
                    : `Draw${session.resultReason ? ` · ${session.resultReason}` : ""}`}
                </span>
              </>
            ) : mySeat ? (
              myTurn ? (
                <>
                  <FiZap className="size-3.5 shrink-0" />
                  Your move
                </>
              ) : (
                `${turnName} to move`
              )
            ) : (
              `${turnName} to move · spectating`
            )}
          </span>
          {!finished && mySeat ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                aria-label={muted ? "Unmute sounds" : "Mute sounds"}
                title={muted ? "Unmute sounds" : "Mute sounds"}
                className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              >
                {muted ? (
                  <FiVolumeX className="size-3.5" />
                ) : (
                  <FiVolume2 className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onResign}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              >
                Resign
              </button>
            </div>
          ) : (
            finished &&
            mySeat && (
              <button
                type="button"
                onClick={onRematch}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-neutral-950 transition-colors hover:bg-emerald-400"
              >
                <FiRotateCcw className="size-3" />
                Rematch
              </button>
            )
          )}
        </div>
      </div>

      {rejected && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 px-3.5 py-2 text-[12px] font-medium text-rose-700 ring-1 ring-rose-500/30"
        >
          {rejected}
        </div>
      )}

      {/* Board stage — fills leftover height, board letterboxes inside */}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl p-2.5 shadow-inner ring-1 ring-black/10",
          session.kind === "chess"
            ? "bg-[#3f5a3a]"
            : session.kind === "ludo"
              ? "bg-[#123524]"
              : session.kind === "uno"
                ? "bg-[#2a1650]"
                : "bg-[#16283f]",
        )}
      >
        {session.kind === "chess" ? (
          <div className="aspect-square h-full max-h-full w-auto max-w-full">
            <ChessBoard
              fen={session.board}
              myColor={
                mySeat === "first" ? "w" : mySeat === "second" ? "b" : null
              }
              canMove={myTurn}
              muted={muted}
              onMove={(m) => onMove({ kind: "chess", ...m })}
            />
          </div>
        ) : session.kind === "ludo" ? (
          <div className="flex h-full max-h-full w-auto max-w-full flex-col">
            <LudoBoard
              board={session.board}
              mySeat={mySeatIdx >= 0 ? mySeatIdx : null}
              canMove={myTurn}
              names={session.members.map((m) => m.name)}
              onRoll={() => onMove({ kind: "ludo", roll: true })}
              onToken={(token) => onMove({ kind: "ludo", token })}
            />
          </div>
        ) : session.kind === "uno" ? (
          <div className="aspect-[8/5] h-full max-h-full w-auto max-w-full">
            <UnoBoard
              board={session.board}
              hand={session.hand ?? []}
              names={session.members.map((m) => m.name)}
              mySeat={mySeatIdx >= 0 ? mySeatIdx : null}
              canMove={myTurn}
              onPlay={(index, wildColor) =>
                onMove(
                  wildColor
                    ? { kind: "uno", play: index, wildColor }
                    : { kind: "uno", play: index },
                )
              }
              onDraw={() => onMove({ kind: "uno", draw: true })}
              onCallUno={() => onMove({ kind: "uno", callUno: true })}
              onCatch={(seat) => onMove({ kind: "uno", catch: seat })}
              onSync={onSync}
            />
          </div>
        ) : (
          <div className="aspect-[49/42] h-full max-h-full w-auto max-w-full">
            <Connect4Board
              board={session.board}
              myDisc={
                mySeat === "first" ? "R" : mySeat === "second" ? "Y" : null
              }
              canMove={myTurn}
              onMove={(col) => onMove({ kind: "connect4", col })}
            />
          </div>
        )}
        {/* Game-over overlay — result + simple exit, every game */}
        {finished && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-[2px]">
            <div className="flex w-full max-w-[320px] flex-col items-center gap-2 rounded-2xl bg-neutral-950 px-6 py-7 text-center text-white shadow-2xl ring-1 ring-white/15">
              <span
                className={cn(
                  "flex size-14 items-center justify-center rounded-full shadow-lg",
                  !session.winnerUserId
                    ? "bg-white/10 text-white/70"
                    : iWon
                      ? "bg-gradient-to-br from-amber-300 to-amber-500 text-neutral-950"
                      : "bg-white/10 text-white/60",
                )}
              >
                {iWon ? (
                  <TrophyIcon className="size-7" />
                ) : (
                  <FiFlag className="size-6" />
                )}
              </span>
              <div className="text-[26px] font-black tracking-tight">
                {!session.winnerUserId ? (
                  <span className="text-white/85">Draw</span>
                ) : !mySeat ? (
                  <span className="text-white/85">{winnerName} wins</span>
                ) : iWon ? (
                  <span className="bg-gradient-to-br from-amber-200 to-amber-400 bg-clip-text text-transparent">
                    You Won!
                  </span>
                ) : (
                  <span className="text-white/75">You Lost</span>
                )}
              </div>
              <div className="text-[13px] font-medium text-white/55">
                {!session.winnerUserId
                  ? `Nobody takes this one${session.resultReason ? ` · ${session.resultReason}` : ""}`
                  : !mySeat
                    ? `${endReasonLabel(session.resultReason)}`.trim() ||
                      "Well played"
                    : iWon
                      ? `${endReasonLabel(session.resultReason)}`.trim() ||
                        "Well played"
                      : `${winnerName} wins ${endReasonLabel(session.resultReason)}`.trim()}
              </div>
              <div className="mt-2 flex w-full flex-col gap-2">
                {mySeat && (
                  <button
                    type="button"
                    onClick={onRematch}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-[13.5px] font-bold text-neutral-950 transition-colors hover:bg-emerald-400"
                  >
                    <FiRotateCcw className="size-3.5" />
                    Rematch
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExit}
                  className="w-full rounded-xl bg-white/10 py-2.5 text-[13.5px] font-semibold text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/20 hover:text-white"
                >
                  Exit to lobby
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M7 4h10v5a5 5 0 0 1-10 0V4Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M7 5H4.5a2.5 2.5 0 0 0 2.6 4.4M17 5h2.5a2.5 2.5 0 0 1-2.6 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 14v3m-4 4h8m-6-4h4l.7 4H9.3l.7-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayerChip({
  name,
  seat,
  kind,
  active,
  dim,
  sub,
  accent,
  align = "left",
}: {
  name: string;
  seat: SeatName;
  kind: GameKind;
  active: boolean;
  dim: boolean;
  sub?: string;
  /** Hex swatch override (ludo yards) for avatar + dot. */
  accent?: string;
  align?: "left" | "right";
}) {
  const idx = ["first", "second", "third", "fourth"].indexOf(seat);
  const avatar =
    kind === "chess"
      ? seat === "first"
        ? "bg-neutral-100 text-neutral-900"
        : "bg-neutral-700 text-white ring-1 ring-white/30"
      : kind === "connect4"
        ? seat === "first"
          ? "bg-rose-600 text-white"
          : "bg-amber-500 text-neutral-950"
        : ([
            "bg-rose-500 text-white",
            "bg-amber-400 text-neutral-950",
            "bg-sky-500 text-white",
            "bg-violet-500 text-white",
          ][idx] ?? "bg-neutral-500 text-white");
  const role =
    kind === "chess"
      ? seat === "first"
        ? "White"
        : "Black"
      : kind === "connect4"
        ? seat === "first"
          ? "Red"
          : "Yellow"
        : `Seat ${idx + 1}`;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 ring-1 transition-all",
        align === "right" && "flex-row-reverse text-right",
        active
          ? "bg-white/10 ring-amber-300/70"
          : "bg-transparent ring-transparent",
        dim && "opacity-45",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          !accent && avatar,
          accent ? "text-white" : "",
        )}
        style={accent ? { backgroundColor: accent } : undefined}
      >
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-white">
          {name}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-white/50">
          {accent ? (
            <span
              className="size-2.5 rounded-full ring-2 ring-offset-1 ring-offset-[#f4f2ed]"
              style={{ backgroundColor: accent }}
            />
          ) : (
            <SeatDot seat={seat} kind={kind} />
          )}
          {sub ?? role}
          {active && <span className="text-amber-300">· to move</span>}
        </span>
      </span>
    </div>
  );
}
