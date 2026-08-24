/* ─────────────────────────────────────────────────────────────
   WORKSPACE DETAIL — one workspace, up close.
   Its name, description and role, plus the people in it. No live
   map here — this is the plain, functional view.
   ───────────────────────────────────────────────────────────── */
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { FiArrowLeft, FiUsers } from "react-icons/fi";
import { ApiError, http } from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import {
  Avatar,
  Note,
  Panel,
  RoleTag,
  Spinner,
} from "@/components/dashboard/ui";

export function WorkspaceDetail() {
  const { workspaceId = "" } = useParams();

  const workspace = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => http.workspaces.get(workspaceId),
    enabled: workspaceId.length > 0,
    retry: false,
  });

  const members = useQuery({
    queryKey: ["workspace", workspaceId, "members"],
    queryFn: () => http.workspaces.members.list(workspaceId),
    enabled: workspace.isSuccess,
  });

  const backLink = (
    <Link
      to="/dashboard"
      className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-slate-400 transition-colors hover:text-white"
    >
      <FiArrowLeft className="size-4" aria-hidden />
      Back to overview
    </Link>
  );

  if (workspace.isLoading) {
    return (
      <div>
        {backLink}
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner /> Loading workspace…
        </div>
      </div>
    );
  }

  if (workspace.isError) {
    const notMember =
      workspace.error instanceof ApiError && workspace.error.status === 404;
    return (
      <div>
        {backLink}
        <Note tone="error">
          {notMember
            ? "This workspace doesn't exist or you're not a member of it."
            : "We couldn't load this workspace. Refresh to try again."}
        </Note>
      </div>
    );
  }

  const ws = workspace.data!;
  const created = new Date(ws.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div>
      {backLink}

      <motion.header {...fade(0)} className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="font-serif text-3xl leading-none tracking-[-0.02em] text-white sm:text-[2.5rem]">
            {ws.name}
          </h1>
          <RoleTag role={ws.role} />
        </div>
        {ws.description && (
          <p className="max-w-2xl text-[14px] leading-relaxed text-slate-400">
            {ws.description}
          </p>
        )}
        <p className="mt-3 text-[12.5px] text-slate-500">
          {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"} · Created{" "}
          {created}
        </p>
      </motion.header>

      <motion.section {...fade(0.08)}>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          <FiUsers className="size-3.5" aria-hidden />
          Members
        </div>

        <Panel className="overflow-hidden">
          {members.isLoading && (
            <div className="px-5 py-6">
              <div className="h-10 animate-pulse rounded-lg bg-white/[0.03]" />
            </div>
          )}
          {members.isError && (
            <div className="px-5 py-5">
              <Note tone="error">We couldn't load the member list.</Note>
            </div>
          )}
          {members.isSuccess && (
            <ul className="divide-y divide-white/[0.05]">
              {members.data.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                >
                  <Avatar name={m.name} src={m.avatarUrl} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-white">
                      {m.name}
                    </p>
                    <p className="truncate text-[12.5px] text-slate-500">
                      {m.email}
                    </p>
                  </div>
                  <RoleTag role={m.role} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </motion.section>
    </div>
  );
}
