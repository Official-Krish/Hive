import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import {
  FiArrowUpRight,
  FiGitPullRequest,
  FiCpu,
  FiCheckCircle,
  FiClock,
  FiTerminal,
  FiZap,
  FiActivity,
} from "react-icons/fi";

/* ─────────────────────────────────────────────────────────────
   ACTIVITY — Section 3
   Engineering activity → engineering intelligence.

   Design intent (2026 production):
   - One unifying bezel — the whole intelligence panel reads as
     one instrument, not four stitched cards.
   - Editorial typography: serif display for headlines + numerals,
     sans for body. Hierarchy via weight + scale, not ubiquitous
     tracking caps.
   - Timeline is a real timeline: rail + shape-coded markers
     (commit / agent run / review), time as a tabular axis.
   - The right panel leads with ONE hero number — the rest support.
   - AI usage shows the time dimension (sparkline) so it reads
     as intelligence, not a static snapshot.
   - All animation: spring-y, never linear, never gratuitous.
   ───────────────────────────────────────────────────────────── */

/* Entity palette — categorical slots in fixed order. Color
   follows the entity, never its rank. */
const ENTITY = {
  krish: { color: "#2a78d6", mono: "K" },
  claude: { color: "#eb6834", mono: "C" },
  sarah: { color: "#1baf7a", mono: "S" },
  alex: { color: "#4a3aa7", mono: "A" },
  codex: { color: "#008300", mono: "X" },
} as const;

type EntityId = keyof typeof ENTITY;

/* Event kinds — drive the marker SHAPE on the rail (the shape
   is the identity channel; color reinforces). */
type EventKind = "ship" | "agent" | "review" | "test" | "design";

interface ActivityEntry {
  id: EntityId;
  kind: EventKind;
  name: string;
  role: "developer" | "agent";
  task: string;
  meta: string;
  metaIcon: React.ReactNode;
  minutesAgo: number;
}

const activity: ActivityEntry[] = [
  {
    id: "krish",
    kind: "ship",
    name: "Krish",
    role: "developer",
    task: "Building OAuth authentication",
    meta: "4 files · PR #184",
    metaIcon: <FiGitPullRequest />,
    minutesAgo: 2,
  },
  {
    id: "claude",
    kind: "agent",
    name: "Claude",
    role: "agent",
    task: "Implementing PKCE flow",
    meta: "8.2k tokens · 12 calls",
    metaIcon: <FiTerminal />,
    minutesAgo: 3,
  },
  {
    id: "sarah",
    kind: "review",
    name: "Sarah",
    role: "developer",
    task: "Reviewing payment service",
    meta: "PR #181 · 3 comments",
    metaIcon: <FiGitPullRequest />,
    minutesAgo: 8,
  },
  {
    id: "codex",
    kind: "test",
    name: "Codex",
    role: "agent",
    task: "Running integration tests",
    meta: "42 tests · 0 failing",
    metaIcon: <FiCheckCircle />,
    minutesAgo: 11,
  },
  {
    id: "alex",
    kind: "design",
    name: "Alex",
    role: "developer",
    task: "Designing API architecture",
    meta: "architecture.md",
    metaIcon: <FiZap />,
    minutesAgo: 14,
  },
];

const TODAY_TS = 2; // "updated 2m ago" — single source of truth for the timestamp

/* TODAY stats — the first one is the HERO figure; the others
   support it (different scale, same surface). */
const todays = [
  { value: 127, label: "Tasks completed", delta: +18, hero: true },
  { value: 38, label: "PRs opened", delta: +6 },
  { value: 12, label: "Agents active", delta: +2 },
] as const;

/* AI usage — emphasis form: Claude leads, others de-emphasized
   in the same hue family. Sparkline adds the time dimension. */
const aiUsage = [
  {
    name: "Claude",
    current: 284,
    peak: 312,
    spark: [42, 58, 71, 95, 110, 142, 168, 195, 220, 248, 271, 284],
    accent: true,
  },
  {
    name: "Codex",
    current: 211,
    peak: 248,
    spark: [38, 52, 64, 82, 98, 124, 145, 168, 182, 195, 204, 211],
    accent: false,
  },
  {
    name: "Gemini",
    current: 143,
    peak: 188,
    spark: [22, 34, 48, 62, 78, 92, 105, 118, 126, 134, 140, 143],
    accent: false,
  },
] as const;

const MAX_AI = 320; // ceiling for the bar — kept off the value to leave headroom

/* Team output — meters; status by icon + label (never color alone). */
const teamOutput = [
  { name: "Authentication", pct: 100, status: "shipped" as const },
  { name: "Payment service", pct: 100, status: "shipped" as const },
  { name: "Test infrastructure", pct: 91, status: "in-review" as const },
  { name: "API migration", pct: 72, status: "active" as const },
] as const;

/* ── BLUE RAMP (validated against #f0efec) ── */
const BLUE = {
  50: "#eaf3fd",
  100: "#cde2fb",
  200: "#9ec5f4",
  300: "#6da7ec",
  400: "#3987e5",
  500: "#2a78d6",
  600: "#1c5cab",
  700: "#0d366b",
} as const;

/* ── TIMER for the "Xm ago" live counter ── */
function useTick(intervalMs = 30_000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

/* ── COUNT-UP for stat tiles ── */
function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());
  const [text, setText] = useState("0");
  useEffect(() => {
    const unsub = rounded.on("change", setText);
    const controls = animate(mv, value, {
      duration: 1.1,
      delay,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => {
      unsub();
      controls.stop();
    };
  }, [value, delay, mv, rounded]);
  return <span className="tabular-nums">{text}</span>;
}

/* ── Marker shape per event kind ── */
function Marker({ kind, color }: { kind: EventKind; color: string }) {
  const common = "relative z-10 flex items-center justify-center";
  switch (kind) {
    case "ship":
      return (
        <span className={common} style={{ width: 18, height: 18 }}>
          <span
            className="absolute inset-0 rounded-[5px] rotate-45 border-2 border-[#f0efec]"
            style={{ backgroundColor: color }}
          />
        </span>
      );
    case "agent":
      return (
        <span className={common} style={{ width: 18, height: 18 }}>
          <span
            className="absolute inset-[3px] rounded-full border-2 border-[#f0efec]"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 0 1.5px ${color}40`,
            }}
          />
        </span>
      );
    case "review":
      return (
        <span className={common} style={{ width: 18, height: 18 }}>
          <span
            className="absolute inset-[2px] rotate-45 border-2 border-[#f0efec]"
            style={{
              backgroundColor: "transparent",
              boxShadow: `inset 0 0 0 1.5px ${color}`,
            }}
          />
        </span>
      );
    case "test":
      return (
        <span className={common} style={{ width: 18, height: 18 }}>
          <span
            className="absolute inset-[3px] rounded-full border-2 border-[#f0efec]"
            style={{
              backgroundColor: "transparent",
              borderColor: color,
              borderStyle: "solid",
            }}
          />
        </span>
      );
    case "design":
      return (
        <span className={common} style={{ width: 18, height: 18 }}>
          <span
            className="absolute inset-[4px] rotate-45"
            style={{ backgroundColor: color }}
          />
        </span>
      );
  }
}

/* ── SPARKLINE (inline SVG) ── */
function Sparkline({
  data,
  color,
  id,
}: {
  data: readonly number[];
  color: string;
  id: string;
}) {
  const w = 120,
    h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const path = points
    .map(
      ([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`,
    )
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  const last = points[points.length - 1]!;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${id})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={2}
        fill={color}
        stroke="#f0efec"
        strokeWidth={1.5}
      />
    </svg>
  );
}

/* ── MOTION TOKENS ── */
const ease = [0.22, 1, 0.36, 1] as const;
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease, delay },
});

export const Activity = () => {
  useTick();

  return (
    <section className="relative bg-[#f0efec] text-neutral-900 py-20 sm:py-28 px-4 sm:px-6 lg:px-10 overflow-hidden">
      {/* ── Background: a single radial wash, not a tile grain.
          Gives the section its own light without competing with
          the bezel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(255,255,255,0.6), transparent 60%), radial-gradient(900px 500px at 90% 100%, rgba(42,120,214,0.06), transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* ── SECTION HEADER ──
            Editorial: serif display for the headline, sans for
            the eyebrow and subhead. Hierarchy by face + weight,
            not by tracking. */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <motion.div {...fade(0)} className="flex items-center gap-3 mb-5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium tracking-[0.04em] text-neutral-500">
              Engineering activity <span className="text-neutral-400">·</span>{" "}
              <span className="tabular-nums">updated {TODAY_TS}m ago</span>
            </span>
          </motion.div>

          <motion.h2
            {...fade(0.05)}
            className="font-serif text-[2.5rem] sm:text-6xl lg:text-[5rem] leading-[0.98] tracking-[-0.035em] text-neutral-950 text-balance"
          >
            Know what&rsquo;s happening,
            <br />
            <span className="italic text-neutral-500">without asking.</span>
          </motion.h2>

          <motion.p
            {...fade(0.1)}
            className="mt-6 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl"
          >
            Turn the activity of your developers and AI agents into a clear,
            living picture of what your team is building.
          </motion.p>
        </div>

        {/* ═══════════════════════════════════════════════════════
            THE BEZEL — one instrument, not four cards.
            Single rounded frame with an inner ring + a fine
            grid backdrop that reads as engineered surface.
            ═══════════════════════════════════════════════════════ */}
        <motion.div
          {...fade(0.15)}
          className="relative rounded-[28px] sm:rounded-[36px] bg-[#f6f4ef] ring-1 ring-neutral-900/10 overflow-hidden"
          style={{
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.8) inset, 0 0 0 1px rgba(0,0,0,0.04), 0 30px 60px -20px rgba(0,0,0,0.18), 0 12px 24px -12px rgba(0,0,0,0.12)",
          }}
        >
          {/* Engraved grid backdrop — like graph paper on an instrument */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-[0.35]"
            style={{
              backgroundImage: `linear-gradient(${BLUE[50]} 1px, transparent 1px), linear-gradient(90deg, ${BLUE[50]} 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
              maskImage:
                "radial-gradient(ellipse 100% 80% at 50% 30%, black, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 100% 80% at 50% 30%, black, transparent 80%)",
            }}
          />

          {/* Top instrument strip */}
          <div className="relative flex items-center justify-between px-5 sm:px-8 py-3 border-b border-neutral-900/10">
            <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500">
              <FiActivity className="size-3.5 text-emerald-500" />
              <span className="tracking-[0.02em]">Live intelligence</span>
              <span className="text-neutral-300 mx-1">/</span>
              <span className="tabular-nums">
                team ·{" "}
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-neutral-900/15"
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium tracking-[0.04em] text-neutral-500">
                <span className="text-neutral-900 tabular-nums">5</span> events
                · last <span className="text-neutral-900 tabular-nums">14</span>
                m
              </span>
            </div>
          </div>

          {/* The two views */}
          <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-neutral-900/10">
            {/* ── VIEW 1: TIMELINE ── */}
            <div className="relative px-5 sm:px-8 py-6 sm:py-8">
              {/* View header */}
              <div className="flex items-end justify-between mb-5">
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400 mb-1">
                    Timeline
                  </div>
                  <div className="font-serif text-2xl sm:text-3xl text-neutral-950 tracking-[-0.02em]">
                    The last{" "}
                    <span className="italic text-neutral-500">14 minutes.</span>
                  </div>
                </div>
              </div>
              {/* Legend row — works at all sizes */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-5 pb-4 border-b border-neutral-900/[0.06] text-[10px] font-medium text-neutral-500">
                <Legend kind="ship" label="Ship" />
                <Legend kind="agent" label="Agent run" />
                <Legend kind="review" label="Review" />
                <Legend kind="test" label="Test" />
                <Legend kind="design" label="Design" />
              </div>

              {/* The timeline rail */}
              <ol className="relative">
                {/* Vertical rail line */}
                <span
                  aria-hidden="true"
                  className="absolute left-[8.5px] top-2 bottom-2 w-px bg-neutral-900/15"
                />
                {activity.map((entry, i) => (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, x: -6 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.55, ease, delay: 0.2 + i * 0.07 }}
                    className="group relative grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-x-4 sm:gap-x-5 py-4"
                  >
                    {/* Marker on the rail */}
                    <Marker kind={entry.kind} color={ENTITY[entry.id].color} />

                    {/* Body */}
                    <div className="min-w-0 pt-[1px]">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-neutral-950 tracking-[-0.005em]">
                          {entry.name}
                        </span>
                        <span className="text-[11px] font-medium text-neutral-400">
                          {entry.role === "agent" ? "AI agent" : "Engineer"}
                        </span>
                      </div>
                      <div className="mt-1 text-[15px] text-neutral-800 leading-snug">
                        {entry.task}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/[0.04] px-1.5 py-0.5">
                          <span className="text-neutral-400">
                            {entry.metaIcon}
                          </span>
                          <span className="tabular-nums">{entry.meta}</span>
                        </span>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-[0.02em]"
                          style={{
                            color: ENTITY[entry.id].color,
                            backgroundColor: `${ENTITY[entry.id].color}12`,
                          }}
                        >
                          {entry.kind}
                        </span>
                      </div>
                    </div>

                    {/* Timestamp + arrow */}
                    <div className="pt-[3px] flex items-center gap-2">
                      <span className="text-[11px] tabular-nums font-medium text-neutral-400 whitespace-nowrap">
                        {entry.minutesAgo}m
                      </span>
                      <FiArrowUpRight className="size-3.5 text-neutral-300 opacity-0 group-hover:opacity-100 group-hover:text-neutral-700 -translate-x-1 group-hover:translate-x-0 transition-all" />
                    </div>
                  </motion.li>
                ))}
              </ol>
            </div>

            {/* ── VIEW 2: INTELLIGENCE PANEL ── */}
            <div
              className="relative px-5 sm:px-8 py-6 sm:py-8"
              style={{ backgroundColor: "rgba(241,239,233,0.5)" }}
            >
              {/* View header */}
              <div className="mb-6">
                <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400 mb-1">
                  Outcomes
                </div>
                <div className="font-serif text-2xl sm:text-3xl text-neutral-950 tracking-[-0.02em]">
                  From activity{" "}
                  <span className="italic text-neutral-500">to outcomes.</span>
                </div>
              </div>

              {/* HERO STAT — typographic moment, not a card */}
              <div className="mb-8">
                <motion.div {...fade(0.25)} className="relative">
                  {/* Eyebrow row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-500">
                      Today
                    </div>
                    <DeltaPill delta={todays[0].delta} />
                  </div>
                  {/* THE number — scale + italic qualifier does the work */}
                  <div className="flex items-end gap-3 sm:gap-4">
                    <span className="font-serif text-[5rem] sm:text-[7rem] lg:text-[8.5rem] leading-[0.85] tracking-[-0.05em] text-neutral-950">
                      <CountUp value={todays[0].value} delay={0.3} />
                    </span>
                    <div className="pb-3 sm:pb-4">
                      <div className="font-serif text-2xl sm:text-3xl text-neutral-800 leading-tight tracking-[-0.02em]">
                        tasks
                      </div>
                      <div className="text-[12px] text-neutral-500 mt-0.5">
                        completed{" "}
                        <span className="italic">by humans &amp; agents</span>
                      </div>
                    </div>
                  </div>
                  {/* Hairline divider */}
                  <div className="mt-6 mb-5 h-px bg-neutral-900/[0.08]" />
                  {/* Supporting stats row — typographic, not boxed */}
                  <div className="grid grid-cols-2 gap-6">
                    {todays.slice(1).map((t) => (
                      <div
                        key={t.label}
                        className="flex items-end justify-between gap-3"
                      >
                        <div>
                          <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-neutral-400 mb-1.5">
                            {t.label}
                          </div>
                          <div className="font-serif text-3xl sm:text-4xl text-neutral-950 leading-none tracking-[-0.03em]">
                            <CountUp value={t.value} delay={0.4} />
                          </div>
                        </div>
                        <DeltaPill delta={t.delta} small />
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* AI USAGE — bars + sparkline (the time dimension) */}
              <div className="mb-7">
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400">
                      AI usage
                    </div>
                    <div className="font-serif text-lg text-neutral-950 tracking-[-0.01em] mt-0.5">
                      Tokens{" "}
                      <span className="text-neutral-400 text-[14px] font-sans">
                        · last 12h
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-400 tabular-nums">
                    peak {Math.max(...aiUsage.map((a) => a.peak))}k
                  </div>
                </div>
                <ul className="space-y-4">
                  {aiUsage.map((a, i) => {
                    const widthPct = (a.current / MAX_AI) * 100;
                    const fill = a.accent ? ENTITY.claude.color : BLUE[300];
                    const track = BLUE[50];
                    return (
                      <motion.li
                        key={a.name}
                        initial={{ opacity: 0, x: -6 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{
                          duration: 0.55,
                          ease,
                          delay: 0.35 + i * 0.06,
                        }}
                        className="group"
                      >
                        {/* Top row: name, peak, sparkline, value */}
                        <div className="flex items-center gap-3 mb-1.5">
                          <span
                            className={
                              "text-[12px] truncate " +
                              (a.accent
                                ? "font-semibold text-neutral-950"
                                : "font-medium text-neutral-600")
                            }
                          >
                            {a.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 tabular-nums">
                            peak {a.peak}k
                          </span>
                          <div className="flex-1" />
                          <Sparkline
                            data={a.spark}
                            color={a.accent ? ENTITY.claude.color : BLUE[400]}
                            id={a.name}
                          />
                          <span className="font-serif text-[15px] tabular-nums text-neutral-950 w-[48px] text-right">
                            {a.current}
                            <span className="text-neutral-400 text-[11px]">
                              k
                            </span>
                          </span>
                        </div>
                        {/* Bottom row: the bar — full width */}
                        <div
                          className="relative h-[6px] rounded-full overflow-hidden"
                          style={{ backgroundColor: track }}
                          aria-hidden="true"
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${widthPct}%` }}
                            viewport={{ once: true }}
                            transition={{
                              duration: 1.1,
                              ease,
                              delay: 0.45 + i * 0.08,
                            }}
                            className="absolute left-0 top-0 h-full rounded-full"
                            style={{
                              background: a.accent
                                ? `linear-gradient(90deg, ${ENTITY.claude.color}, #f59e0b)`
                                : fill,
                            }}
                          />
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>

              {/* TEAM OUTPUT — meters with status badges */}
              <div>
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400">
                      Team output
                    </div>
                    <div className="font-serif text-lg text-neutral-950 tracking-[-0.01em] mt-0.5">
                      This sprint
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-400">4 tracks</div>
                </div>
                <ul className="space-y-3">
                  {teamOutput.map((row, i) => (
                    <motion.li
                      key={row.name}
                      initial={{ opacity: 0, y: 4 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{
                        duration: 0.55,
                        ease,
                        delay: 0.5 + i * 0.05,
                      }}
                      className="group"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-[13px] font-medium text-neutral-800 truncate">
                          {row.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={row.status} />
                          <span className="text-[12px] tabular-nums text-neutral-500 font-medium w-[34px] text-right">
                            {row.pct}
                            <span className="text-neutral-400">%</span>
                          </span>
                        </div>
                      </div>
                      <div
                        className="relative h-[3px] rounded-full overflow-hidden"
                        style={{ backgroundColor: BLUE[50] }}
                        aria-hidden="true"
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${row.pct}%` }}
                          viewport={{ once: true }}
                          transition={{
                            duration: 1.1,
                            ease,
                            delay: 0.55 + i * 0.06,
                          }}
                          className="absolute left-0 top-0 h-full rounded-full"
                          style={{
                            background:
                              row.pct === 100
                                ? BLUE[700]
                                : `linear-gradient(90deg, ${BLUE[300]}, ${BLUE[500]})`,
                          }}
                        />
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom instrument strip — the editorial kicker */}
          <div
            className="relative flex items-center justify-between gap-4 px-5 sm:px-8 py-3 border-t border-neutral-900/10"
            style={{ backgroundColor: "rgba(241,239,233,0.6)" }}
          >
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <span className="size-1 rounded-full bg-emerald-500" />
              <span>The activity of humans and agents</span>
              <span className="text-neutral-300 mx-1">—</span>
              <span>turned into engineering intelligence.</span>
            </div>
            <button
              type="button"
              className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-700 hover:text-neutral-950 transition-colors"
            >
              View full timeline
              <FiArrowUpRight className="size-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ── DELTA PILL ── */
function DeltaPill({
  delta,
  small = false,
}: {
  delta: number;
  small?: boolean;
}) {
  const positive = delta >= 0;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 rounded-full font-medium tabular-nums " +
        (small ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5") +
        " " +
        (positive
          ? "bg-emerald-500/10 text-emerald-700"
          : "bg-rose-500/10 text-rose-700")
      }
    >
      <span>{positive ? "↑" : "↓"}</span>
      <span>{Math.abs(delta)}</span>
    </span>
  );
}

/* ── STATUS BADGE for team output ── */
function StatusBadge({
  status,
}: {
  status: "shipped" | "in-review" | "active";
}) {
  const map = {
    shipped: {
      label: "shipped",
      icon: <FiCheckCircle className="size-3" />,
      color: "text-emerald-700",
      bg: "bg-emerald-500/10",
    },
    "in-review": {
      label: "in review",
      icon: <FiClock className="size-3" />,
      color: "text-amber-700",
      bg: "bg-amber-500/10",
    },
    active: {
      label: "active",
      icon: <FiCpu className="size-3" />,
      color: "text-neutral-700",
      bg: "bg-neutral-900/[0.06]",
    },
  } as const;
  const s = map[status];
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
        s.bg +
        " " +
        s.color
      }
    >
      {s.icon}
      {s.label}
    </span>
  );
}

/* ── LEGEND chip for timeline markers ── */
function Legend({ kind, label }: { kind: EventKind; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block">
        <Marker kind={kind} color="#525252" />
      </span>
      <span>{label}</span>
    </span>
  );
}

export default Activity;
