import { useState } from "react";
import { motion } from "framer-motion";
import { Reveal } from "@/components/motion";
import { FiRadio, FiTerminal } from "react-icons/fi";
import { SiAnthropic, SiGithubcopilot } from "react-icons/si";

type Pod = {
  id: string;
  name: string;
  dev: string;
  avatar: string;
  agent: string;
  agentIcon: typeof SiAnthropic;
  color: string;
  task: string;
  focusTime: string;
  x: string;
  y: string;
};

const pods: Pod[] = [
  {
    id: "pod-1",
    name: "Frontend Studio",
    dev: "Alex Rivera",
    avatar: "AR",
    agent: "Claude 3.7",
    agentIcon: SiAnthropic,
    color: "#38BDF8",
    task: "Synthesizing React 19 Spatial Map UI",
    focusTime: "42m deep focus",
    x: "20%",
    y: "30%",
  },
  {
    id: "pod-2",
    name: "Core Rust Engine",
    dev: "Sarah Chen",
    avatar: "SC",
    agent: "Cursor Agent",
    agentIcon: FiTerminal,
    color: "#818CF8",
    task: "Benchmarking eBPF ring buffer dispatch",
    focusTime: "1h 14m deep focus",
    x: "72%",
    y: "25%",
  },
  {
    id: "pod-3",
    name: "AI Synthesis Lab",
    dev: "Devin Vance",
    avatar: "DV",
    agent: "Codex Daemon",
    agentIcon: SiGithubcopilot,
    color: "#10B981",
    task: "Generating invariant test suites",
    focusTime: "28m focus",
    x: "48%",
    y: "65%",
  },
];

const stats = [
  { value: "Sub-5ms", label: "WebSocket state broadcast" },
  { value: "100%", label: "Real-time presence accuracy" },
  { value: "Zero-Lag", label: "Multi-seat spatial sync" },
];

export function SpatialOfficeSection() {
  const [selectedPod, setSelectedPod] = useState<Pod>(pods[0]!);

  return (
    <section id="office" className="relative py-28 md:py-36 overflow-hidden">
      {/* Radial glow background */}
      <div className="pointer-events-none absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Interactive Spatial 2.5D Canvas */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <Reveal direction="left">
              <div className="relative rounded-3xl border border-white/10 bg-[#0b0e16]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden min-h-[460px] flex flex-col justify-between">
                {/* Background Grid & Beams */}
                <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-cyan-500/10 pointer-events-none animate-pulse" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] rounded-full border border-indigo-500/5 pointer-events-none" />

                {/* Spatial Map Header */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-cyan-400" />
                    </span>
                    <span className="font-mono text-xs font-semibold text-cyan-300">
                      LIVE SPATIAL MESH // OFFICE 01
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                    3 Active Engineering Pods
                  </span>
                </div>

                {/* Interactive Map Nodes Canvas */}
                <div className="relative z-10 my-8 min-h-[260px]">
                  {/* Connection lines */}
                  <svg className="absolute inset-0 size-full pointer-events-none stroke-white/10 stroke-dasharray-4">
                    <line
                      x1="25%"
                      y1="35%"
                      x2="70%"
                      y2="30%"
                      stroke="rgba(56,189,248,0.2)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1="25%"
                      y1="35%"
                      x2="50%"
                      y2="70%"
                      stroke="rgba(129,140,248,0.2)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1="70%"
                      y1="30%"
                      x2="50%"
                      y2="70%"
                      stroke="rgba(16,185,129,0.2)"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  </svg>

                  {/* Render Pod Markers */}
                  {pods.map((pod) => {
                    const isSelected = selectedPod.id === pod.id;
                    const Icon = pod.agentIcon;
                    return (
                      <div
                        key={pod.id}
                        style={{ top: pod.y, left: pod.x }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                        onClick={() => setSelectedPod(pod)}
                      >
                        {/* Pulse Ring */}
                        <div
                          className={`absolute -inset-3 rounded-full transition-all duration-500 ${
                            isSelected
                              ? "bg-cyan-500/20 scale-125 blur-sm"
                              : "group-hover:bg-white/10 scale-100"
                          }`}
                        />

                        {/* Node Avatar Capsule */}
                        <div
                          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono backdrop-blur-md transition-all ${
                            isSelected
                              ? "bg-cyan-950/90 border-cyan-400 text-white shadow-[0_0_20px_rgba(56,189,248,0.5)] scale-105"
                              : "bg-[#0e1320]/80 border-white/10 text-slate-300 group-hover:border-white/30"
                          }`}
                        >
                          <span className="size-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px]">
                            {pod.avatar}
                          </span>
                          <span className="font-sans font-medium text-xs hidden sm:inline">
                            {pod.dev}
                          </span>
                          <Icon className="text-xs text-cyan-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Pod Live Details Drawer */}
                <motion.div
                  key={selectedPod.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative z-10 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-sans">
                        {selectedPod.name}
                      </span>
                      <span className="text-[11px] font-mono text-cyan-400">
                        ({selectedPod.dev})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{selectedPod.task}</p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/20 text-emerald-400">
                      {selectedPod.focusTime}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1">
                      Pairing:{" "}
                      <strong className="text-white">
                        {selectedPod.agent}
                      </strong>
                    </span>
                  </div>
                </motion.div>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Copy & Value Proposition */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <Reveal direction="right">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 mb-4">
                <FiRadio className="animate-pulse" /> Spatial Team Map
              </span>
              <h2 className="font-sans font-extrabold text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.1] tracking-[-0.03em] text-white">
                Your engineering lab,{" "}
                <span className="text-gradient-violet">alive in real-time</span>
                .
              </h2>
              <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed">
                Powered by native Bun WebSockets. Hive renders live spatial
                snapshots of your team&apos;s AI coding sessions, focus flow,
                and agent pairings across every repository.
              </p>
            </Reveal>

            {/* Stats Ticker */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-white/[0.08]">
              {stats.map((st) => (
                <div key={st.label}>
                  <div className="font-sans font-extrabold text-2xl text-white tracking-tight">
                    {st.value}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 leading-tight">
                    {st.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
