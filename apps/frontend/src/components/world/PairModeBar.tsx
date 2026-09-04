import { FiGithub, FiTerminal, FiX } from "react-icons/fi";

interface PairModeBarProps {
  memberNames: string[];
  repoName?: string | null;
  onEnd: () => void;
  onOpenLink?: () => void;
}

export function PairModeBar({
  memberNames,
  repoName,
  onEnd,
  onOpenLink,
}: PairModeBarProps) {
  const names =
    memberNames.length > 0 ? memberNames.join(" & ") : "Pair session";
  return (
    <div
      role="status"
      aria-label={`Pairing: ${names}`}
      className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-[#f4f2ed]/95 py-2 pl-3.5 pr-2 text-neutral-700 ring-1 ring-black/[0.08] backdrop-blur-md"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-600" />
      <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold">
        <FiTerminal className="size-3.5 shrink-0 text-neutral-500" />
        <span className="truncate">
          Pairing · <span className="text-neutral-600">{names}</span>
        </span>
      </span>
      {repoName &&
        (onOpenLink ? (
          <button
            type="button"
            onClick={onOpenLink}
            title={repoName}
            className="flex max-w-[180px] items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-medium text-neutral-800 transition-colors hover:bg-black/[0.08]"
          >
            <FiGithub className="size-3 shrink-0" />
            <span className="truncate">{repoName}</span>
          </button>
        ) : (
          <span
            title={repoName}
            className="flex max-w-[180px] items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-medium text-neutral-600"
          >
            <FiGithub className="size-3 shrink-0" />
            <span className="truncate">{repoName}</span>
          </span>
        ))}
      <button
        type="button"
        onClick={onEnd}
        aria-label="End pair session"
        title="End pair session"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-black/[0.05] text-neutral-700 transition-colors hover:bg-rose-500 hover:text-neutral-950"
      >
        <FiX className="size-3.5" />
      </button>
    </div>
  );
}
