import {
  FiMic,
  FiMicOff,
  FiMonitor,
  FiSettings,
  FiVideo,
  FiVideoOff,
} from "react-icons/fi";

export function CallControls({
  micOn,
  cameraOn,
  sharing,
  toggleMic,
  toggleCamera,
  toggleShare,
}: {
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleShare: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-[#f4f2ed]/95 px-2 py-1.5 shadow-[0_12px_28px_-16px_rgba(28,25,18,0.5)] ring-1 ring-black/[0.09] backdrop-blur-sm">
      <button
        type="button"
        onClick={toggleMic}
        title={micOn ? "Mute microphone" : "Unmute microphone"}
        className={`grid size-9 place-items-center rounded-full transition-colors ${
          micOn
            ? "bg-neutral-950 text-white hover:bg-neutral-800"
            : "bg-rose-500 text-white hover:bg-rose-600"
        }`}
      >
        {micOn ? <FiMic className="size-4" /> : <FiMicOff className="size-4" />}
      </button>
      <button
        type="button"
        onClick={toggleCamera}
        title={cameraOn ? "Turn camera off" : "Turn camera on"}
        className={`grid size-9 place-items-center rounded-full transition-colors ${
          cameraOn
            ? "bg-neutral-950 text-white hover:bg-neutral-800"
            : "bg-rose-500 text-white hover:bg-rose-600"
        }`}
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
        title={sharing ? "Stop sharing screen" : "Share screen"}
        className={`grid size-9 place-items-center rounded-full transition-colors ${
          sharing
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-white text-neutral-700 hover:bg-neutral-50"
        }`}
      >
        <FiMonitor className="size-4" />
      </button>
      <button
        type="button"
        disabled
        title="Settings — coming soon"
        className="grid size-9 cursor-not-allowed place-items-center rounded-full bg-white/70 text-neutral-400"
      >
        <FiSettings className="size-4" />
      </button>
    </div>
  );
}
