import { useState } from "react";
import {
  FiLink,
  FiExternalLink,
  FiPlus,
  FiTrash2,
  FiMonitor,
} from "react-icons/fi";
import { WModal } from "./motion";
import { DCloseBtn, EYEBROW, useEscape } from "./chrome";
import { cn } from "@/lib/utils";
import { toScreenEmbedUrl } from "./PodiumScreenProjection";

interface PodiumScreenModalProps {
  url: string | null;
  setByName: string | null;
  onSet: (url: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function PodiumScreenModal({
  url,
  setByName,
  onSet,
  onClear,
  onClose,
}: PodiumScreenModalProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  useEscape(onClose);

  const submit = () => {
    const embed = toScreenEmbedUrl(draft);
    if (!embed) {
      setError("Paste a full https:// link — photo, video, or any page.");
      return;
    }
    setError(null);
    setDraft("");
    setTouched(false);
    onSet(draft.trim());
  };

  const preview = url ? toScreenEmbedUrl(url) : null;

  return (
    <WModal
      label="Podium wall screen"
      onClose={onClose}
      className="h-[min(84vh,640px)] w-[min(560px,96vw)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3">
        <div>
          <div className={EYEBROW}>Podium Room</div>
          <div className="text-[15px] font-semibold leading-tight tracking-tight text-neutral-900">
            Wall screen
          </div>
        </div>
        <DCloseBtn onClose={onClose} label="Close wall screen" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Now showing / idle */}
        <div className="rounded-xl bg-white p-3.5 ring-1 ring-black/[0.07]">
          <div className={EYEBROW}>
            {url ? "Now showing" : "Screen is idle"}
          </div>
          {url ? (
            <div className="mt-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-neutral-900">
                    {url}
                  </div>
                  {setByName && (
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      put up by {setByName}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in a new tab"
                    aria-label="Open in a new tab"
                    className="rounded-xl bg-white p-2.5 text-neutral-700 ring-1 ring-black/[0.09] transition-colors hover:bg-neutral-100"
                  >
                    <FiExternalLink className="size-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={onClear}
                    title="Clear the screen"
                    aria-label="Clear the screen"
                    className="rounded-xl bg-white p-2.5 text-neutral-500 ring-1 ring-black/[0.09] transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    <FiTrash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              {preview && (
                <div className="mt-2.5 overflow-hidden rounded-lg ring-1 ring-black/[0.09]">
                  <iframe
                    title="Wall screen preview"
                    src={preview}
                    className="h-44 w-full border-0"
                    allow="fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2 text-[12.5px] text-neutral-500">
              <FiMonitor className="size-3.5 shrink-0" />
              Paste a link to light up the full wall behind the mic.
            </div>
          )}
        </div>

        {/* Put something up */}
        <div className="mt-4">
          <div className={cn(EYEBROW, "mb-2")}>
            Present — everyone in the room sees it
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <FiLink className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
              <input
                autoFocus
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setTouched(e.target.value.trim().length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Paste a photo, video, or page link…"
                className="w-full rounded-xl bg-white py-2.5 pl-9 pr-3 text-[13px] text-neutral-700 placeholder:text-neutral-400 ring-1 ring-black/[0.09] outline-none focus:ring-2 focus:ring-neutral-900/30"
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!touched}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-950 px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-neutral-950"
            >
              <FiPlus className="size-3.5" /> Show
            </button>
          </div>
          {error && (
            <div role="alert" className="mt-2 text-[11.5px] text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="mt-4 rounded-xl bg-white px-3.5 py-3 text-[11.5px] leading-relaxed text-neutral-500 ring-1 ring-black/[0.06]">
          YouTube links play as embeds; photos and direct video files render
          as-is. Some sites refuse to load inside another page — use the
          open-in-new-tab button for those.
        </div>
      </div>
    </WModal>
  );
}
