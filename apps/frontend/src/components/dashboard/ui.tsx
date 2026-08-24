/* ─────────────────────────────────────────────────────────────
   DASHBOARD UI ATOMS
   Small, shared, monochrome building blocks so every dashboard page
   reads as one instrument: an editorial serif masthead, quiet dark
   panels, white primary actions, and honest empty / error states.
   ───────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { FiAlertCircle, FiCheckCircle, FiInfo } from "react-icons/fi";
import { cn } from "@/lib/utils";
import { fade } from "./primitives";

/* ── form control classNames (shared so inputs match across pages) ── */
export const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white placeholder:text-slate-600 outline-none transition-colors focus:border-white/25 focus:bg-white/[0.05]";

export const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";

export const primaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-neutral-950 transition-all hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-40";

export const ghostBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-5 py-2.5 text-[13px] font-medium text-slate-300 transition-all hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

/* ── page masthead — eyebrow + serif title + optional subtitle/action ── */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <motion.div
          {...fade(0)}
          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
        >
          {eyebrow}
        </motion.div>
        <motion.h1
          {...fade(0.05)}
          className="font-serif text-3xl leading-[1.05] tracking-[-0.02em] text-white sm:text-[2.5rem]"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            {...fade(0.1)}
            className="mt-2 max-w-xl text-[14px] leading-relaxed text-slate-400"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div {...fade(0.15)} className="flex-shrink-0">
          {action}
        </motion.div>
      )}
    </header>
  );
}

/* ── a quiet raised panel ── */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-[#0d0f16]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── labelled field wrapper ── */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-slate-500">{hint}</p>}
    </div>
  );
}

/* ── spinner (monochrome) ── */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-white/20 border-t-white/80",
        className ?? "size-4",
      )}
    />
  );
}

/* ── empty state — an invitation to act, never a dead end ── */
export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400">
          {icon}
        </div>
      )}
      <p className="font-serif text-xl text-white">{title}</p>
      {hint && (
        <p className="mt-1.5 max-w-sm text-[13.5px] text-slate-500">{hint}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ── inline note — info or error, in the interface's own voice ── */
export function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const palette =
    tone === "error"
      ? "border-rose-400/25 bg-rose-400/[0.06] text-rose-200"
      : tone === "success"
        ? "border-white/12 bg-white/[0.04] text-slate-200"
        : "border-white/10 bg-white/[0.03] text-slate-300";
  const Icon =
    tone === "error"
      ? FiAlertCircle
      : tone === "success"
        ? FiCheckCircle
        : FiInfo;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed",
        palette,
      )}
    >
      <Icon className="mt-0.5 size-4 flex-shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/* ── a monochrome avatar (initial fallback, no colour) ── */
export function Avatar({
  name,
  src,
  size = 32,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className="flex-shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10"
    >
      <span className="text-[13px] font-semibold text-slate-200">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

/* ── a small role tag ── */
export function RoleTag({ role }: { role: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-slate-400">
      {role}
    </span>
  );
}
