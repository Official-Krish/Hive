import { motion } from "motion/react";
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { FiArrowUpRight, FiMenu, FiX, FiLogOut, FiGrid } from "react-icons/fi";
import { http } from "@/lib/http";

const navLinks = [
  { label: "Work", href: "#work" },
  { label: "Products", href: "#products" },
  { label: "Pricing", href: "#pricing" },
  { label: "Blog", href: "#blog" },
];

const authNavLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Spatial office", href: "/world" },
];

export function AppBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await http.auth.logout();
    navigate("/", { replace: true });
  };

  const user = me?.user;

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
        <Link to="/" className="group flex items-center gap-3">
          <span className="font-sans font-bold text-lg tracking-tight text-white hidden sm:inline-block">
            Hive
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav
          className="ml-20 flex items-baseline space-x-8"
          aria-label="Main Navigation"
        >
          {isLoading ? (
            <>
              <div className="px-3 py-2 text-sm font-medium text-neutral-300 animate-pulse" />
              <div className="px-3 py-2 text-sm font-medium text-neutral-300 animate-pulse" />
              <div className="px-3 py-2 text-sm font-medium text-neutral-300 animate-pulse" />
            </>
          ) : user ? (
            authNavLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))
          ) : (
            navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </a>
            ))
          )}
        </nav>

        {/* Right Side: Auth State */}
        <div className="hidden md:flex items-center gap-3 mr-4">
          {isLoading ? (
            <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
          ) : user ? (
            <div className="relative" ref={profileRef}>
              {/* Profile Trigger */}
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="group relative flex items-center gap-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 px-4 py-2 transition-all duration-200"
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                <div className="relative w-8 h-8">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover ring-2 ring-white/10"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center ring-2 ring-white/10">
                      <span className="font-semibold text-white text-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-white hidden sm:inline-block">
                  {user.name}
                </span>
                <FiArrowUpRight className="text-xs text-neutral-400 group-hover:text-white transition-transform group-hover:rotate-180" />
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-white/10 bg-[#0f131d]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-2"
                >
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="font-semibold text-white text-sm">
                      {user.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <FiGrid className="size-4" />
                    <span>Dashboard</span>
                  </Link>
                  <div className="border-t border-white/10 my-2" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                  >
                    <FiLogOut className="size-4" />
                    <span>Sign out</span>
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              className="group relative inline-flex items-center gap-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-200 hover:scale-[1.02]"
            >
              <span>Launch Workspace</span>
              <FiArrowUpRight className="text-xs text-neutral-400 group-hover:text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )}
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
          {isLoading ? (
            <>
              <div className="h-10 rounded-lg bg-white/5 animate-pulse" />
              <div className="h-10 rounded-lg bg-white/5 animate-pulse" />
              <div className="h-10 rounded-lg bg-white/5 animate-pulse" />
              <div className="h-10 rounded-lg bg-white/5 animate-pulse" />
            </>
          ) : user ? (
            authNavLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-white/5 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <span>{link.label}</span>
                <FiArrowUpRight className="text-xs opacity-40" />
              </Link>
            ))
          ) : (
            navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-white/5 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <span>{link.label}</span>
                <FiArrowUpRight className="text-xs opacity-40" />
              </a>
            ))
          )}
          {user ? (
            <>
              <div className="mt-2 pt-4 border-t border-white/10 flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
                  <span className="font-semibold text-white text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-white text-sm">{user.name}</p>
                  <p className="text-xs text-slate-400 truncate max-w-[160px]">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="mt-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/10 text-rose-400 py-2.5 text-center text-xs font-semibold hover:bg-rose-500/20 transition-colors"
                >
                  <FiLogOut className="size-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </motion.nav>
    </motion.header>
  );
}
