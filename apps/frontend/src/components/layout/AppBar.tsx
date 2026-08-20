import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { HiveLogo } from "@/components/icons";
import { cn } from "@/lib/utils";
import { FiArrowUpRight, FiRadio, FiMenu, FiX } from "react-icons/fi";

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Collector", href: "#collector" },
  { label: "Spatial Lab", href: "#office" },
  { label: "Architecture", href: "#architecture" },
  { label: "Privacy", href: "#privacy" },
];

export function AppBar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20);
  });

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:pt-6 transition-all duration-300 pointer-events-none"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center justify-between w-full max-w-6xl px-4 py-2.5 md:px-6 md:py-3 rounded-full transition-all duration-500",
          scrolled
            ? "bg-[#0c0f17]/85 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] shadow-cyan-950/20"
            : "bg-[#0f131d]/60 backdrop-blur-md border border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.3)]",
        )}
      >
        {/* Brand */}
        <a href="#" className="group flex items-center gap-3 text-white">
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-1 rounded-full bg-cyan-500/20 blur-sm group-hover:bg-cyan-500/40 transition-all" />
            <HiveLogo
              className="relative transition-transform duration-500 group-hover:rotate-12 group-hover:scale-105"
              size={26}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-lg tracking-tight text-white group-hover:text-cyan-300 transition-colors">
              Hive
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
              v2.0
            </span>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav
          className="hidden lg:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full px-3 py-1"
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-all rounded-full hover:bg-white/[0.06]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Controls & Live Status */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/25 text-[11px] font-mono text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="hidden xl:inline">Mesh Ingest:</span> Live
          </div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Docs
          </a>

          <Link
            to="/auth"
            className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all hover:shadow-[0_0_28px_rgba(56,189,248,0.5)] hover:scale-[1.02]"
          >
            <span>Launch Console</span>
            <FiArrowUpRight className="text-sm transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-300 hover:text-white md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <FiX size={18} /> : <FiMenu size={18} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <motion.nav
        className="pointer-events-auto absolute inset-x-4 top-20 overflow-hidden rounded-3xl border border-white/10 bg-[#0c0f17]/95 p-6 backdrop-blur-2xl shadow-2xl md:hidden"
        initial={false}
        animate={{ height: menuOpen ? "auto" : 0, opacity: menuOpen ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ pointerEvents: menuOpen ? "auto" : "none" }}
      >
        <div className="flex flex-col gap-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 hover:text-cyan-300 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <span>{link.label}</span>
              <FiArrowUpRight className="text-xs opacity-50" />
            </a>
          ))}
          <div className="mt-2 pt-4 border-t border-white/10 flex flex-col gap-3">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs font-mono text-emerald-400">
              <span className="flex items-center gap-2">
                <FiRadio className="animate-pulse" /> Telemetry Stream
              </span>
              <span>Online (3ms)</span>
            </div>
            <Link
              to="/auth"
              className="w-full justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 py-3 text-center text-xs font-semibold text-slate-950 transition-transform hover:scale-[1.02]"
            >
              Launch Console
            </Link>
          </div>
        </div>
      </motion.nav>
    </motion.header>
  );
}
