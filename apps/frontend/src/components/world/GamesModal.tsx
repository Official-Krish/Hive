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
import type { GameKind, GameSession } from "@hive/types";
import { cn } from "@/lib/utils";
import { ChessBoard } from "./games/ChessBoard";
import { Connect4Board } from "./games/Connect4Board";
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
};

function seatOf(
  session: GameSession,
  userId: string,
): "first" | "second" | null {
  return session.members.find((m) => m.userId === userId)?.seat ?? null;
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

/** Game glyph tile — serif knight for chess, four-dot rack for Connect 4. */
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
          : "bg-gradient-to-br from-rose-600 to-amber-500",
      )}
      aria-hidden
    >
      {kind === "chess" ? (
        <span className="font-serif leading-none">♞</span>
      ) : (
        <span className="flex gap-[3px] leading-none">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="size-[7px] rounded-full bg-white/95" />
          ))}
        </span>
      )}
    </div>
  );
}

function SeatDot({ seat, kind }: { seat: "first" | "second"; kind: GameKind }) {
  const color =
    kind === "chess"
      ? seat === "first"
        ? "bg-neutral-100 ring-black/20"
        : "bg-neutral-900 ring-black/40"
      : seat === "first"
        ? "bg-rose-600"
        : "bg-amber-500";
  return (
    <span
      className={cn(
        "size-2.5 rounded-full ring-2 ring-offset-1 ring-offset-[#f4f2ed]",
        color,
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
  const [opponentId, setOpponentId] = useState("");
  const [creating, setCreating] = useState(false);

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

  const opponents = useMemo(
    () => members.filter((m) => m.userId !== myUserId),
    [members, myUserId],
  );

  const start = async () => {
    if (!opponentId || creating) return;
    setCreating(true);
    try {
      await games.create(kind, opponentId);
      setOpponentId("");
    } finally {
      setCreating(false);
    }
  };

  const openTables = games.sessions.filter((s) => s.status !== "finished");
  // Invites addressed to me live in the inbox — not duplicated here.
  const listedTables = openTables.filter(
    (s) =>
      s.status !== "pending" ||
      !s.members.some((m) => m.userId === myUserId && m.seat === "second"),
  );

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(86vh,660px)] w-[min(640px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.09]">
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {openSession ? (
            <MatchView
              session={openSession}
              myUserId={myUserId}
              members={members}
              rejected={games.rejected}
              onMove={(move) => games.sendMove(openSession.id, move)}
              onResign={() => void games.resign(openSession.id)}
              onRematch={() => {
                const opp = openSession.members.find(
                  (m) => m.userId !== myUserId,
                )?.userId;
                if (opp) void games.create(openSession.kind, opp);
              }}
            />
          ) : (
            <div className="flex flex-col gap-4">
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
                              {s.members.map((m) => m.name).join("  vs  ")}
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
                  <Eyebrow>
                    <span className="text-white/50">Start a match</span>
                  </Eyebrow>
                  {games.actionError && (
                    <div
                      role="alert"
                      className="mb-2 rounded-xl bg-rose-500/15 px-3.5 py-2 text-[12px] font-medium text-rose-200 ring-1 ring-rose-400/40"
                    >
                      {games.actionError}
                    </div>
                  )}
                  {/* Game picker cards */}
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="radiogroup"
                    aria-label="Game"
                  >
                    {(["chess", "connect4"] as GameKind[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={kind === k}
                        onClick={() => setKind(k)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-all",
                          kind === k
                            ? "bg-white text-neutral-900 ring-white"
                            : "bg-white/[0.06] text-white ring-white/15 hover:bg-white/[0.1]",
                        )}
                      >
                        <GameGlyph kind={k} />
                        <span>
                          <span className="block text-[13px] font-semibold leading-tight">
                            {KIND_LABEL[k]}
                          </span>
                          <span
                            className={cn(
                              "block text-[10.5px] font-medium",
                              kind === k ? "text-neutral-500" : "text-white/50",
                            )}
                          >
                            {k === "chess" ? "Classic · 2P" : "Quick · 2P"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Opponent picker */}
                  <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/50">
                    Challenge
                  </div>
                  <div className="mt-2 flex max-h-36 flex-col gap-1 overflow-y-auto pr-0.5">
                    {opponents.length === 0 && (
                      <div className="rounded-xl bg-white/[0.06] px-3 py-2.5 text-[12px] text-white/50 ring-1 ring-white/10">
                        No one else is around yet — invite a teammate to the
                        workspace first.
                      </div>
                    )}
                    {opponents.map((m) => (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => setOpponentId(m.userId)}
                        aria-pressed={opponentId === m.userId}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ring-1 transition-all",
                          opponentId === m.userId
                            ? "bg-white text-neutral-900 ring-white"
                            : "bg-transparent text-white ring-white/10 hover:bg-white/[0.07]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            opponentId === m.userId
                              ? "bg-neutral-950 text-white"
                              : "bg-white/15 text-white",
                          )}
                        >
                          {initials(m.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {m.name}
                        </span>
                        {opponentId === m.userId && (
                          <span className="text-[12px] font-bold">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void start()}
                    disabled={!opponentId || creating}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-[13.5px] font-bold text-neutral-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <FiPlay className="size-3.5" />
                    {creating ? "Sending invite…" : "Challenge to play"}
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
}: {
  session: GameSession;
  myUserId: string;
  members: GamesModalProps["members"];
  rejected: string | null;
  onMove: (
    move:
      | {
          kind: "chess";
          from: number;
          to: number;
          promote?: "n" | "b" | "r" | "q";
        }
      | { kind: "connect4"; col: number },
  ) => void;
  onResign: () => void;
  onRematch: () => void;
}) {
  const mySeat = seatOf(session, myUserId);
  const finished = session.status === "finished";
  const pending = session.status === "pending";
  const [muted, setMutedState] = useState(() => isBoardMuted());
  const setMuted = (v: boolean | ((p: boolean) => boolean)) => {
    setMutedState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      setBoardMuted(next);
      return next;
    });
  };
  const iAmInvitee = pending && mySeat === "second";
  const first = session.members.find((m) => m.seat === "first");
  const second = session.members.find((m) => m.seat === "second");
  const opponentName = nameOf(
    session,
    members,
    mySeat === "second" ? (first?.userId ?? null) : (second?.userId ?? null),
  );

  if (pending) {
    const gameName = session.kind === "chess" ? "Chess" : "Connect Four";
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-neutral-950 px-4 py-10 text-center text-white shadow-md">
        <GameGlyph kind={session.kind} size="lg" />
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
          Invite sent · {gameName}
        </div>
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
      </div>
    );
  }

  const myTurn = !finished && session.turnUserId === myUserId;
  const turnName = nameOf(session, members, session.turnUserId);
  const winnerName = nameOf(session, members, session.winnerUserId);
  const iWon = finished && session.winnerUserId === myUserId;

  return (
    <div className="flex flex-col gap-3">
      {/* Scoreboard */}
      <div className="rounded-2xl bg-neutral-950 px-4 py-3 text-white shadow-md">
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

      {/* Board stage */}
      <div
        className={cn(
          "rounded-2xl p-2.5 shadow-inner ring-1 ring-black/10",
          session.kind === "chess" ? "bg-[#3f5a3a]" : "bg-[#16283f]",
        )}
      >
        {session.kind === "chess" ? (
          <ChessBoard
            fen={session.board}
            myColor={
              mySeat === "first" ? "w" : mySeat === "second" ? "b" : null
            }
            canMove={myTurn}
            muted={muted}
            onMove={(m) => onMove({ kind: "chess", ...m })}
          />
        ) : (
          <Connect4Board
            board={session.board}
            myDisc={mySeat === "first" ? "R" : mySeat === "second" ? "Y" : null}
            canMove={myTurn}
            onMove={(col) => onMove({ kind: "connect4", col })}
          />
        )}
      </div>
    </div>
  );
}

function PlayerChip({
  name,
  seat,
  kind,
  active,
  dim,
  align = "left",
}: {
  name: string;
  seat: "first" | "second";
  kind: GameKind;
  active: boolean;
  dim: boolean;
  align?: "left" | "right";
}) {
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
          kind === "chess"
            ? seat === "first"
              ? "bg-neutral-100 text-neutral-900"
              : "bg-neutral-700 text-white ring-1 ring-white/30"
            : seat === "first"
              ? "bg-rose-600 text-white"
              : "bg-amber-500 text-neutral-950",
        )}
      >
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold leading-tight text-white">
          {name}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-white/50">
          <SeatDot seat={seat} kind={kind} />
          {kind === "chess"
            ? seat === "first"
              ? "White"
              : "Black"
            : seat === "first"
              ? "Red"
              : "Yellow"}
          {active && <span className="text-amber-300">· to move</span>}
        </span>
      </span>
    </div>
  );
}
