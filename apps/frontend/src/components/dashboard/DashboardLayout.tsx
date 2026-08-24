/* ─────────────────────────────────────────────────────────────
   DASHBOARD LAYOUT — the shell.
   The rail on the left (desktop) or a compact bar on top (mobile),
   with the active page rendered in the content field. One dark
   material throughout; each page brings its own masthead.
   ───────────────────────────────────────────────────────────── */
import { MotionConfig } from "motion/react";
import { NavLink, Outlet } from "react-router-dom";
import { DASHBOARD_NAV, Sidebar, useReceivedInviteCount } from "./Sidebar";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#08090d] text-white">
        <Sidebar />
        <MobileBar />

        <div className="lg:pl-[248px]">
          <main className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
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
    <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#08090d]/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center px-5">
        <span className="font-serif text-[18px] tracking-[-0.01em] text-white">
          Hive
        </span>
      </div>
      <nav
        aria-label="Dashboard"
        className="flex gap-1.5 overflow-x-auto px-4 pb-2.5"
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
                  ? "border-white/15 bg-white/[0.06] text-white"
                  : "border-white/[0.06] text-slate-400 hover:text-white",
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            <span>{label}</span>
            {badge && inviteCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold tabular-nums text-neutral-950">
                {inviteCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
