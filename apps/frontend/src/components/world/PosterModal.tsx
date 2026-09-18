import { DModal } from "./chrome";
import { ASSET_BASE_URL } from "@/lib/config";
import type { WallArt } from "./office/layout";

/**
 * Gallery poster viewer (Gather poster-board parity): walk to a framed
 * piece, press E, and it opens full-bleed with its title + caption.
 */
export function PosterModal({
  art,
  onClose,
}: {
  art: WallArt | null;
  onClose: () => void;
}) {
  if (!art) return null;
  return (
    <DModal
      eyebrow="Gallery"
      title={art.title}
      onClose={onClose}
      closeLabel="Close artwork"
      wide
      className="max-w-[min(640px,96vw)]"
    >
      <div className="flex-1 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-black/[0.08]">
          <img
            src={`${ASSET_BASE_URL}/art/${art.artId}.jpg`}
            alt={art.title}
            className="max-h-[52vh] w-full object-contain"
            loading="lazy"
          />
        </div>
        <p className="mt-3 px-1 text-[13px] leading-relaxed text-neutral-600">
          {art.caption}
        </p>
      </div>
    </DModal>
  );
}
