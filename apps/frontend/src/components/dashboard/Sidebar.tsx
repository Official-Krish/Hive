import { Link, NavLink, useNavigate } from "react-router-dom";
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
import { Avatar } from "./kit";

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
      notifyError("Couldn't sign out. Please try again.");
      return;
    }
    queryClient.clear();
    navigate("/auth", { replace: true });
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-neutral-900/[0.08] bg-[#FBFAF7] lg:flex">
      <div className="flex h-16 items-center px-5">
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
        className="dash-scroll flex-1 space-y-0.5 overflow-y-auto px-3 py-2"
      >
        {DASHBOARD_NAV.map((item) => (
          <RailLink
            key={item.href}
            item={item}
            count={item.badge ? inviteCount : 0}
          />
        ))}
      </nav>

      <div className="border-t border-neutral-900/[0.08] p-3">
        {me?.organizations && me.organizations.length > 0 && (
          <div className="mb-2">
            <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400">
              Organizations
            </p>
            {me.organizations.map((o) => (
              <NavLink
                key={o.id}
                to={`/dashboard/o/${o.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-baseline justify-between rounded-lg px-2 py-1.5 transition-colors",
                    isActive
                      ? "bg-neutral-900/[0.06] text-neutral-900"
                      : "text-neutral-500 hover:bg-neutral-900/[0.03] hover:text-neutral-800",
                  )
                }
              >
                <span className="truncate text-xs font-medium">{o.name}</span>
                <span className="ml-2 flex-shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-400">
                  {o.plan}
                </span>
              </NavLink>
            ))}
          </div>
        )}

        {user && (
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-neutral-900/[0.03]">
            <Avatar name={user.name} src={user.avatarUrl} size={30} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium leading-tight text-neutral-800">
                {user.name}
              </span>
              <span className="truncate text-[11px] leading-tight text-neutral-500">
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-900/[0.05] hover:text-neutral-900"
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

function RailLink({ item, count }: { item: NavItem; count: number }) {
  const { label, href, icon: Icon, end } = item;
  return (
    <NavLink
      to={href}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
          isActive
            ? "bg-neutral-900/[0.06] text-neutral-900"
            : "text-neutral-500 hover:bg-neutral-900/[0.03] hover:text-neutral-800",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "size-4 flex-shrink-0",
              isActive ? "text-neutral-900" : "text-neutral-400",
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
