import { useState } from "react";
import { DModal, DBtn } from "./chrome";
import { useGalleryStore } from "./office/GalleryFrames";
import type { GalleryFrame } from "./office/layout";

/**
 * Community gallery editor: paste any image link into the frame (or clear
 * it). The hub relays to everyone in the workspace. Hosts that block
 * hotlinking (no CORS) won't render — picsum.photos always works.
 */
export function GalleryModal({
  frame,
  onSet,
  onClose,
}: {
  frame: GalleryFrame;
  onSet: (frameId: string, imageUrl: string | null) => void;
  onClose: () => void;
}) {
  const gallery = useGalleryStore();
  const current = gallery[frame.id] ?? null;
  const [url, setUrl] = useState(current ?? "");
  const [previewError, setPreviewError] = useState(false);

  const trimmed = url.trim();
  const valid =
    trimmed.length > 0 &&
    trimmed.length <= 2048 &&
    /^https?:\/\/.+\..+/.test(trimmed);

  const save = () => {
    if (!valid) return;
    onSet(frame.id, trimmed);
    onClose();
  };

  return (
    <DModal
      eyebrow="Community wall"
      title={frame.title}
      onClose={onClose}
      closeLabel="Close gallery editor"
      wide
      className="max-w-[min(640px,96vw)]"
    >
      <div className="flex flex-col gap-3 p-4">
        {current ? (
          <div className="overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-black/[0.08]">
            <img
              src={current}
              alt={`${frame.title} — community image`}
              className="max-h-[40vh] w-full object-contain"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        ) : (
          <p className="rounded-xl bg-white px-3.5 py-3 text-[12.5px] text-neutral-500 ring-1 ring-black/[0.07]">
            This frame is empty. Paste an image link below — everyone here sees
            it instantly.
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            Image link
          </span>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreviewError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="https://picsum.photos/seed/hive/800/600"
              inputMode="url"
              aria-label="Image link"
              className="min-w-0 flex-1 rounded-xl bg-white px-3.5 py-2.5 text-[13px] text-neutral-800 placeholder:text-neutral-400 ring-1 ring-black/[0.09] outline-none focus:ring-2 focus:ring-neutral-900/30"
            />
            <DBtn variant="primary" onClick={save} disabled={!valid}>
              Set
            </DBtn>
          </div>
        </label>

        {trimmed.length > 0 && !valid && (
          <p role="alert" className="text-[11.5px] text-rose-700">
            That doesn&apos;t look like an image link — it needs http(s) and a
            host.
          </p>
        )}
        {valid && (
          <div className="overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-black/[0.08]">
            <img
              src={trimmed}
              alt="Link preview"
              className="max-h-[30vh] w-full object-contain"
              loading="lazy"
              onError={() => setPreviewError(true)}
              onLoad={() => setPreviewError(false)}
            />
          </div>
        )}
        {previewError && (
          <p role="alert" className="text-[11.5px] text-rose-700">
            Preview failed — this host likely blocks hotlinking. Try
            picsum.photos or an image from a CDN with CORS enabled.
          </p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-neutral-500">
            Visible to everyone · anyone can change it
          </p>
          {current && (
            <DBtn
              variant="danger"
              onClick={() => {
                onSet(frame.id, null);
                onClose();
              }}
            >
              Clear frame
            </DBtn>
          )}
        </div>
      </div>
    </DModal>
  );
}
