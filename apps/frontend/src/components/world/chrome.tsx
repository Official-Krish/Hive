import { useEffect, useRef, type ReactNode } from "react";
import { FiX } from "react-icons/fi";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
   WORLD CHROME — the in-world UI language.
   Warm bone paper floating over the 3D scene, same voice as the
   light dashboard: ink text, hairline rings, mono eyebrows, soft
   shadows for legibility over bright geometry. One modal shell,
   one chip, one button set.
   ───────────────────────────────────────────────────────────── */

export const EYEBROW =
  "text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 leading-none";

/* ── Dismiss: Escape + outside pointer ─────────────────────── */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

export function useDismiss<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEscape(onClose);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);
  return ref;
}

/* ── Floating chip (top bar, hints, ticker, pills) ─────────── */
export function DChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-[#f4f2ed]/95 text-neutral-800 ring-1 ring-black/[0.09] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-800 ring-1 ring-black/[0.09]">
      {children}
    </kbd>
  );
}

/* ── Buttons ───────────────────────────────────────────────── */
export function DIconBtn({
  children,
  label,
  onClick,
  active,
  className,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "relative grid size-9 flex-shrink-0 place-items-center rounded-full bg-[#f4f2ed]/95 text-neutral-700 ring-1 ring-black/[0.09] backdrop-blur-md transition-colors hover:bg-white hover:text-neutral-950",
        active &&
          "bg-neutral-950 text-white hover:bg-neutral-800 hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DBtn({
  children,
  variant = "primary",
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger" | "accent";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "bg-neutral-950 text-white hover:bg-neutral-800",
        variant === "ghost" &&
          "bg-white text-neutral-700 ring-1 ring-black/[0.09] hover:bg-neutral-100",
        variant === "danger" &&
          "bg-rose-50 text-rose-700 ring-1 ring-rose-500/30 hover:bg-rose-100",
        variant === "accent" &&
          "bg-emerald-600 text-white hover:bg-emerald-700",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Popover panel (members, status, notifications) ────────── */
export function DPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-[#f4f2ed]/97 ring-1 ring-black/[0.09] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Modal shell (centered dialogs) ────────────────────────── */
export function DModal({
  children,
  eyebrow,
  title,
  onClose,
  closeLabel = "Close",
  wide,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  wide?: boolean;
}) {
  useEscape(onClose);
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[86vh] w-full flex-col overflow-hidden rounded-2xl bg-[#f4f2ed] ring-1 ring-black/[0.09]",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.07] px-4 py-3">
          <div className="min-w-0">
            <div className={EYEBROW}>{eyebrow}</div>
            <div className="mt-1 truncate text-[15px] font-semibold tracking-tight text-neutral-900">
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
          >
            <FiX className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Forms ─────────────────────────────────────────────────── */
export function DField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-neutral-500">{hint}</span>
      )}
    </label>
  );
}

export const dInputClass =
  "w-full rounded-lg border border-black/[0.09] bg-white px-3 py-2 text-[13px] text-neutral-700 placeholder:text-neutral-400 outline-none transition-colors focus:border-neutral-900/40";

/* ── Badges / status ───────────────────────────────────────── */
export const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  on_call: "bg-sky-500",
  busy: "bg-rose-500",
  focusing: "bg-violet-500",
  offline: "bg-neutral-300",
};

export function statusLabel(s?: string | null): string {
  switch (s) {
    case "online":
      return "Online";
    case "away":
      return "Away";
    case "on_call":
      return "On call";
    case "busy":
      return "Busy";
    case "focusing":
      return "Focusing";
    case "offline":
      return "Offline";
    default:
      return s
        ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Unknown";
  }
}

export function DBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "live" | "warn" | "danger" | "info" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ring-1",
        tone === "neutral" &&
          "bg-black/[0.04] text-neutral-600 ring-black/[0.07]",
        tone === "live" &&
          "bg-emerald-600/10 text-emerald-700 ring-emerald-600/25",
        tone === "warn" && "bg-amber-500/15 text-amber-800 ring-amber-500/30",
        tone === "danger" && "bg-rose-50 text-rose-700 ring-rose-500/30",
        tone === "info" && "bg-sky-500/10 text-sky-700 ring-sky-500/25",
        tone === "accent" &&
          "bg-violet-600/10 text-violet-700 ring-violet-500/25",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DAvatar({
  name,
  src,
  size = 28,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  if (src)
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="flex-shrink-0 rounded-full object-cover ring-1 ring-black/[0.08]"
      />
    );
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-neutral-900/[0.06] text-[11px] font-medium text-neutral-700 ring-1 ring-black/[0.06]"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/* ── Inline states ─────────────────────────────────────────── */
export function DEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-[13px] text-neutral-500">
      {children}
    </div>
  );
}

export function DLoading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2.5 px-4 py-10 text-[13px] text-neutral-500">
      <span className="inline-block size-4 animate-spin rounded-full border-2 border-neutral-900/15 border-t-neutral-900" />
      {children}
    </div>
  );
}

export function DError({
  children,
  retry,
}: {
  children: ReactNode;
  retry?: () => void;
}) {
  return (
    <div className="mx-4 my-4 flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-50 px-3.5 py-3 text-[13px] text-rose-700">
      <div className="min-w-0 flex-1">{children}</div>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="flex-shrink-0 font-semibold underline underline-offset-2 hover:text-rose-900"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* ── Shared formatters (single source; no cross-file imports) ─ */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return "<1m";
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const ms = Date.now() - d;
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
