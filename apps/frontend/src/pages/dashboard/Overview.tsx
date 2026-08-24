/* ─────────────────────────────────────────────────────────────
   OVERVIEW — the workspaces you belong to.
   A ruled list of joined workspaces; each row opens its detail.
   ───────────────────────────────────────────────────────────── */
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { FiArrowUpRight, FiGrid, FiUsers } from "react-icons/fi";
import { http } from "@/lib/http";
import { EASE } from "@/components/dashboard/primitives";
import {
  EmptyState,
  Note,
  PageHeader,
  Panel,
  RoleTag,
  primaryBtnClass,
} from "@/components/dashboard/ui";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Overview() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    staleTime: 60_000,
  });
  const {
    data: workspaces,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["workspaces"],
    queryFn: http.workspaces.list,
  });

  const name = me?.user?.name?.split(" ")[0] ?? "there";
  const count = workspaces?.length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={
          <>
            {greeting()}, <span className="italic text-slate-300">{name}.</span>
          </>
        }
        subtitle={
          isLoading
            ? "Loading your workspaces…"
            : count === 0
              ? "You haven't joined any workspaces yet."
              : `You belong to ${count} workspace${count === 1 ? "" : "s"}.`
        }
        action={
          <Link to="/dashboard/create" className={primaryBtnClass}>
            Create workspace
          </Link>
        }
      />

      {isError && (
        <Note tone="error">
          We couldn't load your workspaces. Refresh to try again.
        </Note>
      )}

      {isLoading && <SkeletonList />}

      {!isLoading && !isError && count === 0 && (
        <EmptyState
          icon={<FiGrid className="size-5" />}
          title="No workspaces yet"
          hint="Create your first workspace, or accept an invite from your Workspace invites."
          action={
            <Link to="/dashboard/create" className={primaryBtnClass}>
              Create workspace
            </Link>
          }
        />
      )}

      {!isLoading && !isError && count > 0 && (
        <Panel className="overflow-hidden">
          <ul>
            {workspaces!.map((ws, i) => (
              <motion.li
                key={ws.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  ease: EASE,
                  delay: 0.05 + i * 0.05,
                }}
                className="border-b border-white/[0.05] last:border-b-0"
              >
                <Link
                  to={`/dashboard/w/${ws.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02] sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-[20px] leading-none tracking-[-0.01em] text-white">
                        {ws.name}
                      </span>
                      <FiArrowUpRight className="size-3.5 -translate-x-1 text-slate-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:text-slate-300 group-hover:opacity-100" />
                    </div>
                    {ws.description && (
                      <p className="mt-1 truncate text-[13px] text-slate-500">
                        {ws.description}
                      </p>
                    )}
                  </div>
                  <div className="hidden items-center gap-1.5 text-[12.5px] text-slate-500 sm:flex">
                    <FiUsers className="size-3.5" aria-hidden />
                    <span className="tabular-nums">{ws.memberCount}</span>
                  </div>
                  <RoleTag role={ws.role} />
                </Link>
              </motion.li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <Panel className="divide-y divide-white/[0.05] overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
          <div className="flex-1">
            <div className="h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
            <div className="mt-2 h-3 w-64 animate-pulse rounded bg-white/[0.04]" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.05]" />
        </div>
      ))}
    </Panel>
  );
}
