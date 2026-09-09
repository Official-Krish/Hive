import { useState } from "react";
import { Gamepad2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { DIconBtn, EYEBROW, useDismiss } from "./chrome";
import type { UseGameSessionResult } from "@/hooks/useGameSession";

function timeLabel(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true });
  } catch {
    return "";
  }
}

interface GameInviteInboxProps {
  games: UseGameSessionResult;
  /** Accept the invite, then open the match (caller shows the board). */
  onJoin: (id: string) => void;
}

/**
 * Game invites inbox — the only place to accept a challenge. Bell with a
 * count badge in the top bar; Join accepts and jumps straight to the board.
 */
export function GameInviteInbox({ games, onJoin }: GameInviteInboxProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useDismiss<HTMLDivElement>(() => setOpen(false));
  const invites = games.pendingInvites;

  return (
    <div className="relative">
      <DIconBtn
        label="Game invites"
        onClick={() => setOpen((v) => !v)}
        active={open}
      >
        <Gamepad2 className="size-5" />
        {invites.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9.5px] font-bold text-white ring-2 ring-[#faf9f6]">
            {invites.length > 9 ? "9+" : invites.length}
          </span>
        )}
      </DIconBtn>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Game invites"
            className="fixed top-16 right-4 z-30 flex max-h-[500px] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed]/98 ring-1 ring-black/[0.09] backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-2.5">
              <span className={EYEBROW}>Game invites</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close game invites"
                className="flex size-7 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {invites.length === 0 ? (
                <div className="p-6 text-center text-sm text-neutral-500">
                  No invites — challenge someone from the Play Area.
                </div>
              ) : (
                <ul className="divide-y divide-black/[0.05]">
                  {invites.map((s) => {
                    const challenger =
                      s.members.find((m) => m.seat === "first")?.name ??
                      "Someone";
                    const party = s.kind === "ludo" || s.kind === "uno";
                    return (
                      <li key={s.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                              s.kind === "chess"
                                ? "bg-gradient-to-br from-neutral-800 to-neutral-950"
                                : s.kind === "connect4"
                                  ? "bg-gradient-to-br from-rose-600 to-amber-500"
                                  : s.kind === "ludo"
                                    ? "bg-gradient-to-br from-emerald-600 to-teal-800"
                                    : "bg-gradient-to-br from-violet-600 to-fuchsia-600",
                            )}
                            aria-hidden
                          >
                            {s.kind === "chess" ? (
                              <span className="font-serif text-[20px] leading-none">
                                ♞
                              </span>
                            ) : s.kind === "connect4" ? (
                              <span className="flex gap-[3px]">
                                {[0, 1, 2, 3].map((i) => (
                                  <span
                                    key={i}
                                    className="size-[6px] rounded-full bg-white/95"
                                  />
                                ))}
                              </span>
                            ) : s.kind === "ludo" ? (
                              <span className="text-[18px] font-black leading-none">
                                L
                              </span>
                            ) : (
                              <span className="text-[18px] font-black italic leading-none">
                                U
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-neutral-900">
                              {challenger}{" "}
                              {party ? "invited you" : "challenged you"}
                            </span>
                            <span className="block text-[12px] text-neutral-500">
                              {s.kind === "chess"
                                ? "Chess"
                                : s.kind === "connect4"
                                  ? "Connect Four"
                                  : s.kind === "ludo"
                                    ? `Ludo · ${s.members.length} players`
                                    : `Uno · ${s.members.length} players`}{" "}
                              · {timeLabel(s.startedAt)}
                            </span>
                          </span>
                        </div>
                        <div className="mt-2.5 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onJoin(s.id);
                            }}
                            className="flex-1 rounded-xl bg-violet-600 py-2 text-[13px] font-bold text-white transition-transform hover:scale-[1.01]"
                          >
                            Join game
                          </button>
                          <button
                            type="button"
                            onClick={() => void games.decline(s.id)}
                            className="flex-1 rounded-xl bg-black/[0.05] py-2 text-[13px] font-semibold text-neutral-600 ring-1 ring-black/[0.07] hover:bg-black/[0.08]"
                          >
                            Decline
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-end border-t border-black/[0.07] px-4 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {invites.length} pending
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
