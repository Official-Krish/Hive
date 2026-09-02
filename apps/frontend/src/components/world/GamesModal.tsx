import { useEffect } from "react";
import { FiX, FiAward, FiCircle, FiGrid, FiTv } from "react-icons/fi";
import { cn } from "@/lib/utils";

const EYEBROW =
  "text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400";

interface GameCard {
  id: string;
  name: string;
  blurb: string;
  seats: string;
  icon: React.ReactNode;
}

const GAMES: GameCard[] = [
  {
    id: "chess",
    name: "Chess",
    blurb: "Head-to-head on the big board.",
    seats: "2 players",
    icon: <FiAward className="size-5" />,
  },
  {
    id: "connect4",
    name: "Connect Four",
    blurb: "Drop, stack, and win in four.",
    seats: "2 players",
    icon: <FiCircle className="size-5" />,
  },
  {
    id: "pictionary",
    name: "Pictionary",
    blurb: "Draw it before the timer runs out.",
    seats: "2–8 players",
    icon: <FiGrid className="size-5" />,
  },
  {
    id: "tabletennis",
    name: "Table Tennis",
    blurb: "Rally against your teammate.",
    seats: "2 or 4 players",
    icon: <FiTv className="size-5" />,
  },
];

interface GamesModalProps {
  onClose: () => void;
}

export function GamesModal({ onClose }: GamesModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(80vh,600px)] w-[min(620px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#0b0d12] ring-1 ring-black/[0.5] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div>
            <div className={cn(EYEBROW, "text-neutral-500")}>Play Area</div>
            <div className="font-serif text-[15px] leading-tight text-white">
              Multiplayer games
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close games"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <FiX className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl bg-white/[0.03] px-3.5 py-3 text-[12px] text-neutral-300 ring-1 ring-white/[0.05]">
            Grab a seat at any table — games are being built. Your avatars will
            play together live in the Chill Space.
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {GAMES.map((g) => (
              <div
                key={g.id}
                className="flex flex-col rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-white/[0.07] text-neutral-300">
                    {g.icon}
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-400">
                    Coming soon
                  </span>
                </div>
                <div className="mt-3 text-[14px] font-semibold text-white">
                  {g.name}
                </div>
                <div className="mt-0.5 text-[12px] text-neutral-400">
                  {g.blurb}
                </div>
                <div className="mt-3 text-[10.5px] uppercase tracking-wide text-neutral-500">
                  {g.seats}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
