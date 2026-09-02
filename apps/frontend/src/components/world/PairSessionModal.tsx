import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiGithub, FiX } from "react-icons/fi";
import { http } from "@/lib/http";
import { cn } from "@/lib/utils";

interface PairSessionModalProps {
  workspaceId: string;
  partnerName: string;
  onStart: (repositoryId: string | null) => void;
  onClose: () => void;
}

/**
 * "Start a pair session" — begin from a repo in the workspace (or skip) once
 * exactly two members occupy a pair-programming room.
 */
export function PairSessionModal({
  workspaceId,
  partnerName,
  onStart,
  onClose,
}: PairSessionModalProps) {
  const [repo, setRepo] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const repos = useQuery({
    queryKey: ["repositories", workspaceId],
    queryFn: () => http.reads.repositories(workspaceId),
    staleTime: 60_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const begin = (repositoryId: string | null) => {
    setStarting(true);
    onStart(repositoryId);
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#f4f2ed]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_48px_-20px_rgba(28,25,18,0.5)] ring-1 ring-black/[0.09] backdrop-blur-md">
        <div className="flex items-start justify-between border-b border-black/[0.06] px-5 pb-3 pt-4">
          <div>
            <span className="text-[10.5px] font-semibold tracking-[0.14em] text-indigo-600 uppercase">
              Pair programming
            </span>
            <h2 className="mt-0.5 font-serif text-[17px] leading-tight text-neutral-900">
              Start a session with {partnerName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="grid size-7 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-800"
          >
            <FiX className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2 px-5 py-4">
          <label className="flex items-center justify-between text-[11.5px] font-semibold text-neutral-700">
            <span className="flex items-center gap-1.5">
              <FiGithub className="size-3.5" /> Workspace repository
            </span>
            {repos.isLoading && (
              <span className="font-normal text-neutral-400">loading…</span>
            )}
          </label>
          {repos.isError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] font-medium text-rose-700 ring-1 ring-rose-500/30">
              Couldn't load repositories.
            </p>
          )}
          {repos.data?.length === 0 && (
            <p className="rounded-lg bg-neutral-100 px-3 py-2 text-[11.5px] font-medium text-neutral-500 ring-1 ring-black/[0.06]">
              No repositories linked to this workspace yet.
            </p>
          )}
          <div className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
            {(repos.data ?? []).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRepo(repo === r.id ? null : r.id)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors",
                  repo === r.id
                    ? "bg-indigo-600 text-white"
                    : "bg-white/60 text-neutral-700 ring-1 ring-black/[0.07] hover:bg-white",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FiGithub className="size-3.5 shrink-0" />
                  <span className="truncate font-medium">{r.name}</span>
                </span>
                {r.prCount > 0 && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold",
                      repo === r.id
                        ? "bg-white/20 text-white"
                        : "bg-indigo-50 text-indigo-600",
                    )}
                  >
                    {r.prCount} pr{r.prCount === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] px-5 py-3.5">
          <button
            type="button"
            onClick={() => begin(null)}
            disabled={starting}
            className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-neutral-800 disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => begin(repo)}
            disabled={starting}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_1px_0_rgba(28,25,18,0.25)] transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {starting
              ? "Starting…"
              : repo
                ? "Start session"
                : "Start without repo"}
          </button>
        </div>
      </div>
    </div>
  );
}
