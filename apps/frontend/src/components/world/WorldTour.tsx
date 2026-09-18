import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
    title: "Move around",
    body: "WASD or arrows to walk — hold Shift to run, Space to jump. Best on desktop with a keyboard.",
  },
  {
    title: "Look around",
    body: "Drag to look, scroll to zoom, V for first-person. Try it now — this card never blocks you.",
  },
  {
    title: "Touch the office",
    body: "Walk to any glowing marker and press E — or click the prompt. Desks open workspaces; the coffee bar, whiteboards, and CI wall all work the same way.",
  },
  {
    title: "Find people",
    body: "The members button (top right) opens the directory — every row opens that person's card. Stairs at the lobby's west end lead up to L2.",
  },
];

/** First-run coachmark: non-blocking, four steps, then gone. */
export function WorldTour({ onClose }: { onClose: (seen: boolean) => void }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const reduce = useReducedMotion();
  const step = STEPS[i] ?? STEPS[0]!;
  const last = i === STEPS.length - 1;
  const go = (next: number) => {
    setDir(next > i ? 1 : -1);
    setI(next);
  };
  const nextRef = useRef<HTMLButtonElement>(null);
  // Esc dismisses (permanently — it's a first-run coachmark, not a snooze);
  // initial focus lands on the primary action for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    nextRef.current?.focus();
  }, [i]);
  return (
    <motion.div
      role="dialog"
      aria-modal="false"
      aria-label="Hive tour"
      className="pointer-events-auto w-[320px] overflow-hidden rounded-2xl bg-[#f4f2ed]/97 p-4 ring-1 ring-black/[0.09] backdrop-blur-md shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)]"
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
      transition={
        reduce ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Tour {i + 1}/{STEPS.length}
        </div>
        <div className="flex items-center gap-1" aria-hidden>
          {STEPS.map((_, d) => (
            <span
              key={d}
              className={`h-1 rounded-full transition-all duration-300 ${
                d === i ? "w-6 bg-neutral-900" : "w-2.5 bg-neutral-900/15"
              }`}
            />
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={i}
          initial={reduce ? { opacity: 1 } : { opacity: 0, x: 24 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0, x: -24 * dir }}
          transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mt-1 text-[14px] font-semibold text-neutral-900">
            {step.title}
          </div>
          <p className="mt-1 min-h-[60px] text-[12.5px] leading-relaxed text-neutral-600">
            {step.body}
          </p>
        </motion.div>
      </AnimatePresence>
      <div className="mt-3 flex items-center gap-1.5">
        {!last ? (
          <button
            ref={nextRef}
            type="button"
            onClick={() => go(i + 1)}
            className="flex-1 rounded-lg bg-neutral-950 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Next
          </button>
        ) : (
          <button
            ref={nextRef}
            type="button"
            onClick={() => onClose(true)}
            className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Start exploring
          </button>
        )}
        {i > 0 && (
          <button
            type="button"
            onClick={() => go(i - 1)}
            className="rounded-lg bg-black/[0.05] px-3 py-1.5 text-[12px] font-semibold text-neutral-600 ring-1 ring-black/[0.07] transition-colors hover:bg-black/[0.08]"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => onClose(true)}
          title="Hide the tour permanently"
          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-700"
        >
          Don&apos;t show again
        </button>
      </div>
    </motion.div>
  );
}
