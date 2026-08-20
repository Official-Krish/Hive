import { Reveal } from "@/components/motion";
import {
  FiActivity,
  FiCpu,
  FiGitPullRequest,
  FiZap,
  FiDatabase,
} from "react-icons/fi";
import { SiAnthropic } from "react-icons/si";

export function FeaturesSection() {
  return (
    <section id="platform" className="relative py-28 md:py-36 overflow-hidden">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-cyan-600/5 blur-[160px] rounded-full -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/20">
              <FiZap /> Platform Intelligence
            </span>
            <h2 className="font-sans font-extrabold text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.08] tracking-[-0.03em] text-white mt-4 text-balance">
              Engineered for teams who ship with{" "}
              <span className="text-gradient-cyan">autonomous agents</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed">
              Hive replaces fragmented dev logs and blind spots with a unified
              telemetry architecture that captures the full picture of modern
              AI-assisted engineering.
            </p>
          </div>
        </Reveal>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bento Card 1: Telemetry Pipeline (Span 2) */}
          <div className="md:col-span-2 relative group rounded-3xl border border-white/10 bg-[#0e121c]/80 p-8 sm:p-10 backdrop-blur-xl transition-all duration-500 hover:border-cyan-500/40 hover:shadow-[0_0_40px_rgba(56,189,248,0.15)] overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-all" />

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400">
                  <FiActivity className="text-2xl" />
                </div>
                <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/20 px-3 py-1 rounded-full">
                  Idempotent Ingest
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white tracking-tight">
                Sub-Millisecond Telemetry Ingest
              </h3>
              <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
                Batched event streaming captures prompt completions, AST
                mutations, terminal executions, and test runs directly from
                developer machines without degrading IDE performance.
              </p>

              {/* Live Metric Simulator */}
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-white/[0.08]">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[11px] font-mono text-slate-400 block">
                    Peak Ingest
                  </span>
                  <span className="text-xl font-mono font-bold text-white">
                    4,820/s
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[11px] font-mono text-slate-400 block">
                    ACK Latency
                  </span>
                  <span className="text-xl font-mono font-bold text-cyan-400">
                    &lt;2.1ms
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] col-span-2 sm:col-span-1">
                  <span className="text-[11px] font-mono text-slate-400 block">
                    Buffer Drop Rate
                  </span>
                  <span className="text-xl font-mono font-bold text-emerald-400">
                    0.00%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Model & Token Velocity (Span 1) */}
          <div className="relative group rounded-3xl border border-white/10 bg-[#0e121c]/80 p-8 backdrop-blur-xl transition-all duration-500 hover:border-violet-500/40 hover:shadow-[0_0_40px_rgba(129,140,248,0.15)] overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-60 h-60 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-violet-950/50 border border-violet-500/30 text-violet-400">
                  <FiCpu className="text-2xl" />
                </div>
                <span className="text-xs font-mono text-violet-300 bg-violet-950/60 border border-violet-500/20 px-3 py-1 rounded-full">
                  Synthesis Velocity
                </span>
              </div>

              <h3 className="text-xl font-bold text-white tracking-tight">
                Model Efficiency & Token Spend
              </h3>
              <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                Break down token generation rates, model distributions, and
                retry loops across Claude, Cursor, and Codex.
              </p>
            </div>

            {/* Model Progress Bars */}
            <div className="mt-6 space-y-3 pt-6 border-t border-white/[0.08]">
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <SiAnthropic className="text-amber-400" /> Claude 3.7
                  </span>
                  <span className="text-cyan-300">58%</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 rounded-full"
                    style={{ width: "58%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <FiZap className="text-cyan-400" /> Cursor Agent
                  </span>
                  <span className="text-cyan-300">28%</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-full"
                    style={{ width: "28%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bento Card 3: Autonomous Git Graph (Span 1) */}
          <div className="relative group rounded-3xl border border-white/10 bg-[#0e121c]/80 p-8 backdrop-blur-xl transition-all duration-500 hover:border-emerald-500/40 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] overflow-hidden">
            <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 w-fit mb-6">
              <FiGitPullRequest className="text-2xl" />
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight">
              Auto-Correlated Git & PRs
            </h3>
            <p className="mt-3 text-slate-400 text-sm leading-relaxed">
              Connect agent sessions directly to GitHub PRs, commit diffs, and
              CI test pass gates with automated provenance.
            </p>

            <div className="mt-6 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] font-mono text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>PR #142 · Refactor</span>
                <span className="text-emerald-400">99.4% Pass</span>
              </div>
              <div className="text-cyan-300 text-xs truncate">
                branch: feat/spatial-ws-pipeline
              </div>
            </div>
          </div>

          {/* Bento Card 4: Background Intelligence Engine (Span 2) */}
          <div className="md:col-span-2 relative group rounded-3xl border border-white/10 bg-[#0e121c]/80 p-8 sm:p-10 backdrop-blur-xl transition-all duration-500 hover:border-cyan-500/40 hover:shadow-[0_0_40px_rgba(56,189,248,0.15)] overflow-hidden">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 text-indigo-400">
                <FiDatabase className="text-2xl" />
              </div>
              <span className="text-xs font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-500/20 px-3 py-1 rounded-full">
                Redis Stream Workers
              </span>
            </div>

            <h3 className="text-2xl font-bold text-white tracking-tight">
              Background Intelligence Engine
            </h3>
            <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
              High-throughput asynchronous workers aggregate focus metrics,
              finalize sessions, detect deadlocks, and calculate velocity scores
              in real time without bottlenecking ingest.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-300 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-400" />{" "}
                Session Finalizer Daemon
              </span>
              <span className="px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-300 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-cyan-400" /> Focus
                Sweeper
              </span>
              <span className="px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-300 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-violet-400" /> Spatial
                Presence Mesh
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
