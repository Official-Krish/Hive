import { useState } from "react";
import { DModal, DBtn } from "./chrome";

/**
 * Space-wide announcement (Gather spotlight parity): the message relays to
 * every member in the workspace via the ticker + toast. No podium geometry
 * needed — available from the top bar.
 */
export function SpotlightModal({
  onSend,
  onClose,
}: {
  onSend: (message: string) => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const trimmed = message.trim();
  const send = () => {
    if (!trimmed) return;
    onSend(trimmed.slice(0, 200));
    onClose();
  };
  return (
    <DModal
      eyebrow="Space-wide"
      title="Announce to everyone"
      onClose={onClose}
      closeLabel="Close announcements"
    >
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[12.5px] leading-relaxed text-neutral-500">
          Everyone in this workspace sees it in the ticker — use it for
          launches, demos, and lunch.
        </p>
        <input
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          maxLength={200}
          placeholder="Something worth interrupting for…"
          aria-label="Announcement message"
          className="w-full rounded-xl bg-white px-3.5 py-2.5 text-[13px] text-neutral-800 placeholder:text-neutral-400 ring-1 ring-black/[0.09] outline-none focus:ring-2 focus:ring-neutral-900/30"
        />
        <div className="flex justify-end gap-2">
          <DBtn variant="ghost" onClick={onClose}>
            Cancel
          </DBtn>
          <DBtn
            variant="primary"
            onClick={send}
            disabled={trimmed.length === 0}
          >
            Announce
          </DBtn>
        </div>
      </div>
    </DModal>
  );
}
