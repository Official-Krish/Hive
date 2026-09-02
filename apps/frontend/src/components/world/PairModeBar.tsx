import { FiGithub, FiTerminal, FiX } from "react-icons/fi";

interface PairModeBarProps {
  repoName: string | null;
  memberNames: string[];
  onEnd: () => void;
  onOpenLink: () => void;
}

/**
 * Persistent pair-session chrome while pairing: the room, repo and members are
 * on screen so both developers know they're mid-session.
 */
export function PairModeBar({
  repoName,
  memberNames,
  onEnd,
  onOpenLink,
}: PairModeBarProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-indigo-600/95 px-3.5 py-2 text-white shadow-[0_12px_28px_-16px_rgba(67,56,202,0.8)] ring-1 ring-white/20 backdrop-blur-sm">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
      <span className="flex items-center gap-1.5 text-[12px] font-semibold">
        <FiTerminal className="size-3.5" />
        Pairing · {memberNames.join(" & ")}
      </span>
      {repoName && (
        <button
          type="button"
          onClick={onOpenLink}
          title={repoName}
          className="flex max-w-[180px] items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/25"
        >
          <FiGithub className="size-3 shrink-0" />
          <span className="truncate">{repoName}</span>
        </button>
      )}
      <button
        type="button"
        onClick={onEnd}
        title="End pair session"
        className="grid size-6 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white/30"
      >
        <FiX className="size-3.5" />
      </button>
    </div>
  );
}
