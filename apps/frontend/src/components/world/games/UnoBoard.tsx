import { useMemo, useState } from "react";
import { unoPublicFromString, type UnoColor } from "@hive/games";
import { cn } from "@/lib/utils";
import { playBoardSound } from "./sound";

const FACE: Record<string, string> = {
  R: "bg-rose-600",
  Y: "bg-amber-400",
  G: "bg-emerald-600",
  B: "bg-sky-600",
};

const FACE_TEXT: Record<string, string> = {
  R: "text-rose-600",
  Y: "text-amber-500",
  G: "text-emerald-600",
  B: "text-sky-600",
};

const GLOW: Record<string, string> = {
  R: "shadow-[0_0_36px_6px_rgba(244,63,94,0.55)] ring-rose-300",
  Y: "shadow-[0_0_36px_6px_rgba(251,191,36,0.55)] ring-amber-200",
  G: "shadow-[0_0_36px_6px_rgba(16,185,129,0.55)] ring-emerald-300",
  B: "shadow-[0_0_36px_6px_rgba(56,189,248,0.55)] ring-sky-300",
};

function rankLabel(card: string): string {
  const rank = card === "W" || card === "F" ? card : card.slice(1);
  if (rank === "S") return "⊘";
  if (rank === "T") return "+2";
  if (rank === "F") return "+4";
  return rank === "W" ? "★" : rank;
}

function isWild(card: string): boolean {
  return card === "W" || card === "F";
}

function cardColor(card: string): string | null {
  return isWild(card) ? null : card[0]!;
}

/**
 * Official-style Uno face: colored card, tilted white ellipse, bold rank in
 * the middle, corner indices. Pure CSS/SVG — no emoji.
 */
function UnoCardFace({
  card,
  size = "md",
}: {
  card: string;
  size?: "lg" | "md" | "sm";
}) {
  const wild = isWild(card);
  const color = cardColor(card);
  const dims =
    size === "lg"
      ? "h-28 w-20 text-[40px]"
      : size === "md"
        ? "h-20 w-14 text-[28px]"
        : "h-16 w-11 text-[22px]";
  const corner = size === "lg" ? "text-[13px]" : "text-[10px]";
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-black shadow-[0_6px_16px_-4px_rgba(0,0,0,0.6)] ring-1 ring-black/40",
        dims,
        wild ? "bg-neutral-900" : color ? FACE[color] : "bg-neutral-700",
      )}
    >
      {wild ? (
        <svg viewBox="0 0 40 56" className="absolute inset-0 h-full w-full">
          <path d="M0 0h20v28H0z" fill="#e11d48" />
          <path d="M20 0h20v28H20z" fill="#f59e0b" />
          <path d="M0 28h20v28H0z" fill="#10b981" />
          <path d="M20 28h20v28H20z" fill="#0ea5e9" />
          <ellipse
            cx="20"
            cy="28"
            rx="11"
            ry="15"
            fill="#fff"
            transform="rotate(-18 20 28)"
          />
        </svg>
      ) : (
        <span
          aria-hidden
          className="absolute h-[135%] w-[78%] rotate-[-18deg] rounded-[50%] bg-white"
        />
      )}
      <span
        className={cn(
          "absolute left-1 top-0.5 font-bold italic",
          corner,
          wild ? "text-white" : "text-white/95",
        )}
      >
        {rankLabel(card)}
      </span>
      <span
        className={cn(
          "relative font-black italic leading-none",
          wild ? "text-white" : color ? FACE_TEXT[color] : "text-white",
        )}
      >
        {rankLabel(card)}
      </span>
    </span>
  );
}

/** Facedown card back for decks and opponent hands. */
function CardBack({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-neutral-900 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.6)] ring-1 ring-white/25",
        className,
      )}
    >
      <span className="flex h-[72%] w-[68%] rotate-[-18deg] items-center justify-center rounded-[50%] bg-rose-600 ring-2 ring-white/80">
        <span className="text-[9px] font-black italic tracking-tight text-white">
          UNO
        </span>
      </span>
    </span>
  );
}

interface UnoBoardProps {
  board: string;
  /** My hand (unicast), empty for spectators. */
  hand: string[];
  /** Seat names in turn order for the opponent pills. */
  names: string[];
  /** My seat index, or null for spectators. */
  mySeat: number | null;
  canMove: boolean;
  onPlay: (index: number, wildColor?: UnoColor) => void;
  onDraw: () => void;
  onCallUno: () => void;
  onCatch: (seat: number) => void;
  /** Pull fresh private state (retry when the board won't parse). */
  onSync: () => void;
}

/**
 * Casino-style Uno table: red felt oval, opponent arc up top with live
 * counts, stacked draw deck + glowing discard in the middle, overlapping
 * hand fan along the bottom, quadrant wild picker.
 */
export function UnoBoard({
  board,
  hand,
  names,
  mySeat,
  canMove,
  onPlay,
  onDraw,
  onCallUno,
  onCatch,
  onSync,
}: UnoBoardProps) {
  const [wildIdx, setWildIdx] = useState<number | null>(null);

  const pub = useMemo(() => {
    try {
      return unoPublicFromString(board);
    } catch {
      return null;
    }
  }, [board]);

  if (!pub) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/70">
        <span className="text-[13px] font-medium">Syncing table…</span>
        <button
          type="button"
          onClick={onSync}
          className="rounded-full bg-white/15 px-4 py-1.5 text-[12px] font-bold text-white ring-1 ring-white/25 transition-colors hover:bg-white/25"
        >
          Retry
        </button>
      </div>
    );
  }

  const top = pub.discard[pub.discard.length - 1] ?? null;
  const topStr = top
    ? top.rank === "W" || top.rank === "F"
      ? top.rank
      : `${top.color}${top.rank}`
    : "";

  const playable = (card: string): boolean => {
    if (!top) return false;
    if (isWild(card)) return true;
    if (card[0] === pub.activeColor) return true;
    if (top.rank === "W" || top.rank === "F") return false;
    return card.slice(1) === top.rank;
  };

  // Mirrors the server: wilds never force your hand, so the draw pile
  // lights up whenever no non-wild card can play.
  const hasForced = canMove && hand.some((c) => !isWild(c) && playable(c));

  const play = (idx: number): void => {
    const card = hand[idx];
    if (!card || !canMove || !playable(card)) return;
    if (isWild(card)) {
      playBoardSound("select");
      setWildIdx(idx);
      return;
    }
    playBoardSound("drop");
    onPlay(idx);
  };

  const others = names
    .map((name, seat) => ({ name, seat }))
    .filter(({ seat }) => seat !== mySeat);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_center,#a31621_0%,#6d0f16_55%,#42090e_100%)]">
      {/* felt sheen */}
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />

      {/* Opponent arc */}
      <div className="flex shrink-0 items-start justify-center gap-3 px-3 pt-2.5">
        {others.map(({ name, seat }) => {
          const active = pub.turn === seat;
          const count = pub.counts[seat] ?? 0;
          return (
            <div key={seat} className="flex w-16 flex-col items-center gap-1">
              <div
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full text-[13px] font-black text-white ring-2 transition-all",
                  active
                    ? "animate-pulse bg-amber-400 text-neutral-950 ring-amber-200"
                    : "bg-black/40 ring-white/25",
                )}
                title={name}
              >
                {name.trim()[0]?.toUpperCase() ?? "?"}
                <span
                  className={cn(
                    "absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-black ring-2 ring-[#6d0f16]",
                    count <= 1
                      ? "bg-rose-500 text-white"
                      : "bg-white text-neutral-900",
                  )}
                >
                  {count}
                </span>
              </div>
              <span className="max-w-full truncate text-[10px] font-semibold text-white/75">
                {name}
              </span>
              {/* mini hand backs */}
              <div className="flex -space-x-2.5">
                {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                  <span
                    key={i}
                    className="block h-6 w-4 rounded-[3px] bg-neutral-900 ring-1 ring-white/40"
                  />
                ))}
                {count > 4 && (
                  <span className="pl-2.5 font-mono text-[9px] font-bold text-white/60">
                    +{count - 4}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Turn banner + UNO table-talk */}
      <div className="flex h-7 shrink-0 items-center justify-center gap-2">
        {pub.caught === mySeat && mySeat !== null ? (
          <button
            type="button"
            onClick={() => {
              playBoardSound("notify");
              onCallUno();
            }}
            className="animate-pulse rounded-full bg-gradient-to-br from-amber-300 to-orange-500 px-5 py-1 text-[13px] font-black uppercase tracking-[0.14em] text-neutral-950 shadow-[0_0_20px_4px_rgba(251,191,36,0.6)] transition-transform hover:scale-105"
          >
            UNO!
          </button>
        ) : pub.caught !== null && mySeat !== null ? (
          <button
            type="button"
            onClick={() => {
              playBoardSound("capture");
              onCatch(pub.caught!);
            }}
            className="animate-pulse rounded-full bg-gradient-to-br from-rose-500 to-red-700 px-4 py-1 text-[12px] font-black uppercase tracking-[0.14em] text-white shadow-[0_0_20px_4px_rgba(244,63,94,0.6)] ring-1 ring-white/40 transition-transform hover:scale-105"
          >
            Catch {names[pub.caught] ?? "them"}! +4
          </button>
        ) : canMove ? (
          <span className="animate-pulse rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-950 shadow-lg">
            Your turn
          </span>
        ) : (
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
            {names[pub.turn] ?? ""} to play
          </span>
        )}
      </div>

      {/* Piles */}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-8">
        <button
          type="button"
          onClick={() => {
            if (!canMove) return;
            playBoardSound("select");
            onDraw();
          }}
          disabled={!canMove}
          title={canMove ? "Draw a card" : "Wait your turn"}
          className={cn(
            "relative transition-transform",
            canMove ? "cursor-pointer hover:scale-105" : "cursor-default",
            canMove && !hasForced && "animate-pulse",
          )}
        >
          {/* stacked deck */}
          <span className="absolute left-1.5 top-1.5 block h-20 w-14 rounded-xl bg-black/50 ring-1 ring-white/20" />
          <span className="absolute left-0.5 top-0.5 block h-20 w-14 rounded-xl bg-black/50 ring-1 ring-white/20" />
          <CardBack className="relative h-20 w-14" />
          <span
            className={cn(
              "absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-px font-mono text-[10px] font-black ring-1",
              canMove && !hasForced
                ? "bg-amber-400 text-neutral-950 ring-amber-200"
                : "bg-black/60 text-white/85 ring-white/25",
            )}
          >
            {pub.deckCount} · {canMove && !hasForced ? "DRAW" : "draw"}
          </span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <div
            className={cn(
              "rounded-2xl p-1.5 ring-2 transition-all",
              GLOW[pub.activeColor],
            )}
          >
            <div className="-rotate-6">
              {top ? <UnoCardFace card={topStr} size="lg" /> : null}
            </div>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">
            discard
          </span>
        </div>
      </div>

      {/* Wild picker — official quadrant style */}
      {wildIdx !== null && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 p-4 backdrop-blur-[1px]">
          <div className="w-44 overflow-hidden rounded-2xl bg-neutral-950 shadow-2xl ring-1 ring-white/20">
            <div className="px-3 pb-1 pt-2.5 text-center text-[11px] font-black uppercase tracking-[0.16em] text-white/70">
              Choose color
            </div>
            <div className="grid grid-cols-2">
              {(["R", "Y", "G", "B"] as UnoColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Wild as ${c}`}
                  onClick={() => {
                    playBoardSound("drop");
                    onPlay(wildIdx, c);
                    setWildIdx(null);
                  }}
                  className={cn(
                    "h-16 transition-all hover:brightness-125",
                    FACE[c],
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setWildIdx(null)}
              className="w-full py-1.5 text-[12px] font-semibold text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hand fan */}
      <div className="flex shrink-0 items-end justify-center px-3 pb-2.5 pt-3">
        {hand.length === 0 ? (
          <div className="py-3 text-[12px] font-medium text-white/50">
            {mySeat === null ? "Spectating" : "Waiting for cards…"}
          </div>
        ) : (
          <div className="flex max-w-full items-end justify-center overflow-x-auto px-2 pb-1">
            {hand.map((card, i) => {
              const ok = canMove && playable(card);
              return (
                <button
                  key={`${card}-${i}`}
                  type="button"
                  onClick={() => play(i)}
                  disabled={!ok}
                  title={ok ? `Play ${card}` : card}
                  className={cn(
                    "-ml-5 shrink-0 rounded-xl transition-all first:ml-0",
                    ok
                      ? "-translate-y-2 cursor-pointer hover:-translate-y-5 hover:brightness-110"
                      : "cursor-default brightness-[0.55] saturate-50",
                    ok && "ring-2 ring-amber-300",
                  )}
                >
                  <UnoCardFace card={card} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
