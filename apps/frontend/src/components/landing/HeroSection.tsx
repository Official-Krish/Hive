import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiTerminal,
  FiActivity,
  FiCheckCircle,
  FiCopy,
  FiCheck,
  FiCpu,
  FiGitCommit,
  FiArrowRight,
  FiLayers,
} from "react-icons/fi";
import { SiRust, SiAnthropic, SiGithub, SiGithubcopilot } from "react-icons/si";

const agentsList = [
  {
    name: "Claude Code",
    icon: SiAnthropic,
    color: "#D97706",
    tokens: "184 tok/s",
    task: "Refactoring AST parser in Rust",
  },
  {
    name: "Cursor Agent",
    icon: FiTerminal,
    color: "#38BDF8",
    tokens: "142 tok/s",
    task: "Implementing WebSocket telemetry sync",
  },
  {
    name: "Codex Daemon",
    icon: SiGithubcopilot,
    color: "#10B981",
    tokens: "96 tok/s",
    task: "Auto-generating unit test suites",
  },
];

const liveEvents = [
  {
    id: 1,
    type: "agent.session.spawn",
    agent: "Claude Code",
    time: "10ms ago",
    status: "ACK 200",
    latency: "2.4ms",
    color: "text-amber-400",
  },
  {
    id: 2,
    type: "ast.diff.analyzed",
    agent: "Cursor Agent",
    time: "18ms ago",
    status: "+148 -12",
    latency: "1.8ms",
    color: "text-cyan-400",
  },
  {
    id: 3,
    type: "git.commit.synthesized",
    agent: "Claude Code",
    time: "34ms ago",
    status: "b84f9a1",
    latency: "4.1ms",
    color: "text-purple-400",
  },
  {
    id: 4,
    type: "test.suite.passed",
    agent: "Codex Daemon",
    time: "52ms ago",
    status: "48/48 PASS",
    latency: "3.2ms",
    color: "text-emerald-400",
  },
  {
    id: 5,
    type: "spatial.presence.sync",
    agent: "Core Engine",
    time: "70ms ago",
    status: "3 Nodes Active",
    latency: "0.9ms",
    color: "text-sky-400",
  },
];

const sampleCodeDiff = `// apps/collector/src/telemetry.rs
pub async fn ingest_agent_session(
    event: &AgentEventPayload,
    privacy_gateway: &PrivacyGatingEngine
) -> Result<NormalizedTelemetryEnvelope, TelemetryError> {
    let sanitized_event = privacy_gateway.strip_sensitive_tokens(event)?;
    let envelope = NormalizedTelemetryEnvelope::from_raw(sanitized_event);
    
    // Sub-millisecond Redis stream dispatch
    DISPATCHER.dispatch_idempotent(&envelope).await?;
    Ok(envelope)
}`;

export function HeroSection() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"stream" | "diff" | "topology">(
    "stream",
  );
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveAgentIndex((prev) => (prev + 1) % agentsList.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText("curl -fsSL https://get.hive.dev | sh");
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const currentAgent = agentsList[activeAgentIndex] ?? agentsList[0]!;

  return (
    <section className="relative min-h-screen pt-28 md:pt-36 pb-20 overflow-hidden">
      {/* Dynamic Cyber Background Elements */}
      <div className="pointer-events-none absolute inset-0">
        {/* Glowing Top Center Orb */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-cyan-500/15 via-indigo-600/10 to-transparent blur-[120px] -z-10 rounded-full" />

        {/* Violet Right Flare */}
        <div className="absolute top-40 -right-40 w-[600px] h-[600px] bg-violet-600/10 blur-[140px] -z-10 rounded-full" />

        {/* Cyber Grid Lines */}
        <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
        {/* Release Pill */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-950/40 text-cyan-300 text-xs font-mono font-medium backdrop-blur-md shadow-[0_0_20px_rgba(56,189,248,0.15)] mb-8"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-cyan-400" />
          </span>
          <span>Hive 2.0 Engine & Spatial Office</span>
          <span className="text-white/20">|</span>
          <span className="text-slate-400 font-sans hidden sm:inline">
            Rust Edge Ingest Active
          </span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans font-extrabold text-[clamp(2.5rem,6.5vw,5.5rem)] leading-[1.04] tracking-[-0.035em] text-white max-w-4xl text-balance"
        >
          Turn AI coding chaos into{" "}
          <span className="text-gradient-cyan block sm:inline">
            real-time team clarity.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 max-w-2xl text-base sm:text-lg md:text-xl text-slate-300 font-normal leading-relaxed text-balance"
        >
          Hive quietly observes your engineering agents (Claude Code, Cursor,
          Codex, OpenCode), git streams, and tests — delivering sub-millisecond
          telemetry to living dashboards and a 2.5D spatial office.
        </motion.p>

        {/* Interactive CTA Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <Link
            to="/auth"
            className="w-full sm:w-auto group relative flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 px-8 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(56,189,248,0.4)] hover:shadow-[0_0_40px_rgba(56,189,248,0.6)] transition-all hover:scale-[1.02]"
          >
            <span>Deploy Free Ingest</span>
            <FiArrowRight className="text-base transition-transform group-hover:translate-x-1" />
          </Link>

          {/* Quick CLI Copy Box */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/80 border border-white/10 text-xs font-mono text-slate-300 backdrop-blur-md hover:border-cyan-500/40 transition-colors w-full sm:w-auto justify-between">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">$</span>
              <span className="text-slate-300">
                curl -fsSL https://get.hive.dev | sh
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="ml-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-all"
              title="Copy install command"
            >
              {copied ? <FiCheck className="text-emerald-400" /> : <FiCopy />}
            </button>
          </div>
        </motion.div>

        {/* Supported / Watched Frameworks & Agents */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-400"
        >
          <span className="font-mono uppercase tracking-wider text-slate-400/80">
            Native Support:
          </span>
          <div className="flex flex-wrap items-center gap-5 sm:gap-7">
            <span className="flex items-center gap-1.5 text-slate-300 font-medium hover:text-white transition-colors">
              <SiAnthropic className="text-amber-400" /> Claude Code
            </span>
            <span className="flex items-center gap-1.5 text-slate-300 font-medium hover:text-white transition-colors">
              <FiTerminal className="text-cyan-400" /> Cursor IDE
            </span>
            <span className="flex items-center gap-1.5 text-slate-300 font-medium hover:text-white transition-colors">
              <SiGithubcopilot className="text-emerald-400" /> Codex & Copilot
            </span>
            <span className="flex items-center gap-1.5 text-slate-300 font-medium hover:text-white transition-colors">
              <SiRust className="text-orange-400" /> Rust Daemon
            </span>
            <span className="flex items-center gap-1.5 text-slate-300 font-medium hover:text-white transition-colors">
              <SiGithub className="text-slate-200" /> GitHub Webhooks
            </span>
          </div>
        </motion.div>

        {/* Interactive Hero Console Stage */}
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-14 w-full max-w-5xl relative"
        >
          {/* Ambient Glow behind console */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 blur-xl opacity-75" />

          {/* Main Glass Console Card */}
          <div className="relative rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0f18]/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden text-left">
            {/* Window Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="ml-3 font-mono text-xs text-slate-400 hidden sm:inline">
                  hive-mesh-daemon // live-cluster-preview
                </span>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab("stream")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                    activeTab === "stream"
                      ? "bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FiActivity className="text-xs" />
                  <span>Live Stream</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("diff")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                    activeTab === "diff"
                      ? "bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FiGitCommit className="text-xs" />
                  <span>AST Code Diff</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("topology")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                    activeTab === "topology"
                      ? "bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FiLayers className="text-xs" />
                  <span>Mesh Architecture</span>
                </button>
              </div>
            </div>

            {/* Active Agent Live Banner */}
            <div className="px-4 py-2.5 sm:px-6 bg-cyan-950/30 border-b border-cyan-500/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-cyan-400" />
                  </span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {currentAgent.name}
                  </span>
                </div>
                <span className="text-slate-400 hidden md:inline">
                  → {currentAgent.task}
                </span>
              </div>
              <div className="flex items-center gap-4 font-mono text-[11px] text-slate-400">
                <span className="text-emerald-400 flex items-center gap-1">
                  <FiCpu /> {currentAgent.tokens}
                </span>
                <span>Latency: 1.2ms</span>
                <span className="hidden sm:inline text-cyan-300/80">
                  Encrypted AES-256
                </span>
              </div>
            </div>

            {/* Content Body Based on Tab */}
            <div className="p-4 sm:p-6 min-h-[300px]">
              {activeTab === "stream" && (
                <div className="space-y-3 font-mono text-xs">
                  {liveEvents.map((evt) => (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-wrap items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="size-2 rounded-full bg-cyan-400" />
                        <span className={`font-semibold ${evt.color}`}>
                          {evt.type}
                        </span>
                        <span className="text-slate-400 hidden sm:inline">
                          [{evt.agent}]
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 text-[11px]">
                          {evt.status}
                        </span>
                        <span className="text-emerald-400 text-[11px]">
                          {evt.latency}
                        </span>
                        <span className="text-slate-500 text-[11px] hidden md:inline">
                          {evt.time}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {activeTab === "diff" && (
                <div className="rounded-xl bg-[#080a10] border border-white/5 p-4 overflow-x-auto">
                  <pre className="font-mono text-xs text-slate-300 leading-relaxed">
                    <code>{sampleCodeDiff}</code>
                  </pre>
                </div>
              )}

              {activeTab === "topology" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-center flex flex-col items-center justify-center gap-2">
                    <SiRust className="text-3xl text-orange-400" />
                    <span className="font-sans font-bold text-sm text-white">
                      1. Edge Rust Daemon
                    </span>
                    <span className="text-xs text-slate-400">
                      Local eBPF & file hook collector
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400">
                      &lt;12MB RAM usage
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-center flex flex-col items-center justify-center gap-2">
                    <FiLayers className="text-3xl text-cyan-400" />
                    <span className="font-sans font-bold text-sm text-white">
                      2. Privacy Normalizer
                    </span>
                    <span className="text-xs text-slate-400">
                      Secret redaction & AST analysis
                    </span>
                    <span className="text-[11px] font-mono text-cyan-300">
                      0 Retention Gateway
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-center flex flex-col items-center justify-center gap-2">
                    <FiActivity className="text-3xl text-indigo-400" />
                    <span className="font-sans font-bold text-sm text-white">
                      3. Spatial Office & WS
                    </span>
                    <span className="text-xs text-slate-400">
                      Real-time team presence & graph
                    </span>
                    <span className="text-[11px] font-mono text-indigo-300">
                      Sub-5ms Sync
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Console Footer */}
            <div className="px-4 py-3 sm:px-6 bg-white/[0.01] border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="text-emerald-400" />
                <span>Zero telemetry dropped · 100% Idempotent ingest</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-cyan-400">Redis Stream v7.2</span>
                <span>·</span>
                <span className="text-slate-300">Bun WebSocket Gateway</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
