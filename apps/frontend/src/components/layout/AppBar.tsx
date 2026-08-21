import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FiArrowUpRight, FiMenu, FiX } from "react-icons/fi";

const navLinks = [
  { label: "Work", href: "#work" },
  { label: "Products", href: "#products" },
  { label: "Pricing", href: "#pricing" },
  { label: "Blog", href: "#blog" },
];

export function AppBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.header
      className="absolute inset-x-0 top-4 z-50 mx-auto w-full lg:top-4 lg:max-w-[calc(100%-4rem)]"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className={cn(
          "max-w-container mx-auto px-4 lg:px-8 flex h-16 items-center justify-between",
        )}
      >
        {/* Brand Logo Box */}
        <a href="/" className="group flex items-center gap-3">
          <span className="font-sans font-bold text-lg tracking-tight text-white hidden sm:inline-block">
            Hive
          </span>
        </a>

        {/* Center Nav Links */}
        <nav
          className="ml-20 flex items-baseline space-x-8"
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right CTA Action (Clean, non-yellow modern glass button) */}
        <div className="hidden md:flex items-center gap-3 mr-4">
          <Link
            to="/auth"
            className="group relative inline-flex items-center gap-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-200 hover:scale-[1.02]"
          >
            <span>Launch Workspace</span>
            <FiArrowUpRight className="text-xs text-neutral-400 group-hover:text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <FiX size={18} /> : <FiMenu size={18} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <motion.nav
        className="pointer-events-auto absolute inset-x-4 top-20 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f17]/95 p-6 backdrop-blur-2xl shadow-2xl md:hidden"
        initial={false}
        animate={{ height: menuOpen ? "auto" : 0, opacity: menuOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ pointerEvents: menuOpen ? "auto" : "none" }}
      >
        <div className="flex flex-col gap-3">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-white/5 hover:text-white transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <span>{link.label}</span>
              <FiArrowUpRight className="text-xs opacity-40" />
            </a>
          ))}
          <div className="mt-2 pt-4 border-t border-white/10">
            <Link
              to="/auth"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white text-black py-2.5 text-center text-xs font-semibold hover:bg-neutral-200 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <span>Launch Workspace</span>
              <FiArrowUpRight className="text-xs" />
            </Link>
          </div>
        </div>
      </motion.nav>
    </motion.header>
  );
}
