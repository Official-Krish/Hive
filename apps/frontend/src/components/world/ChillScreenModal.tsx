import { useRef, useState } from "react";
import {
  FiPlay,
  FiPause,
  FiLink,
  FiExternalLink,
  FiSkipBack,
  FiSkipForward,
  FiTrash2,
  FiChevronUp,
  FiChevronDown,
  FiList,
  FiPlus,
  FiMove,
} from "react-icons/fi";
import { parseYouTubeUrl, type ChillQueueItem } from "@hive/types";
import type { RealtimeClient } from "@/lib/realtime";
import { WModal } from "./motion";
import { DCloseBtn, EYEBROW, useEscape } from "./chrome";
import { cn } from "@/lib/utils";

interface ChillMediaState {
  videoUrl: string | null;
  videoId: string | null;
  title: string | null;
  isPlaying: boolean;
  setByName?: string | null;
  queueItemId?: string | null;
}

interface ChillScreenModalProps {
  client: RealtimeClient | null;
  state: ChillMediaState;
  queue?: ChillQueueItem[];
  currentItemId?: string | null;
  onClose: () => void;
}

export function ChillScreenModal({
  client,
  state,
  queue = [],
  currentItemId = null,
  onClose,
}: ChillScreenModalProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inputChanged, setInputChanged] = useState(false);
  // Drag-and-drop reorder (desktop pointer). Touch users keep the ▲ ▼ buttons.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dropAfter, setDropAfter] = useState(false);
  const dragIdRef = useRef<string | null>(null);

  useEscape(onClose);

  const submit = () => {
    const parsed = parseYouTubeUrl(url.trim());
    if (!parsed) {
      setError(
        "That doesn't look like a YouTube link (watch, shorts, youtu.be).",
      );
      return;
    }
    setError(null);
    setInputChanged(false);
    setUrl("");
    // Queue it — first item auto-plays, the rest line up in Up next.
    if (!client?.sendChillQueueAdd(parsed.url)) {
      client?.sendChillSetUrl(parsed.url);
    }
  };

  const toggle = () => {
    if (!state.videoId) return;
    if (state.isPlaying) client?.sendChillPause();
    else client?.sendChillPlay();
  };

  const setter = state.setByName ?? null;
  const activeId = currentItemId ?? state.queueItemId ?? null;
  const activeIndex = queue.findIndex((q) => q.id === activeId);

  const move = (itemId: string, toIndex: number) => {
    client?.sendChillQueueReorder(itemId, toIndex);
  };

  const clearDrag = () => {
    dragIdRef.current = null;
    setDragId(null);
    setDropIndex(null);
    setDropAfter(false);
  };

  /** Convert a hover position into the final index the backend expects. */
  const commitDrop = (targetIndex: number, after: boolean) => {
    const id = dragIdRef.current;
    if (!id) return;
    const from = queue.findIndex((q) => q.id === id);
    if (from < 0) {
      clearDrag();
      return;
    }
    let insertion = targetIndex + (after ? 1 : 0);
    insertion = Math.max(0, Math.min(insertion, queue.length));
    const final = from < insertion ? insertion - 1 : insertion;
    clearDrag();
    if (final !== from) move(id, final);
  };

  const playNext = (itemId: string) => {
    const from = queue.findIndex((q) => q.id === itemId);
    if (from < 0) return;
    const target = activeIndex >= 0 ? activeIndex + 1 : 0;
    if (from === target) {
      client?.sendChillQueuePlay(itemId);
      return;
    }
    client?.sendChillQueueReorder(itemId, target);
  };

  return (
    <WModal
      label="Shared screen"
      onClose={onClose}
      className="h-[min(84vh,680px)] w-[min(560px,96vw)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3">
        <div>
          <div className={EYEBROW}>Chill Space</div>
          <div className="text-[15px] font-semibold leading-tight tracking-tight text-neutral-900">
            Shared screen
          </div>
        </div>
        <DCloseBtn onClose={onClose} label="Close shared screen" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Now playing / idle */}
        <div className="rounded-xl bg-white p-3.5 ring-1 ring-black/[0.07]">
          <div className={EYEBROW}>
            {state.videoId ? "Now playing" : "Screen is idle"}
          </div>
          {state.videoId ? (
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-neutral-900">
                  {state.title ?? "Untitled video"}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    {state.isPlaying ? (
                      <FiPlay className="size-3 text-emerald-600" />
                    ) : (
                      <FiPause className="size-3 text-amber-600" />
                    )}
                    {state.isPlaying ? "Playing" : "Paused"}
                  </span>
                  {setter && <span>· put up by {setter}</span>}
                  {activeIndex >= 0 && queue.length > 0 && (
                    <span>
                      · {activeIndex + 1} of {queue.length}
                    </span>
                  )}
                  {state.videoUrl && (
                    <a
                      href={state.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900"
                    >
                      open on YouTube <FiExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => client?.sendChillQueuePrev()}
                  disabled={queue.length === 0}
                  title="Previous in queue"
                  aria-label="Previous in queue"
                  className="rounded-xl bg-white p-2.5 text-neutral-700 ring-1 ring-black/[0.09] transition-colors hover:bg-neutral-100 disabled:opacity-40"
                >
                  <FiSkipBack className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  disabled={!state.videoId}
                  className="flex items-center gap-1.5 rounded-xl bg-neutral-950 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
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
                <button
                  type="button"
                  onClick={() => client?.sendChillQueueNext()}
                  disabled={queue.length === 0}
                  title="Next in queue"
                  aria-label="Next in queue"
                  className="rounded-xl bg-white p-2.5 text-neutral-700 ring-1 ring-black/[0.09] transition-colors hover:bg-neutral-100 disabled:opacity-40"
                >
                  <FiSkipForward className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1 text-[12.5px] text-neutral-500">
              Paste a YouTube link to start a shared watch.
            </div>
          )}
        </div>

        {/* Add to queue */}
        <div className="mt-4">
          <div className={cn(EYEBROW, "mb-2")}>
            Add to queue — everyone sees it on the screen
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <FiLink className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
              <input
                autoFocus
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setInputChanged(e.target.value.trim().length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Paste a YouTube link…"
                className="w-full rounded-xl bg-white py-2.5 pl-9 pr-3 text-[13px] text-neutral-700 placeholder:text-neutral-400 ring-1 ring-black/[0.09] outline-none focus:ring-2 focus:ring-neutral-900/30"
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!inputChanged}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-950 px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-neutral-950"
            >
              <FiPlus className="size-3.5" /> Queue
            </button>
          </div>
          {error && (
            <div role="alert" className="mt-2 text-[11.5px] text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Queue */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className={EYEBROW}>
              <span className="inline-flex items-center gap-1.5">
                <FiList className="size-3" />
                Up next{queue.length > 0 ? ` · ${queue.length}` : ""}
              </span>
            </div>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  // Two-step confirm — this nukes the shared queue for all.
                  const btn = e.currentTarget;
                  if (btn.dataset.armed === "1") {
                    client?.sendChillQueueClear();
                    return;
                  }
                  btn.dataset.armed = "1";
                  btn.textContent = "Sure?";
                  window.setTimeout(() => {
                    btn.dataset.armed = "";
                    btn.textContent = "Clear all";
                  }, 2500);
                }}
                aria-live="polite"
                className="text-[11px] font-semibold text-neutral-500 transition-colors hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700/40 rounded"
              >
                Clear all
              </button>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="rounded-xl bg-white px-3.5 py-3 text-[11.5px] leading-relaxed text-neutral-500 ring-1 ring-black/[0.06]">
              Queue is empty. Add songs and they will auto-play one after
              another — when a song ends, the next one starts.
            </div>
          ) : (
            <ol
              className="flex flex-col gap-1.5"
              onDragOver={(e) => {
                // Allow dropping past the last row (append to end).
                if (!dragIdRef.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                if (!dragIdRef.current) return;
                e.preventDefault();
                commitDrop(queue.length - 1, true);
              }}
            >
              {queue.map((item, idx) => {
                const isActive = item.id === activeId;
                const isDragging = item.id === dragId;
                const showIndicator =
                  dragId && dropIndex === idx && dragId !== item.id;
                return (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      dragIdRef.current = item.id;
                      setDragId(item.id);
                      e.dataTransfer.effectAllowed = "move";
                      try {
                        e.dataTransfer.setData("text/plain", item.id);
                      } catch {
                        /* some browsers restrict setData */
                      }
                    }}
                    onDragOver={(e) => {
                      if (!dragIdRef.current || dragIdRef.current === item.id)
                        return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const rect = (
                        e.currentTarget as HTMLLIElement
                      ).getBoundingClientRect();
                      const after = e.clientY > rect.top + rect.height / 2;
                      setDropIndex(idx);
                      setDropAfter(after);
                    }}
                    onDrop={(e) => {
                      if (!dragIdRef.current) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLLIElement
                      ).getBoundingClientRect();
                      const after = e.clientY > rect.top + rect.height / 2;
                      commitDrop(idx, after);
                    }}
                    onDragEnd={clearDrag}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 ring-1 transition-colors",
                      isActive
                        ? "bg-neutral-950 text-white ring-neutral-950"
                        : "bg-white text-neutral-800 ring-black/[0.07] hover:ring-black/[0.14]",
                      isDragging && "opacity-40",
                    )}
                  >
                    {/* Drop-position indicator */}
                    {showIndicator && (
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute inset-x-3 h-0.5 rounded-full bg-emerald-500",
                          dropAfter ? "-bottom-[5px]" : "-top-[5px]",
                        )}
                      />
                    )}
                    <span
                      title="Drag to reorder"
                      aria-label={`Drag ${item.title ?? item.videoId} to reorder`}
                      className={cn(
                        "shrink-0 cursor-grab touch-none rounded p-1 transition-colors active:cursor-grabbing",
                        isActive
                          ? "text-white/40 hover:text-white"
                          : "text-neutral-300 hover:bg-black/[0.06] hover:text-neutral-600",
                      )}
                    >
                      <FiMove className="size-3.5" />
                    </span>
                    <span
                      className={cn(
                        "w-5 shrink-0 text-center font-mono text-[11px] font-bold tabular-nums",
                        isActive ? "text-emerald-400" : "text-neutral-400",
                      )}
                    >
                      {isActive ? "▶" : idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">
                        {item.title ?? item.videoId}
                      </span>
                      <span
                        className={cn(
                          "block truncate text-[10.5px]",
                          isActive ? "text-white/60" : "text-neutral-500",
                        )}
                      >
                        {item.addedByName
                          ? `queued by ${item.addedByName}`
                          : "queued"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => client?.sendChillQueuePlay(item.id)}
                          title="Play now"
                          aria-label={`Play ${item.title ?? item.videoId} now`}
                          className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-black/[0.06] hover:text-neutral-950"
                        >
                          <FiPlay className="size-3.5" />
                        </button>
                      )}
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => playNext(item.id)}
                          title="Play next"
                          aria-label="Play next"
                          className="hidden rounded-lg px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 transition-colors hover:bg-black/[0.06] hover:text-neutral-950 sm:block"
                        >
                          Next
                        </button>
                      )}
                      <span className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => move(item.id, idx - 1)}
                          disabled={idx === 0}
                          title="Move up (higher priority)"
                          aria-label="Move up"
                          className="rounded p-0.5 text-neutral-500 transition-colors hover:bg-black/[0.06] hover:text-neutral-950 disabled:opacity-30"
                        >
                          <FiChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(item.id, idx + 1)}
                          disabled={idx === queue.length - 1}
                          title="Move down (lower priority)"
                          aria-label="Move down"
                          className="rounded p-0.5 text-neutral-500 transition-colors hover:bg-black/[0.06] hover:text-neutral-950 disabled:opacity-30"
                        >
                          <FiChevronDown className="size-3.5" />
                        </button>
                      </span>
                      <button
                        type="button"
                        onClick={() => client?.sendChillQueueRemove(item.id)}
                        title="Remove from queue"
                        aria-label="Remove from queue"
                        className={cn(
                          "rounded-lg p-1.5 transition-colors",
                          isActive
                            ? "text-white/60 hover:bg-white/10 hover:text-white"
                            : "text-neutral-500 hover:bg-rose-50 hover:text-rose-700",
                        )}
                      >
                        <FiTrash2 className="size-3.5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Hint */}
        <div className="mt-4 rounded-xl bg-white px-3.5 py-3 text-[11.5px] leading-relaxed text-neutral-500 ring-1 ring-black/[0.06]">
          Anyone in the Chill Space hears this video's audio. Your own volume is
          set with the slider shown when you're in the room. Step out of the
          room and it mutes; step back in and it's synced for you. Drag the
          handle to reorder, or use ▲ ▼ on touch — Next lines a song up right
          after the current one.
        </div>
      </div>
    </WModal>
  );
}

export type { ChillMediaState };
