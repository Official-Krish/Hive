import { useState } from "react";
import { motion } from "framer-motion";
import { Reveal } from "@/components/motion";
import {
  FiCheckCircle,
  FiCopy,
  FiCheck,
  FiHardDrive,
  FiCpu,
  FiActivity,
} from "react-icons/fi";
import { SiRust } from "react-icons/si";

type CommandTab = "start" | "status" | "live" | "doctor";

const commandOutputs: Record<
  CommandTab,
  { cmd: string; lines: Array<{ text: string; color?: string }> }
> = {
  start: {
    cmd: "hive start --daemon",
    lines: [
      {
        text: "[hive::init] Hive Collector v2.0.4 (x86_64-apple-darwin)",
        color: "text-cyan-400 font-bold",
      },
      {
        text: "[hive::hook] Attached to Claude Code session daemon (pid: 49201)",
        color: "text-slate-300",
      },
      {
        text: "[hive::hook] Attached to Cursor IDE LSP telemetry pipe",
        color: "text-slate-300",
      },
      {
        text: "[hive::git] Discovered workspace root: /Users/dev/engine-mesh",
        color: "text-slate-400",
      },
      {
        text: "[hive::net] Connected to Redis stream gateway wss://ingest.hive.dev (1.4ms)",
        color: "text-emerald-400",
      },
      {
        text: "✔ Collector running in background (PID: 49210) · Memory: 8.9MB",
        color: "text-emerald-400 font-semibold",
      },
    ],
  },
  status: {
    cmd: "hive status",
    lines: [
      {
        text: "● Hive Collector: RUNNING (Uptime: 4d 18h 22m)",
        color: "text-emerald-400 font-bold",
      },
      {
        text: "  ├─ Watched Agents: [Claude Code (active), Cursor (idle), Codex (active)]",
        color: "text-slate-300",
      },
      {
        text: "  ├─ Events Buffered: 0 (Flushed 248,190 events)",
        color: "text-slate-300",
      },
      {
        text: "  ├─ Privacy Engine: ZERO-RETENTION (All keys & tokens stripped)",
        color: "text-cyan-300",
      },
      {
        text: "  └─ Gateway Health: 100% ACK (Avg latency: 2.1ms)",
        color: "text-emerald-400",
      },
    ],
  },
  live: {
    cmd: "hive live --filter=agent.diff",
    lines: [
      {
        text: "[12:44:02.102] CLAUDE-3.7 >> Modified src/protocol.rs (+42 -3)",
        color: "text-amber-400",
      },
      {
        text: "[12:44:02.115] AST_PARSER >> Validated syntax tree (0 syntax errors)",
        color: "text-purple-400",
      },
      {
        text: "[12:44:02.128] TEST_GATE  >> Triggered cargo test --lib (32 tests passed)",
        color: "text-emerald-400",
      },
      {
        text: "[12:44:02.140] GIT_SYNC   >> Created staging branch feat/rust-ast",
        color: "text-cyan-400",
      },
    ],
  },
  doctor: {
    cmd: "hive doctor",
    lines: [
      {
        text: "✔ Rust eBPF engine: OK (Native Mach kernel hooks active)",
        color: "text-emerald-400",
      },
      {
        text: "✔ Git hook integration: OK (.git/hooks/post-commit wired)",
        color: "text-emerald-400",
      },
      {
        text: "✔ IDE integration: OK (Cursor & VS Code sockets linked)",
        color: "text-emerald-400",
      },
      {
        text: "✔ TLS 1.3 / AES-256 Tunnel: OK (Zero leaks detected)",
        color: "text-emerald-400",
      },
      {
        text: "All diagnostic checks passed. System running at optimal efficiency.",
        color: "text-slate-300 font-semibold",
      },
    ],
  },
};

export function CollectorSection() {
  const [activeTab, setActiveTab] = useState<CommandTab>("start");
  const [copied, setCopied] = useState(false);

  const activeData = commandOutputs[activeTab];

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(activeData.cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="collector" className="relative py-28 md:py-36 overflow-hidden">
      {/* Background cyber accent */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-600/5 blur-[160px] rounded-full -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Description & Benchmarks */}
          <div className="lg:col-span-5">
            <Reveal direction="left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 mb-4">
                <SiRust className="text-orange-400" /> Rust Native Collector
              </span>
              <h2 className="font-sans font-extrabold text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.1] tracking-[-0.03em] text-white">
                Ultra-lightweight. Zero overhead on your CPU.
              </h2>
              <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed">
                Written from the ground up in Rust. The Hive daemon operates
                quietly in the background without heavy Node.js or Electron
                runtimes, consuming almost invisible system resources.
              </p>

              {/* Benchmarks Grid */}
              <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.08]">
                <div className="p-3.5 rounded-2xl bg-[#0e121c] border border-white/[0.08]">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <FiHardDrive className="text-cyan-400" /> RAM
                  </div>
                  <div className="text-lg sm:text-xl font-mono font-bold text-white">
                    &lt;9.2 MB
                  </div>
                  <span className="text-[10px] text-emerald-400">
                    vs 380MB Node
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#0e121c] border border-white/[0.08]">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <FiCpu className="text-violet-400" /> CPU
                  </div>
                  <div className="text-lg sm:text-xl font-mono font-bold text-white">
                    0.08%
                  </div>
                  <span className="text-[10px] text-emerald-400">
                    Non-blocking
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#0e121c] border border-white/[0.08]">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <FiActivity className="text-emerald-400" /> Binary
                  </div>
                  <div className="text-lg sm:text-xl font-mono font-bold text-white">
                    4.1 MB
                  </div>
                  <span className="text-[10px] text-emerald-400">
                    Self-contained
                  </span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Interactive CLI Terminal Playground */}
          <div className="lg:col-span-7">
            <Reveal direction="right" delay={0.15}>
              <div className="relative rounded-3xl border border-white/10 bg-[#0a0d14]/95 p-1 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Top Tabs */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-red-500/70" />
                    <span className="size-3 rounded-full bg-yellow-500/70" />
                    <span className="size-3 rounded-full bg-emerald-500/70" />
                    <span className="font-mono text-xs text-slate-400 ml-2 hidden sm:inline">
                      ~/workspace/hive-cli
                    </span>
                  </div>

                  {/* Interactive Tab Selectors */}
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                    {(
                      ["start", "status", "live", "doctor"] as CommandTab[]
                    ).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                          activeTab === tab
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Command Prompt Line */}
                <div className="p-4 sm:p-6 bg-[#06080e] font-mono text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-4">
                    <div className="flex items-center gap-2 text-slate-200 truncate">
                      <span className="text-cyan-400 font-bold">$</span>
                      <span className="text-cyan-200">{activeData.cmd}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCommand}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-all ml-2"
                      title="Copy command"
                    >
                      {copied ? (
                        <FiCheck className="text-emerald-400" />
                      ) : (
                        <FiCopy />
                      )}
                    </button>
                  </div>

                  {/* Terminal Output Stream */}
                  <div className="space-y-2 py-2 min-h-[180px]">
                    {activeData.lines.map((line, idx) => (
                      <motion.div
                        key={`${activeTab}-${idx}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.3 }}
                        className={`leading-relaxed ${line.color ?? "text-slate-400"}`}
                      >
                        {line.text}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Terminal Status Footer */}
                <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <FiCheckCircle /> Daemon v2.0 Ready
                  </span>
                  <span>macOS / Linux / WSL2</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
