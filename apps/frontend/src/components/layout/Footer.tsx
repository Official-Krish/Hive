import { useState } from "react";
import { HiveLogo } from "@/components/icons";
import { Reveal } from "@/components/motion";
import {
  FiArrowRight,
  FiCheck,
  FiGithub,
  FiTwitter,
  FiLinkedin,
} from "react-icons/fi";
import { SiDiscord } from "react-icons/si";

const footerSections = {
  Platform: [
    { label: "Telemetry Pipeline", href: "#platform" },
    { label: "Rust Edge Daemon", href: "#collector" },
    { label: "Spatial 2.5D Office", href: "#office" },
    { label: "Zero-Knowledge Shield", href: "#privacy" },
    { label: "Architecture Contrast", href: "#architecture" },
  ],
  Integrations: [
    { label: "Claude Code", href: "#" },
    { label: "Cursor IDE", href: "#" },
    { label: "Codex & Copilot", href: "#" },
    { label: "GitHub Webhooks", href: "#" },
    { label: "eBPF Kernel Hooks", href: "#" },
  ],
  Resources: [
    { label: "Documentation", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "Rust Crate (crates.io)", href: "#" },
    { label: "Changelog v2.0", href: "#" },
    { label: "System Status", href: "#" },
  ],
  Company: [
    { label: "About Hive", href: "#" },
    { label: "Security & Trust", href: "#" },
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Contact Engineering", href: "#" },
  ],
};

export function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmail("");
      setSubscribed(false);
    }, 3000);
  };

  return (
    <footer className="relative border-t border-white/[0.08] bg-[#06080d] pt-20 pb-12 overflow-hidden text-slate-400">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-cyan-900/10 blur-[180px] -z-10 rounded-full" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 pb-16 border-b border-white/[0.08]">
            {/* Left Brand Column */}
            <div className="lg:col-span-4 space-y-6">
              <a href="#" className="flex items-center gap-3 text-white group">
                <HiveLogo
                  className="transition-transform group-hover:rotate-12"
                  size={28}
                />
                <span className="font-sans font-bold text-xl tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                  Hive
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                  v2.0
                </span>
              </a>

              <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                Engineering intelligence for the autonomous coding era. Turn AI
                agent telemetry, git streams, and test cycles into real-time
                team clarity and a living spatial office.
              </p>

              {/* System Health Beacon */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-xs font-mono text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <span>All Ingest Clusters Operational</span>
              </div>

              {/* Newsletter / Changelog Signup */}
              <form onSubmit={handleSubscribe} className="pt-2">
                <span className="text-xs font-mono text-slate-300 block mb-2">
                  Subscribe to telemetry updates:
                </span>
                <div className="flex items-center gap-2 max-w-sm">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="eng-lead@company.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold font-sans transition-colors shrink-0 flex items-center gap-1"
                  >
                    {subscribed ? <FiCheck /> : <FiArrowRight />}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Link Columns */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
              {Object.entries(footerSections).map(([title, links]) => (
                <div key={title} className="space-y-4">
                  <h4 className="font-mono text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    {title}
                  </h4>
                  <ul className="space-y-2.5">
                    {links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-xs text-slate-400 hover:text-cyan-300 transition-colors"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Bottom Bar: Copyright & Socials */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div>
            © {new Date().getFullYear()} Hive Technologies Inc. All rights
            reserved.
          </div>

          <div className="flex items-center gap-5 text-slate-400">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-300 transition-colors"
              title="GitHub"
            >
              <FiGithub size={16} />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-300 transition-colors"
              title="Twitter"
            >
              <FiTwitter size={16} />
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-300 transition-colors"
              title="Discord"
            >
              <SiDiscord size={16} />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-cyan-300 transition-colors"
              title="LinkedIn"
            >
              <FiLinkedin size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
