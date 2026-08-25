/* ─────────────────────────────────────────────────────────────
   SIDEBAR — the console rail.
   A quiet monochrome column that mirrors the landing AppBar:
   serif wordmark, four destinations with one travelling marker,
   the workspace's organization, and the signed-in operator at
   the base. No colour but live green and the operator's own.
   ───────────────────────────────────────────────────────────── */
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  FiArrowUpLeft,
  FiGrid,
  FiLogOut,
  FiPlusSquare,
  FiUserPlus,
  FiInbox,
} from "react-icons/fi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { notifyError } from "@/lib/toast";
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
    label: "Invites",
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
  const org = me?.organizations?.[0];

  async function handleLogout() {
    try {
      await http.auth.logout();
    } catch {
      notifyError("Couldn't sign out. Please try again.");
      return;
    }
    queryClient.clear();
    navigate("/auth", { replace: true });
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-neutral-900/[0.08] bg-[#faf9f6] lg:flex">
      {/* wordmark — same serif as the landing AppBar */}
      <div className="flex h-[72px] items-center justify-between px-6">
        <Link to="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-[21px] tracking-[-0.01em] text-neutral-900 transition-colors group-hover:text-neutral-600">
            Hive
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400 transition-colors group-hover:text-neutral-500">
            Console
          </span>
        </Link>
      </div>

      {/* nav */}
      <nav aria-label="Console" className="flex-1 space-y-0.5 px-3 py-2">
        {DASHBOARD_NAV.map((item) => (
          <RailLink
            key={item.href}
            item={item}
            reduce={!!reduce}
            count={item.badge ? inviteCount : 0}
          />
        ))}
      </nav>

      {/* organization + operator */}
      <div className="border-t border-neutral-900/[0.08] p-3">
        {org && (
          <Link
            to="/dashboard"
            className="mb-2 flex items-baseline justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-900/[0.04]"
          >
            <span className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              {org.name}
            </span>
            <span className="ml-2 flex-shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {org.plan}
            </span>
          </Link>
        )}

        {user && (
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-neutral-900/[0.04]">
            <Avatar name={user.name} src={user.avatarUrl} size={32} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium leading-tight text-neutral-900">
                {user.name}
              </span>
              <span className="truncate text-[10.5px] leading-tight text-neutral-500">
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-900/[0.05] hover:text-neutral-900"
            >
              <FiLogOut className="size-4" />
            </button>
          </div>
        )}

        <Link
          to="/"
          className="mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium text-neutral-500 transition-colors hover:text-neutral-800"
        >
          <FiArrowUpLeft className="size-3.5" aria-hidden />
          Back to site
        </Link>
      </div>
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
          isActive
            ? "text-neutral-900"
            : "text-neutral-500 hover:text-neutral-900",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={reduce ? undefined : "rail-active"}
              className="absolute inset-0 -z-10 rounded-lg border border-neutral-900/[0.08] bg-neutral-900/[0.05]"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          {isActive && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-emerald-500"
            />
          )}
          <Icon
            className={cn(
              "size-[17px] flex-shrink-0 transition-opacity",
              isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100",
            )}
            aria-hidden
          />
          <span className="flex-1">{label}</span>
          {count > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-950 px-1.5 text-[11px] font-semibold tabular-nums text-white">
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
