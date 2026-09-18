import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
   WORLD MOTION — shared open/close animation primitives.
   Same bone-paper voice as chrome.tsx, one spring language
   everywhere: modals rise + settle, popovers drop + fade,
   toasts stack from below. Instant when reduced-motion is set.
   Callers keep their `{open && <…/>}` mounts and wrap them in
   <AnimatePresence>; these components own enter/exit variants.
   ───────────────────────────────────────────────────────────── */

export const WORLD_EASE = [0.22, 1, 0.36, 1] as const;
const WORLD_SPRING = { stiffness: 380, damping: 34, mass: 0.9 };

/* ── Modal (centered dialogs) ─────────────────────────────────
   Owns focus while open: initial focus lands on the first control (or
   the panel itself), Tab cycles inside, and focus returns to the
   opener on unmount — keyboard users never drop back into the 3D
   scene behind the backdrop. */
export function WModal({
  children,
  label,
  onClose,
  wide,
  className,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.getAttribute("aria-hidden") !== "true");
    // Respect an explicit autoFocus inside the panel (React flushes it
    // before effects); otherwise start on the first control so keyboard
    // users don't begin behind the backdrop.
    if (!panel.contains(document.activeElement)) {
      const first = focusables()[0];
      if (first) first.focus();
      else {
        panel.tabIndex = -1;
        panel.focus({ preventScroll: true });
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (!head || !tail) return;
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);

  return (
    <motion.div
      className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduce ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : 0.18 }}
    >
      <motion.div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[86vh] w-full flex-col overflow-hidden rounded-2xl bg-[#f4f2ed] ring-1 ring-black/[0.09] shadow-[0_28px_70px_-12px_rgba(0,0,0,0.45)]",
          wide ? "max-w-2xl" : "max-w-md",
          className,
        )}
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.98 }}
        transition={
          reduce ? { duration: 0 } : { type: "spring", ...WORLD_SPRING }
        }
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function WModalHeader({
  eyebrow,
  title,
  onClose,
  closeLabel = "Close",
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[0.07] px-4 py-3">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 leading-none">
          {eyebrow}
        </div>
        <div className="mt-1 truncate text-[15px] font-semibold tracking-tight text-neutral-900">
          {title}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="rounded-lg p-2 text-neutral-600 transition-colors hover:bg-black/[0.05] hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-4"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
}

/* ── Popover (dropdowns, menus, coachmarks) ─────────────────── */
export function WPopover({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn(
        "overflow-hidden rounded-2xl bg-[#f4f2ed]/97 ring-1 ring-black/[0.09] backdrop-blur-md shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)]",
        className,
      )}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.98 }}
      transition={
        reduce ? { duration: 0 } : { duration: 0.2, ease: WORLD_EASE }
      }
    >
      {children}
    </motion.div>
  );
}

/* ── Toast stack ────────────────────────────────────────────── */
export function WToastStack({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-20 left-4 z-10 flex flex-col items-start gap-1.5">
      <AnimatePresence>{children}</AnimatePresence>
    </div>
  );
}

export function WToast({
  id,
  tone = "neutral",
  children,
}: {
  id: string;
  tone?: "neutral" | "warn";
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={id}
      layout={reduce ? undefined : true}
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-[12px] font-medium ring-1 backdrop-blur-md shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]",
        tone === "warn"
          ? "bg-amber-50/95 text-amber-900 ring-amber-500/30"
          : "bg-[#f4f2ed]/95 text-neutral-800 ring-black/[0.09]",
      )}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.96 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: "spring", stiffness: 420, damping: 30 }
      }
    >
      {children}
    </motion.div>
  );
}

/* ── Pill (interactive HUD chip with press physics) ─────────── */
export function WPill({
  children,
  className,
  onClick,
  label,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const cls = cn(
    "inline-flex items-center gap-2 rounded-full bg-[#f4f2ed]/95 text-neutral-800 ring-1 ring-black/[0.09] backdrop-blur-md shadow-[0_4px_16px_-6px_rgba(0,0,0,0.3)]",
    className,
  );
  if (!onClick) return <span className={cls}>{children}</span>;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cls}
      whileHover={reduce ? undefined : { scale: 1.03 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
    >
      {children}
    </motion.button>
  );
}

/* Re-export AnimatePresence so callers have one import. */
export { AnimatePresence };
