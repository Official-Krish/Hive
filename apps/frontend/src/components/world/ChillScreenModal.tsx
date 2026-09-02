import { useEffect, useState } from "react";
import { FiX, FiPlay, FiPause, FiLink, FiExternalLink } from "react-icons/fi";
import { parseYouTubeUrl } from "@hive/types";
import type { RealtimeClient } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const EYEBROW =
  "text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400";

interface ChillMediaState {
  videoUrl: string | null;
  videoId: string | null;
  title: string | null;
  isPlaying: boolean;
  setByName?: string | null;
}

interface ChillScreenModalProps {
  client: RealtimeClient | null;
  state: ChillMediaState;
  onClose: () => void;
}

export function ChillScreenModal({
  client,
  state,
  onClose,
}: ChillScreenModalProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inputChanged, setInputChanged] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Re-index the dirty flag whenever a server state arrives while the input is
  // still the focused source of a "just pasted" value.
  const submit = () => {
    const parsed = parseYouTubeUrl(url);
    if (!parsed) {
      setError(
        "That doesn't look like a YouTube link (watch, shorts, youtu.be).",
      );
      return;
    }
    setError(null);
    setInputChanged(false);
    client?.sendChillSetUrl(parsed.url);
  };

  const toggle = () => {
    if (!state.videoId) return;
    if (state.isPlaying) client?.sendChillPause();
    else client?.sendChillPlay();
  };

  const setter = state.setByName ?? null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(80vh,640px)] w-[min(560px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#0b0d12] ring-1 ring-black/[0.5] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div>
            <div className={cn(EYEBROW, "text-neutral-500")}>Chill Space</div>
            <div className="font-serif text-[15px] leading-tight text-white">
              Shared screen
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shared screen"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <FiX className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Now playing / idle */}
          <div className="rounded-xl bg-white/[0.04] p-3.5 ring-1 ring-white/[0.06]">
            <div className={cn(EYEBROW, "text-neutral-500")}>
              {state.videoId ? "Now playing" : "Screen is idle"}
            </div>
            {state.videoId ? (
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-white">
                    {state.title ?? "Untitled video"}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-400">
                    <span className="inline-flex items-center gap-1">
                      {state.isPlaying ? (
                        <FiPlay className="size-3 text-emerald-400" />
                      ) : (
                        <FiPause className="size-3 text-amber-400" />
                      )}
                      {state.isPlaying ? "Playing" : "Paused"}
                    </span>
                    {setter && <span>· put up by {setter}</span>}
                    <a
                      href={state.videoUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-neutral-400 hover:text-white"
                    >
                      open on YouTube <FiExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[12.5px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
                >
                  {state.isPlaying ? (
                    <>
                      <FiPause className="size-3.5" /> Pause
                    </>
                  ) : (
                    <>
                      <FiPlay className="size-3.5" /> Play
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="mt-1 text-[12.5px] text-neutral-400">
                Paste a YouTube link to start a shared watch.
              </div>
            )}
          </div>

          {/* Paste a link */}
          <div className="mt-4">
            <div className={cn(EYEBROW, "mb-2 text-neutral-500")}>
              Everyone sees it on the screen
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FiLink className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setInputChanged(e.target.value.length > 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="Paste a YouTube link…"
                  className="w-full rounded-xl bg-white/[0.06] py-2.5 pl-9 pr-3 text-[13px] text-white placeholder:text-neutral-500 ring-1 ring-white/[0.08] outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={!inputChanged}
                className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white"
              >
                Play on screen
              </button>
            </div>
            {error && (
              <div className="mt-2 text-[11.5px] text-rose-400">{error}</div>
            )}
          </div>

          {/* Hint */}
          <div className="mt-4 rounded-xl bg-white/[0.03] px-3.5 py-3 text-[11.5px] leading-relaxed text-neutral-400 ring-1 ring-white/[0.05]">
            Anyone in the Chill Space hears this video's audio. Your own volume
            is set with the slider shown when you're in the room. Step out of
            the room and it mutes; step back in and it's synced for you.
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ChillMediaState };
