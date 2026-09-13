import { useMemo } from "react";
import { bsPublicFromString, type BsCell } from "@hive/games";
import { cn } from "@/lib/utils";
import { playBoardSound } from "./sound";
import { HitIcon, MissIcon, ShipIcon, WreckIcon } from "./GameIcons";

function cellChar(c: BsCell | undefined): string {
  if (c === "hit") return "H";
  if (c === "miss") return "M";
  if (c === "ship") return "S";
  return ".";
}

interface BattleshipBoardProps {
  board: string;
  /** My own fleet grid (100 chars, unicast) — null for spectators. */
  fleet: string | null;
  /** Seat names in turn order. */
  names: string[];
  /** My seat index, or null for spectators. */
  mySeat: number | null;
  canMove: boolean;
  onFire: (cell: number) => void;
}

/**
 * DOM battleship table: their waters to shoot at, my waters with my fleet
 * and incoming shots, sunk-fleet tracker. Hidden fleets never leave the
 * server — this view only sees public shots, revealed wrecks, and my ships.
 */
export function BattleshipBoard({
  board,
  fleet,
  names,
  mySeat,
  canMove,
  onFire,
}: BattleshipBoardProps) {
  const pub = useMemo(() => {
    try {
      return bsPublicFromString(board);
    } catch {
      return null;
    }
  }, [board]);

  const myFleet = useMemo((): BsCell[] | null => {
    if (!fleet || fleet.length !== 100 || /[^.SHM]/.test(fleet)) return null;
    return [...fleet] as BsCell[];
  }, [fleet]);

  if (!pub) {
    return (
      <div className="grid h-full w-full place-items-center text-[13px] font-medium text-white/60">
        Launching fleets…
      </div>
    );
  }

  const enemySeat = mySeat === null ? (pub.turn === 0 ? 1 : 0) : 1 - mySeat;
  const enemyShots = pub.shots[enemySeat]!;
  const enemySunk = new Set(pub.sunk[enemySeat]!);
  const myShots = mySeat === null ? [] : pub.shots[mySeat]!;
  const mySunk =
    mySeat === null ? new Set<number>() : new Set(pub.sunk[mySeat]!);

  const fire = (cell: number): void => {
    if (!canMove) return;
    if (cellChar(enemyShots[cell]) !== ".") return;
    playBoardSound("drop");
    onFire(cell);
  };

  return (
    <div className="flex h-full w-full items-center justify-center gap-4">
      {/* Their waters — tap to fire */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
          {names[enemySeat] ?? "Enemy"} waters
        </span>
        <div
          className="grid shrink-0 grid-cols-10 gap-[3px] rounded-xl bg-[#0b2038] p-2 ring-1 ring-white/15"
          role="grid"
          aria-label="Enemy waters"
        >
          {Array.from({ length: 100 }, (_, i) => {
            const v = cellChar(enemyShots[i]);
            const wreck = enemySunk.has(i);
            const open = v === "." && canMove;
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                aria-label={`Fire at ${i}`}
                disabled={!open}
                onClick={() => fire(i)}
                className={cn(
                  "flex size-5 items-center justify-center rounded-[4px] leading-none transition-all sm:size-6",
                  wreck
                    ? "bg-rose-600 text-white ring-1 ring-rose-300"
                    : v === "H"
                      ? "bg-orange-500 text-white"
                      : v === "M"
                        ? "bg-white/15 text-white/40"
                        : "bg-[#16406e] text-transparent hover:bg-[#1f5290]",
                  open && "cursor-crosshair hover:scale-110",
                )}
              >
                {wreck ? (
                  <WreckIcon className="size-3.5" />
                ) : v === "H" ? (
                  <HitIcon className="size-3" />
                ) : v === "M" ? (
                  <MissIcon className="size-3" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* My waters — fleet + incoming */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
          My waters
        </span>
        <div
          className="grid shrink-0 grid-cols-10 gap-[3px] rounded-xl bg-[#0b2038] p-2 ring-1 ring-white/15"
          aria-label="My waters"
        >
          {Array.from({ length: 100 }, (_, i) => {
            const incoming = cellChar(myShots[i]);
            const ship = myFleet ? cellChar(myFleet[i]) : ".";
            const wreck = mySunk.has(i);
            return (
              <span
                key={i}
                className={cn(
                  "flex size-5 items-center justify-center rounded-[4px] leading-none sm:size-6",
                  wreck
                    ? "bg-rose-600 text-white ring-1 ring-rose-300"
                    : incoming === "H"
                      ? "bg-orange-500 text-white"
                      : incoming === "M"
                        ? "bg-white/15 text-white/40"
                        : ship === "S"
                          ? "bg-slate-400 text-slate-700"
                          : "bg-[#16406e]",
                )}
              >
                {wreck ? (
                  <WreckIcon className="size-3.5" />
                ) : incoming === "H" ? (
                  <HitIcon className="size-3" />
                ) : incoming === "M" ? (
                  <MissIcon className="size-3" />
                ) : ship === "S" ? (
                  <ShipIcon className="size-3" />
                ) : null}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
