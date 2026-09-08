import { useState } from "react";

const STORAGE_KEY = "hive-tour-seen-v1";

export function shouldShowTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode — tour just shows again next visit */
  }
}

const STEPS = [
  {
    title: "Welcome to Hive",
    body: "You spawn in the courtyard, south of the glass facade. Walk north (W) straight through the entrance into Reception.",
  },
  {
    title: "Find your way",
    body: "The directory totem in the lobby lists every wing — follow the room colors and corridor signs.",
  },
  {
    title: "Do work",
    body: "Walk to any glowing desk dot and press E to open a workspace. Whiteboards, the CI wall and the coffee bar work the same way.",
  },
  {
    title: "Go upstairs",
    body: "The stair beacon sits at the lobby's west end. Climb it for Leadership, the Boardroom and the mezzanine breakout.",
  },
];

/** Skippable first-run tour card, bottom-center above the ticker. */
export function WorldTour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i] ?? STEPS[0]!;
  const last = i === STEPS.length - 1;
  const dismiss = (seen: boolean) => {
    if (seen) markTourSeen();
    onClose();
  };
  return (
    <div
      role="dialog"
      aria-label="Hive tour"
      className="pointer-events-auto w-[320px] rounded-2xl bg-[#f4f2ed]/97 p-4 ring-1 ring-black/[0.09] backdrop-blur-md"
    >
      <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-500">
        Tour {i + 1}/{STEPS.length}
      </div>
      <div className="mt-1 text-[14px] font-semibold text-neutral-900">
        {step.title}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-600">
        {step.body}
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        {!last ? (
          <button
            type="button"
            onClick={() => setI((v) => v + 1)}
            className="flex-1 rounded-lg bg-neutral-950 py-1.5 text-[12px] font-semibold text-white hover:bg-neutral-800"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700"
          >
            Start exploring
          </button>
        )}
        {i > 0 && (
          <button
            type="button"
            onClick={() => setI((v) => v - 1)}
            className="rounded-lg bg-black/[0.05] px-3 py-1.5 text-[12px] font-semibold text-neutral-600 ring-1 ring-black/[0.07] hover:bg-black/[0.08]"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => dismiss(true)}
          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-400 hover:text-neutral-700"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
