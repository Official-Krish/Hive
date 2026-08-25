/* ─────────────────────────────────────────────────────────────
   DASHBOARD LAYOUT — the shell.
   An off-white console (#faf9f6) with a faint engraved blueprint
   grid and a soft light halo at the horizon. The rail lives on
   the left (desktop) or as a compact bar on top (mobile); each
   page brings its own masthead and sets its primary object on
   paper (./Paper.tsx).
   ───────────────────────────────────────────────────────────── */
import { MotionConfig } from "motion/react";
import { NavLink, Outlet } from "react-router-dom";
import { Link } from "react-router-dom";
import { DASHBOARD_NAV, Sidebar, useReceivedInviteCount } from "./Sidebar";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-[#faf9f6] text-neutral-900">
        {/* ambient field — grid + horizon halo, tuned for the light shell */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(28,25,18,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(28,25,18,0.045) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage:
                "radial-gradient(ellipse 90% 60% at 50% 0%, black, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 90% 60% at 50% 0%, black, transparent 75%)",
            }}
          />
          <div
            className="absolute inset-x-0 top-0 h-[480px]"
            style={{
              background:
                "radial-gradient(600px 300px at 50% -80px, rgba(255,255,255,0.9), transparent 70%)",
            }}
          />
        </div>

        <Sidebar />
        <MobileBar />

        <div className="relative z-10 lg:pl-[248px]">
          <main className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
            <Outlet />
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}

/* compact top bar — the rail is hidden below lg */
function MobileBar() {
  const inviteCount = useReceivedInviteCount();
  return (
    <div className="sticky top-0 z-40 border-b border-neutral-900/[0.08] bg-[#faf9f6]/90 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between px-5">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-serif text-[19px] tracking-[-0.01em] text-neutral-900">
            Hive
          </span>
          <span className="text-[9.5px] font-medium uppercase tracking-[0.18em] text-neutral-400">
            Console
          </span>
        </Link>
      </div>
      <nav
        aria-label="Console"
        className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DASHBOARD_NAV.map(({ label, href, icon: Icon, end, badge }) => (
          <NavLink
            key={href}
            to={href}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                isActive
                  ? "border-neutral-900/20 bg-neutral-900/[0.06] text-neutral-900"
                  : "border-neutral-900/[0.08] text-neutral-500 hover:border-neutral-900/25 hover:text-neutral-900",
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            <span>{label}</span>
            {badge && inviteCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-950 px-1 text-[10px] font-semibold tabular-nums text-white">
                {inviteCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
