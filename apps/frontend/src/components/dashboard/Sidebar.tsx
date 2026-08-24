/* ─────────────────────────────────────────────────────────────
   SIDEBAR — the dashboard rail.
   A quiet monochrome column: a serif wordmark, four destinations,
   and the signed-in operator at the base. One travelling marker
   tracks the active page. No colour but the operator's own.
   ───────────────────────────────────────────────────────────── */
import { NavLink, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  FiGrid,
  FiPlusSquare,
  FiUserPlus,
  FiInbox,
  FiLogOut,
} from "react-icons/fi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof FiGrid;
  end?: boolean;
  badge?: boolean;
}

export const DASHBOARD_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: FiGrid, end: true },
  { label: "Create workspace", href: "/dashboard/create", icon: FiPlusSquare },
  { label: "Invite a user", href: "/dashboard/invite", icon: FiUserPlus },
  {
    label: "Workspace invites",
    href: "/dashboard/invites",
    icon: FiInbox,
    badge: true,
  },
];

/** Count of pending invites addressed to the current user. */
export function useReceivedInviteCount(): number {
  const { data } = useQuery({
    queryKey: ["invites", "received"],
    queryFn: http.invites.listReceived,
    staleTime: 30_000,
  });
  return (data ?? []).filter((i) => i.status === "pending").length;
}

export function Sidebar() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inviteCount = useReceivedInviteCount();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });
  const user = me?.user;

  async function handleLogout() {
    try {
      await http.auth.logout();
    } catch {
      /* clear local state regardless */
    }
    queryClient.clear();
    navigate("/auth", { replace: true });
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/[0.06] bg-[#08090d] lg:flex">
      {/* wordmark */}
      <div className="flex h-[68px] items-center px-6">
        <span className="font-serif text-[20px] tracking-[-0.01em] text-white">
          Hive
        </span>
      </div>

      {/* nav */}
      <nav aria-label="Dashboard" className="flex-1 space-y-1 px-3 py-2">
        {DASHBOARD_NAV.map((item) => (
          <RailLink
            key={item.href}
            item={item}
            reduce={!!reduce}
            count={item.badge ? inviteCount : 0}
          />
        ))}
      </nav>

      {/* operator */}
      {user && (
        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <Avatar name={user.name} src={user.avatarUrl} size={32} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium text-white">
                {user.name}
              </span>
              <span className="truncate text-[10.5px] text-slate-500">
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              <FiLogOut className="size-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function RailLink({
  item,
  reduce,
  count,
}: {
  item: NavItem;
  reduce: boolean;
  count: number;
}) {
  const { label, href, icon: Icon, end } = item;
  return (
    <NavLink
      to={href}
      end={end}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
          isActive ? "text-white" : "text-slate-400 hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={reduce ? undefined : "rail-active"}
              className="absolute inset-0 -z-10 rounded-lg border border-white/[0.08] bg-white/[0.05]"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-white"
            />
          )}
          <Icon className="size-[17px] flex-shrink-0" aria-hidden />
          <span className="flex-1">{label}</span>
          {count > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums text-neutral-950">
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
