import { Reveal } from "@/components/motion";
import { FiXCircle, FiCheckCircle, FiLayers } from "react-icons/fi";

export function ComparisonSection() {
  return (
    <section
      id="architecture"
      className="relative py-28 md:py-36 overflow-hidden border-t border-white/[0.06]"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-cyan-600/5 blur-[180px] rounded-full -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 mb-4">
              <FiLayers /> Architectural Contrast
            </span>
            <h2 className="font-sans font-extrabold text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.08] tracking-[-0.03em] text-white">
              Why traditional logging{" "}
              <span className="text-gradient-cyan">fails with AI agents</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed">
              Standard APMs and terminal history were built for humans typing
              line by line. AI coding agents generate thousands of lines and
              mutate ASTs asynchronously.
            </p>
          </div>
        </Reveal>

        {/* 2-Column Comparison Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Traditional Fragmented Approach */}
          <div className="rounded-3xl border border-red-500/20 bg-[#120a0f]/60 p-8 sm:p-10 backdrop-blur-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/30 text-red-400">
                <FiXCircle className="text-2xl" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-lg text-white">
                  Traditional Dev Environment
                </h3>
                <span className="text-xs font-mono text-red-400">
                  The Engineering Blind Spot
                </span>
              </div>
            </div>

            <ul className="space-y-4 font-sans text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <FiXCircle className="text-red-400 mt-0.5 shrink-0 text-base" />
                <span>
                  Zero visibility into prompt iterations, retry loops, or model
                  token spend across team seats.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <FiXCircle className="text-red-400 mt-0.5 shrink-0 text-base" />
                <span>
                  Massive AI pull requests landed with unknown testing
                  provenance and hallucination risks.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <FiXCircle className="text-red-400 mt-0.5 shrink-0 text-base" />
                <span>
                  Engineers working in silos with zero real-time awareness of
                  overlapping refactors.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <FiXCircle className="text-red-400 mt-0.5 shrink-0 text-base" />
                <span>
                  Sensitive API keys and proprietary IP leaked in unmonitored
                  agent prompt contexts.
                </span>
              </li>
            </ul>
          </div>

          {/* Right: The Hive Telemetry Mesh */}
          <div className="rounded-3xl border border-cyan-500/30 bg-[#08121f]/70 p-8 sm:p-10 backdrop-blur-xl relative overflow-hidden shadow-[0_0_40px_rgba(56,189,248,0.1)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                <FiCheckCircle className="text-2xl" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-lg text-white">
                  With Hive Telemetry Mesh
                </h3>
                <span className="text-xs font-mono text-cyan-300">
                  Total Engineering Clarity
                </span>
              </div>
            </div>

            <ul className="space-y-4 font-sans text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <FiCheckCircle className="text-cyan-400 mt-0.5 shrink-0 text-base" />
                <span>
                  Sub-millisecond normalized event streaming across Claude Code,
                  Cursor, Codex, and OpenCode.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <FiCheckCircle className="text-cyan-400 mt-0.5 shrink-0 text-base" />
                <span>
                  Automated AST diff analysis, invariant test verification, and
                  PR correlation.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <FiCheckCircle className="text-cyan-400 mt-0.5 shrink-0 text-base" />
                <span>
                  Living 2.5D spatial office map showing active seats, focus
                  flows, and agent pairings live.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <FiCheckCircle className="text-cyan-400 mt-0.5 shrink-0 text-base" />
                <span>
                  Kernel-level zero-retention token redaction before any
                  telemetry leaves the developer machine.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
