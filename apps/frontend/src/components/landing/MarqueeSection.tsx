import { Marquee } from "@/components/motion";
import {
  FiRadio,
  FiCode,
  FiGitBranch,
  FiCpu,
  FiShield,
  FiTerminal,
} from "react-icons/fi";

const events = [
  {
    label: "agent.session.stream",
    icon: FiRadio,
    color: "text-cyan-400",
    bg: "bg-cyan-950/40 border-cyan-500/20",
  },
  {
    label: "ast.diff.mutation",
    icon: FiCode,
    color: "text-purple-400",
    bg: "bg-purple-950/40 border-purple-500/20",
  },
  {
    label: "git.commit.synced",
    icon: FiGitBranch,
    color: "text-blue-400",
    bg: "bg-blue-950/40 border-blue-500/20",
  },
  {
    label: "ebpf.socket.hook",
    icon: FiCpu,
    color: "text-emerald-400",
    bg: "bg-emerald-950/40 border-emerald-500/20",
  },
  {
    label: "zero.retention.gated",
    icon: FiShield,
    color: "text-amber-400",
    bg: "bg-amber-950/40 border-amber-500/20",
  },
  {
    label: "terminal.command.ack",
    icon: FiTerminal,
    color: "text-sky-400",
    bg: "bg-sky-950/40 border-sky-500/20",
  },
];

export function MarqueeSection() {
  return (
    <section className="relative border-y border-white/[0.06] bg-[#07080c]/60 py-4 backdrop-blur-md overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#08090D] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#08090D] to-transparent z-10" />

      <Marquee speed={28}>
        <div className="flex items-center gap-6 pr-6">
          {events.map((event, idx) => {
            const Icon = event.icon;
            return (
              <div
                key={`${event.label}-${idx}`}
                className={`flex items-center gap-2.5 px-4 py-1.5 rounded-full border ${event.bg} font-mono text-xs text-slate-300 backdrop-blur-sm whitespace-nowrap shadow-sm`}
              >
                <Icon className={`text-xs ${event.color}`} />
                <span>{event.label}</span>
                <span className="size-1 rounded-full bg-white/20 ml-1" />
                <span className="text-[10px] text-slate-500">&lt;1ms</span>
              </div>
            );
          })}
        </div>
      </Marquee>
    </section>
  );
}
