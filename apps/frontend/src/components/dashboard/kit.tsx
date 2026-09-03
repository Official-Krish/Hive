import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiCopy, FiInfo } from "react-icons/fi";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
   HIVE console kit — light minimalist instrument.
   Warm paper, ink text, hairline borders, flat white surfaces.
   Mono eyebrows, tight grotesk titles. Emerald = live, rose =
   destructive. Nothing else.
   ───────────────────────────────────────────────────────────── */

export const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Page head ─────────────────────────────────────────────── */
export function PageHead({
  eyebrow,
  title,
  sub,
  actions,
  meta,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="dash-rise mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            {eyebrow}
          </p>
          {meta}
        </div>
        <h1 className="mt-2 text-balance text-[24px] font-semibold leading-tight tracking-[-0.02em] text-neutral-900">
          {title}
        </h1>
        {sub && (
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-neutral-600">
            {sub}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

/* ── Surfaces ──────────────────────────────────────────────── */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-neutral-900/[0.08] bg-white",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-900/[0.07] px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-medium text-neutral-800">
          {title}
        </h2>
        {hint && (
          <p className="mt-0.5 truncate text-xs text-neutral-500">{hint}</p>
        )}
      </div>
      {right}
    </div>
  );
}

/* ── Ruled row (link or static) ────────────────────────────── */
export function Row({
  children,
  to,
  onClick,
  className,
}: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  className?: string;
}) {
  const cls = cn(
    "flex items-center gap-3 px-5 py-3.5 transition-colors",
    (to || onClick) && "hover:bg-neutral-900/[0.02]",
    className,
  );
  if (to)
    return (
      <Link to={to} className={cn(cls, "group")}>
        {children}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(cls, "w-full text-left")}
      >
        {children}
      </button>
    );
  return <div className={cls}>{children}</div>;
}

/* ── Buttons ───────────────────────────────────────────────── */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40";

export const btnPrimaryClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

export const btnGhostClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-neutral-900/15 bg-transparent px-4 py-2 text-[13px] font-medium text-neutral-700 transition-all duration-200 hover:border-neutral-900/30 hover:bg-neutral-900/[0.03] hover:text-neutral-900 active:scale-[0.98]";

export function Btn({
  children,
  variant = "primary",
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger" | "quiet";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        btnBase,
        variant === "primary" &&
          "bg-neutral-950 px-4 py-2 text-white hover:bg-neutral-800 active:scale-[0.98]",
        variant === "ghost" &&
          "border border-neutral-900/15 bg-transparent px-4 py-2 text-neutral-700 hover:border-neutral-900/30 hover:bg-neutral-900/[0.03] hover:text-neutral-900 active:scale-[0.98]",
        variant === "danger" &&
          "border border-rose-600/25 bg-rose-600/[0.06] px-4 py-2 text-rose-700 hover:bg-rose-600/[0.1] active:scale-[0.98]",
        variant === "quiet" &&
          "px-2 py-1 text-neutral-500 hover:text-neutral-900",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  label,
  onClick,
  className,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-900/[0.05] hover:text-neutral-900",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Two-step inline confirm — no modal, no jank. */
export function ConfirmBtn({
  children,
  confirmLabel = "Confirm",
  onConfirm,
  pending,
  variant = "danger",
}: {
  children: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  variant?: "danger" | "ghost";
}) {
  const [armed, setArmed] = useState(false);
  if (!armed)
    return (
      <Btn variant={variant} onClick={() => setArmed(true)}>
        {children}
      </Btn>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <Btn
        variant={variant}
        disabled={pending}
        onClick={() => {
          onConfirm();
          setArmed(false);
        }}
      >
        {pending ? "Working…" : confirmLabel}
      </Btn>
      <Btn variant="ghost" onClick={() => setArmed(false)}>
        Cancel
      </Btn>
    </span>
  );
}

/* ── Forms ─────────────────────────────────────────────────── */
export const inputClass =
  "h-10 w-full rounded-lg border border-neutral-900/15 bg-neutral-900/[0.02] px-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-neutral-900/40 focus:bg-white";

export const labelClass =
  "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-neutral-500">{hint}</span>
      )}
    </label>
  );
}

export function CopyField({
  value,
  mono = true,
}: {
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code
        className={cn(
          "h-10 min-w-0 flex-1 truncate rounded-lg border border-neutral-900/15 bg-neutral-900/[0.02] px-3 leading-10 text-[13px] text-neutral-800",
          mono && "font-mono",
        )}
      >
        {value}
      </code>
      <Btn
        variant="ghost"
        className="h-10 px-3"
        onClick={() => {
          navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? (
          <FiCheck className="size-4 text-emerald-600" />
        ) : (
          <FiCopy className="size-4" />
        )}
      </Btn>
    </div>
  );
}

/* ── Badges / status ───────────────────────────────────────── */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "live" | "warn" | "danger" | "info";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]",
        tone === "neutral" &&
          "border-neutral-900/10 bg-neutral-900/[0.04] text-neutral-600",
        tone === "live" &&
          "border-emerald-600/25 bg-emerald-600/[0.08] text-emerald-700",
        tone === "warn" &&
          "border-amber-600/25 bg-amber-600/[0.08] text-amber-800",
        tone === "danger" &&
          "border-rose-600/25 bg-rose-600/[0.07] text-rose-700",
        tone === "info" && "border-sky-600/25 bg-sky-600/[0.07] text-sky-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge>{role}</Badge>;
}

export function LiveDot({ tone = "live" }: { tone?: "live" | "away" | "off" }) {
  return (
    <span className="relative flex size-1.5 flex-shrink-0">
      {tone === "live" && (
        <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500/60" />
      )}
      <span
        className={cn(
          "relative size-1.5 rounded-full",
          tone === "live" && "bg-emerald-500",
          tone === "away" && "bg-amber-500",
          tone === "off" && "bg-neutral-400",
        )}
      />
    </span>
  );
}

export function Avatar({
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
        className="flex-shrink-0 rounded-full object-cover ring-1 ring-neutral-900/10"
      />
    );
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-neutral-900/[0.06] text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-900/[0.06]"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/* ── States ────────────────────────────────────────────────── */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-neutral-900/15 border-t-neutral-900",
        className,
      )}
    />
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <div className="divide-y divide-neutral-900/[0.06]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4">
            <div className="size-8 animate-pulse rounded-full bg-neutral-900/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-900/[0.06]" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-neutral-900/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <p className="text-[15px] font-medium text-neutral-800">{title}</p>
      {hint && (
        <p className="mt-1.5 max-w-sm text-[13px] text-neutral-500">{hint}</p>
      )}
      {action && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </Card>
  );
}

export function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "warn";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed",
        tone === "info" &&
          "border-neutral-900/10 bg-neutral-900/[0.02] text-neutral-600",
        tone === "error" &&
          "border-rose-600/25 bg-rose-600/[0.05] text-rose-800",
        tone === "success" &&
          "border-emerald-600/20 bg-emerald-600/[0.05] text-emerald-800",
        tone === "warn" &&
          "border-amber-600/25 bg-amber-600/[0.06] text-amber-900",
      )}
    >
      <FiInfo
        className={cn(
          "mt-0.5 size-4 flex-shrink-0",
          tone === "error" && "text-rose-600",
          tone === "success" && "text-emerald-600",
          tone === "warn" && "text-amber-600",
          tone === "info" && "text-neutral-400",
        )}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ── Tabs (underline) ──────────────────────────────────────── */
export function Tabs({
  tabs,
}: {
  tabs: { label: string; href: string; active: boolean }[];
}) {
  return (
    <nav
      aria-label="Sections"
      className="flex gap-1 border-b border-neutral-900/[0.08]"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          to={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px border-b px-3 pb-2.5 pt-1 text-[13px] transition-colors",
            t.active
              ? "border-neutral-900 font-medium text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-800",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/* ── Back link ─────────────────────────────────────────────── */
export function BackLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="dash-rise mb-6 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
    >
      <FiArrowLeft className="size-3.5" />
      {children}
    </Link>
  );
}

/* ── Stat ──────────────────────────────────────────────────── */
export function Stat({
  value,
  label,
  hint,
}: {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-900">
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}

/* ── Presence ──────────────────────────────────────────────── */
const presenceText = (s: string) =>
  s === "online" ? "In the office" : s === "away" ? "Away" : "Offline";

export function PresenceRow({
  name,
  avatarUrl,
  status,
}: {
  name: string;
  avatarUrl?: string | null;
  status: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <Avatar name={name} src={avatarUrl} size={26} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-800">
        {name}
      </span>
      <LiveDot
        tone={status === "online" ? "live" : status === "away" ? "away" : "off"}
      />
      <span className="w-[76px] flex-shrink-0 text-right text-[11px] text-neutral-500">
        {presenceText(status)}
      </span>
    </li>
  );
}

export function AvatarStack({
  people,
  max = 5,
}: {
  people: { name: string; avatarUrl?: string | null }[];
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex flex-shrink-0 items-center">
      {shown.map((p, i) => (
        <span
          key={`${p.name}-${i}`}
          className="-ml-2 first:ml-0 rounded-full ring-2 ring-white"
        >
          <Avatar name={p.name} src={p.avatarUrl} size={24} />
        </span>
      ))}
      {rest > 0 && (
        <span className="-ml-2 flex h-6 items-center rounded-full bg-neutral-900/[0.06] px-2 font-mono text-[9px] text-neutral-600 ring-2 ring-white">
          +{rest}
        </span>
      )}
    </span>
  );
}
