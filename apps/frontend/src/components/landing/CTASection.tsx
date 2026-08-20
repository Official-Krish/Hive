import { useState } from "react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/motion";
import {
  FiArrowRight,
  FiCheck,
  FiCopy,
  FiTerminal,
  FiShield,
  FiZap,
} from "react-icons/fi";

export function CTASection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("curl -fsSL https://get.hive.dev | sh");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative overflow-hidden py-28 md:py-36">
      {/* Background Cyber Glow Vortex */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-cyan-500/15 via-indigo-500/15 to-purple-500/15 blur-[180px] rounded-full -z-10" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] sm:rounded-[3rem] border border-cyan-500/30 bg-gradient-to-b from-[#0e1322] via-[#090c14] to-[#07090f] px-8 py-16 text-white md:px-16 md:py-24 shadow-[0_20px_80px_rgba(0,0,0,0.9)]">
            {/* Cyber Grid Texture inside card */}
            <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

            <div className="relative z-10 max-w-3xl">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 mb-6">
                <FiZap /> Get Started in Under 2 Minutes
              </span>

              <h2 className="font-sans font-extrabold text-[clamp(2.25rem,5.5vw,4rem)] leading-[1.06] tracking-[-0.03em] text-white text-balance">
                Ready to see your team&apos;s AI coding in{" "}
                <span className="text-gradient-cyan">high definition</span>?
              </h2>

              <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                Install the lightweight Rust collector on developer machines,
                connect your workspace, and watch real-time telemetry and
                spatial presence illuminate within minutes.
              </p>

              {/* Action Buttons & Terminal Snippet */}
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  to="/auth"
                  className="w-full sm:w-auto group relative flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 px-8 py-4 text-sm font-semibold text-slate-950 shadow-[0_0_35px_rgba(56,189,248,0.4)] hover:shadow-[0_0_50px_rgba(56,189,248,0.7)] transition-all hover:scale-[1.02]"
                >
                  <span>Create Free Workspace</span>
                  <FiArrowRight className="text-base transition-transform group-hover:translate-x-1" />
                </Link>

                <div className="flex items-center gap-2 px-4 py-3 rounded-full bg-black/60 border border-white/15 text-xs font-mono text-slate-300 backdrop-blur-md w-full sm:w-auto justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">$</span>
                    <span>curl -fsSL https://get.hive.dev | sh</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="ml-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
                    title="Copy command"
                  >
                    {copied ? (
                      <FiCheck className="text-emerald-400" />
                    ) : (
                      <FiCopy />
                    )}
                  </button>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 flex flex-wrap items-center gap-6 text-xs font-mono text-slate-400 pt-8 border-t border-white/10">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <FiShield className="text-emerald-400" /> SOC2 Type II Ready
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <FiShield className="text-cyan-400" /> Zero Prompt Retention
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <FiTerminal className="text-indigo-400" /> Open Source Rust
                  Collector
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
