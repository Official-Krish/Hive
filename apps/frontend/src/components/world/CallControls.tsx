import {
  FiMic,
  FiMicOff,
  FiMonitor,
  FiVideo,
  FiVideoOff,
} from "react-icons/fi";
import { cn } from "@/lib/utils";

interface CallControlsProps {
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleShare: () => void;
}

/**
 * Proximity call controls. One language: white = on, rose = off/muted.
 * Share follows the same rule — no more green-vs-red split.
 */
export function CallControls({
  micOn,
  cameraOn,
  sharing,
  toggleMic,
  toggleCamera,
  toggleShare,
}: CallControlsProps) {
  const btn = (on: boolean) =>
    cn(
      "grid size-9 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-neutral-900/50 active:scale-95",
      on
        ? "bg-neutral-950 text-white hover:bg-neutral-800"
        : "bg-rose-500 text-white hover:bg-rose-500",
    );
  return (
    <div
      role="toolbar"
      aria-label="Call controls"
      className="flex items-center gap-1.5 rounded-full bg-[#f4f2ed]/95 px-2 py-1.5 ring-1 ring-black/[0.08] backdrop-blur-md"
    >
      <button
        type="button"
        onClick={toggleMic}
        aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        aria-pressed={micOn}
        title={micOn ? "Mute microphone" : "Unmute microphone"}
        className={btn(micOn)}
      >
        {micOn ? <FiMic className="size-4" /> : <FiMicOff className="size-4" />}
      </button>
      <button
        type="button"
        onClick={toggleCamera}
        aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
        aria-pressed={cameraOn}
        title={cameraOn ? "Turn camera off" : "Turn camera on"}
        className={btn(cameraOn)}
      >
        {cameraOn ? (
          <FiVideo className="size-4" />
        ) : (
          <FiVideoOff className="size-4" />
        )}
      </button>
      <button
        type="button"
        onClick={toggleShare}
        aria-label={sharing ? "Stop sharing screen" : "Share screen"}
        aria-pressed={sharing}
        title={sharing ? "Stop sharing screen" : "Share screen"}
        className={btn(sharing)}
      >
        <FiMonitor className="size-4" />
      </button>
    </div>
  );
}
