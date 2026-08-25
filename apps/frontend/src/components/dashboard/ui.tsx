/* ─────────────────────────────────────────────────────────────
   DASHBOARD UI ATOMS
   Small shared building blocks for the off-white shell: an
   editorial serif masthead with italic qualifiers, quiet white
   panels, ink pill primary actions, and honest empty / error
   states. Primary content objects live on paper — see ./Paper.tsx.
   ───────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { FiAlertCircle, FiCheckCircle, FiInfo } from "react-icons/fi";
import { cn } from "@/lib/utils";
import { fade } from "./primitives";

/* ── form control classNames on the light shell ── */
export const inputClass =
  "w-full rounded-xl border border-neutral-900/15 bg-white px-3.5 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 outline-none transition-all focus:border-neutral-900/40 focus:ring-4 focus:ring-neutral-900/[0.06]";

export const labelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500";

export const primaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-neutral-800 hover:scale-[1.015] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100";

export const ghostBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-neutral-900/15 bg-transparent px-5 py-2.5 text-[13px] font-medium text-neutral-700 transition-all hover:border-neutral-900/30 hover:bg-neutral-900/[0.04] hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40";

/* ── page masthead — eyebrow · serif title · optional meta + action ── */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  meta,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** small live/meta row rendered above the title, next to the eyebrow */
  meta?: ReactNode;
}) {
  return (
    <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <motion.div
          {...fade(0)}
          className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            {eyebrow}
          </span>
          {meta}
        </motion.div>
        <motion.h1
          {...fade(0.05)}
          className="font-serif text-[2rem] leading-[1.04] tracking-[-0.02em] text-neutral-950 sm:text-[2.6rem]"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            {...fade(0.1)}
            className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-neutral-600"
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

/* ── a quiet raised panel on the light shell ── */
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
        "rounded-2xl border border-neutral-900/[0.08] bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── section label on the light shell ── */
export function SectionLabel({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
      {icon}
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
  labelClass: labels = labelClass,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  labelClass?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labels}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ── spinner (monochrome; pass ink for use on paper) ── */
export function Spinner({
  className,
  ink = false,
}: {
  className?: string;
  ink?: boolean;
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-t-transparent",
        ink
          ? "border-neutral-900/25 border-t-neutral-900"
          : "border-neutral-900/20 border-t-neutral-900/80",
        className ?? "size-4",
      )}
    />
  );
}

/* ── empty state — an editorial invitation, never a dead end ── */
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-900/15 bg-neutral-900/[0.015] px-6 py-16 text-center">
      {icon && (
        <div className="mb-5 flex size-11 items-center justify-center rounded-full border border-neutral-900/10 bg-neutral-900/[0.03] text-neutral-500">
          {icon}
        </div>
      )}
      <p className="font-serif text-[1.4rem] leading-tight tracking-[-0.01em] text-neutral-950">
        {title}
      </p>
      {hint && (
        <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-neutral-500">
          {hint}
        </p>
      )}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

/* ── inline note — info or error, in the interface's own voice ── */
export function Note({
  tone = "info",
  children,
  onPaper = false,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
  onPaper?: boolean;
}) {
  const palette = onPaper
    ? tone === "error"
      ? "border-rose-600/20 bg-rose-600/[0.05] text-rose-800"
      : tone === "success"
        ? "border-emerald-700/20 bg-emerald-700/[0.05] text-emerald-900"
        : "border-neutral-900/12 bg-neutral-900/[0.03] text-neutral-700"
    : tone === "error"
      ? "border-rose-600/20 bg-rose-600/[0.05] text-rose-800"
      : tone === "success"
        ? "border-emerald-700/20 bg-emerald-700/[0.05] text-emerald-900"
        : "border-neutral-900/12 bg-neutral-900/[0.03] text-neutral-700";
  const iconColor = onPaper ? "text-neutral-500" : undefined;
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
      <Icon
        className={cn("mt-0.5 size-4 flex-shrink-0", iconColor)}
        aria-hidden
      />
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
        className="flex-shrink-0 rounded-full object-cover ring-1 ring-neutral-900/10"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-neutral-900/[0.06] ring-1 ring-neutral-900/10"
    >
      <span
        style={{ fontSize: size * 0.4 }}
        className="font-semibold text-neutral-700"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

/* ── loading skeleton for ruled lists ── */
export function SkeletonList() {
  return (
    <Panel className="divide-y divide-neutral-900/[0.07] overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
          <div className="flex-1">
            <div className="h-5 w-40 animate-pulse rounded bg-neutral-900/[0.06]" />
            <div className="mt-2 h-3 w-64 animate-pulse rounded bg-neutral-900/[0.04]" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-neutral-900/[0.05]" />
        </div>
      ))}
    </Panel>
  );
}

/* ── a small role tag ── */
export function RoleTag({ role }: { role: string }) {
  return (
    <span className="rounded-full border border-neutral-900/15 bg-neutral-900/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-600">
      {role}
    </span>
  );
}

/* role tag on paper — ink outline instead of chalk */
export function PaperRoleTag({ role }: { role: string }) {
  return (
    <span className="rounded-full border border-neutral-900/15 bg-neutral-900/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-600">
      {role}
    </span>
  );
}
