/* ─────────────────────────────────────────────────────────────
   PAPER — the console's instrument inset.
   The landing page's most distinctive surface is the bone bezel
   from the Activity section: warm paper, an engraved grid, hairline
   rules, instrument strips with tiny meta type, and serif display
   numerals. This module rebuilds that surface as the dashboard's
   primary material so marketing → product reads as one system.
   ───────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── controls on paper ── */
export const paperLabelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500";

export const paperInputClass =
  "w-full rounded-xl border border-neutral-900/15 bg-white px-3.5 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 outline-none transition-all focus:border-neutral-900/40 focus:ring-4 focus:ring-neutral-900/[0.06]";

export const paperGhostBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-neutral-900/15 bg-transparent px-5 py-2.5 text-[13px] font-medium text-neutral-700 transition-all hover:border-neutral-900/30 hover:bg-neutral-900/[0.04] hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40";

/* Primary action on paper — ink, not white (white vanishes on bone). */
export const inkBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950/60 disabled:cursor-not-allowed disabled:opacity-40";

/* ── tiny eyebrow used inside paper sections ── */
export function PaperEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-500",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── hairline rule ── */
export function Hairline({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("h-px bg-neutral-900/[0.08]", className)} />
  );
}

/* ── live / state dot — emerald strictly means live ── */
export function LiveDot({
  tone = "live",
  ping = false,
  ring = false,
  className,
}: {
  tone?: "live" | "away" | "off" | "warn";
  ping?: boolean;
  /** paper-colored halo, for dots sitting on top of avatars */
  ring?: boolean;
  className?: string;
}) {
  const color =
    tone === "live"
      ? "bg-emerald-500"
      : tone === "away"
        ? "bg-amber-500"
        : tone === "warn"
          ? "bg-amber-600"
          : "bg-neutral-400";
  const halo = ring ? "ring-2 ring-[#f4f2ed]" : "";
  return (
    <span className={cn("relative flex size-1.5", className)}>
      {ping && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping",
            color,
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex size-1.5 rounded-full",
          color,
          halo,
        )}
      />
    </span>
  );
}

/* Map a realtime presence status to dot + word */
export function presenceMeta(status: string): {
  tone: "live" | "away" | "off";
  label: string;
} {
  switch (status) {
    case "online":
      return { tone: "live", label: "in the office" };
    case "away":
      return { tone: "away", label: "away" };
    default:
      return { tone: "off", label: "offline" };
  }
}

/* ── one person on the office roster ── */
export function PresenceRow({
  name,
  avatarUrl,
  status,
}: {
  name: string;
  avatarUrl?: string | null;
  status: string;
}) {
  const meta = presenceMeta(status);
  return (
    <li className="flex items-center gap-2.5">
      <span className="relative flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-6 rounded-full object-cover ring-1 ring-neutral-900/10"
          />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-neutral-900/[0.06] text-[10px] font-semibold text-neutral-600 ring-1 ring-neutral-900/10">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <LiveDot
          tone={meta.tone}
          ping={status === "online"}
          ring
          className="absolute -bottom-px -right-px z-10"
        />
      </span>
      <span className="truncate text-[13px] font-medium text-neutral-900">
        {name}
      </span>
      <span className="ml-auto flex-shrink-0 text-[11px] tabular-nums text-neutral-500">
        {meta.label}
      </span>
    </li>
  );
}

/* ── overlapping avatar stack ── */
export function AvatarStack({
  people,
  max = 5,
  size = 26,
}: {
  people: Array<{ name: string; avatarUrl?: string | null }>;
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={`${p.name}-${i}`}
          title={p.name}
          className="flex items-center justify-center overflow-hidden rounded-full ring-2 ring-[#f4f2ed]"
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -8,
            zIndex: shown.length - i,
          }}
        >
          {p.avatarUrl ? (
            <img
              src={p.avatarUrl}
              alt={p.name}
              style={{ width: size, height: size }}
              className="object-cover"
            />
          ) : (
            <span
              style={{ width: size, height: size, fontSize: size * 0.38 }}
              className="flex items-center justify-center bg-neutral-900/[0.07] font-semibold text-neutral-700"
            >
              {p.name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -8 }}
          className="z-0 flex items-center justify-center rounded-full bg-neutral-900/[0.07] text-[10px] font-semibold tabular-nums text-neutral-600 ring-2 ring-[#f4f2ed]"
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/* ── THE BEZEL ──
   One instrument, not a stack of cards: a single rounded frame,
   optional engraved grid backdrop, and optional top/bottom
   instrument strips for meta type. */
export function PaperInset({
  children,
  className,
  grid = false,
  top,
  bottom,
}: {
  children: ReactNode;
  className?: string;
  grid?: boolean;
  top?: ReactNode;
  bottom?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] text-neutral-900 ring-1 ring-black/[0.09] sm:rounded-[28px]",
        "shadow-[0_1px_0_rgba(255,255,255,0.12),0_30px_60px_-24px_rgba(0,0,0,0.55),0_12px_24px_-16px_rgba(0,0,0,0.45)]",
        "bg-[#f4f2ed]",
        className,
      )}
    >
      {/* engraved grid — warm neutral, like graph paper pressed into the stock */}
      {grid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(28,25,18,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(28,25,18,0.05) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse 100% 80% at 50% 20%, black, transparent 85%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 100% 80% at 50% 20%, black, transparent 85%)",
          }}
        />
      )}

      {top && (
        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-neutral-900/10 px-5 py-3 sm:px-7">
          {top}
        </div>
      )}

      <div className="relative">{children}</div>

      {bottom && (
        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-neutral-900/10 bg-neutral-900/[0.015] px-5 py-3 sm:px-7">
          {bottom}
        </div>
      )}
    </div>
  );
}

/* meta text for the strips */
export function StripMeta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[11px] font-medium tracking-[0.02em] text-neutral-500",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── a quiet attention note on paper (amber ink, no box) ── */
export function InkNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-[12.5px] leading-relaxed text-neutral-600",
        className,
      )}
    >
      <LiveDot tone="warn" className="mt-[6px] flex-shrink-0" />
      <span>{children}</span>
    </p>
  );
}
