/* ─────────────────────────────────────────────────────────────
   DASHBOARD LAYOUT — light console shell.
   Fixed slim rail (desktop), compact top bar (mobile), content well
   with a single keyed page-enter transition. No ambient decoration —
   the content is the interface.
   ───────────────────────────────────────────────────────────── */
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { DASHBOARD_NAV, Sidebar, useReceivedInviteCount } from "./Sidebar";
import { cn } from "@/lib/utils";

export function DashboardLayout() {
  const { pathname } = useLocation();
  return (
    <div className="relative min-h-screen bg-[#F4F3EF] text-neutral-900">
      <Sidebar />
      <MobileBar />

      <div className="lg:pl-[232px]">
        <main className="mx-auto max-w-[1080px] px-5 py-8 sm:px-8 lg:py-10">
          <div key={pathname} className="dash-rise">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/* compact top bar — the rail is hidden below lg */
function MobileBar() {
  const inviteCount = useReceivedInviteCount();
  return (
    <div className="sticky top-0 z-40 border-b border-neutral-900/[0.08] bg-[#F4F3EF]/90 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between px-5">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-[16px] font-bold tracking-tight text-neutral-900">
            Hive
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400">
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
                "flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-neutral-900/20 bg-neutral-900/[0.06] text-neutral-900"
                  : "border-neutral-900/[0.08] text-neutral-500",
              )
            }
          >
            <Icon className="size-3.5" aria-hidden />
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
