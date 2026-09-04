import { motion } from "motion/react";
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  FiArrowUpRight,
  FiChevronDown,
  FiMenu,
  FiUser,
  FiX,
  FiLogOut,
  FiGrid,
} from "react-icons/fi";
import { http } from "@/lib/http";
import { HiveMark } from "@/components/icons/HiveMark";

const navLinks = [
  { label: "FAQ", href: "#faq" },
  { label: "Launch", href: "/auth" },
];

const authNavLinks = [{ label: "Dashboard", href: "/dashboard" }];

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
        <Link to="/" className="group flex items-center gap-2.5">
          <HiveMark className="size-7 text-white transition-transform duration-300 group-hover:scale-105" />
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
                className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-3 backdrop-blur-md transition-all duration-200 hover:border-white/25 hover:bg-white/[0.09]"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <span className="relative block size-7">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="h-full w-full rounded-full object-cover ring-1 ring-white/20"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white ring-1 ring-white/20">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-black bg-emerald-400" />
                </span>
                <span className="hidden max-w-[120px] truncate text-[13px] font-medium text-white/85 sm:inline-block">
                  {user.name}
                </span>
                <FiChevronDown
                  className={`size-3.5 text-white/40 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  role="menu"
                  className="absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-white/10 bg-[#0b0d13]/95 p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                >
                  <Link
                    to="/dashboard/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="relative block size-9 flex-shrink-0">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="h-full w-full rounded-full object-cover ring-1 ring-white/20"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white ring-1 ring-white/20">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-white">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs text-white/40">
                        {user.email}
                      </span>
                    </span>
                  </Link>
                  <div className="my-1.5 h-px bg-white/[0.07]" />
                  <Link
                    to="/dashboard"
                    onClick={() => setProfileOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <FiGrid className="size-4 text-white/40" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    to="/dashboard/profile"
                    onClick={() => setProfileOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <FiUser className="size-4 text-white/40" />
                    <span>Profile</span>
                  </Link>
                  <div className="my-1.5 h-px bg-white/[0.07]" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-rose-300/90 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                  >
                    <FiLogOut className="size-4 opacity-70" />
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
