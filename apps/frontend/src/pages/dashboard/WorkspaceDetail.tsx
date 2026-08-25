/* ─────────────────────────────────────────────────────────────
   WORKSPACE DETAIL — one workspace, up close.
   The whole page is one bone instrument (the landing's bezel):
   identity + actions at the top, live office presence beside,
   and the member roster below a hairline. No stitching.
   ───────────────────────────────────────────────────────────── */
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiMap,
  FiSettings,
  FiUserPlus,
} from "react-icons/fi";
import { ApiError, http } from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import {
  AvatarStack,
  Hairline,
  InkNote,
  LiveDot,
  PaperInset,
  PaperEyebrow,
  PresenceRow,
  StripMeta,
  inkBtnClass,
  paperGhostBtnClass,
} from "@/components/dashboard/Paper";
import { Note, PaperRoleTag, Spinner } from "@/components/dashboard/ui";

function BackLink() {
  return (
    <Link
      to="/dashboard"
      className="group mb-7 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
    >
      <FiArrowLeft
        className="size-4 transition-transform group-hover:-translate-x-0.5"
        aria-hidden
      />
      Overview
    </Link>
  );
}

export function WorkspaceDetail() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();

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

  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  const device = useQuery({
    queryKey: ["devices", "me", "status"],
    queryFn: http.devices.status,
    retry: false,
    staleTime: 30_000,
  });
  const hasAvatar = !!me.data?.user?.mapAvatarModel;
  const hasDevice = device.data?.hasOnlineDevice ?? true;

  if (workspace.isLoading) {
    return (
      <div>
        <BackLink />
        <div className="flex items-center gap-2.5 text-neutral-500">
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
        <BackLink />
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <BackLink />

      <motion.header {...fade(0)}>
        <PaperInset
          grid
          top={
            <>
              <StripMeta>
                <span className="uppercase tracking-[0.08em]">Workspace</span>
              </StripMeta>
              <StripMeta>
                <span className="tabular-nums">
                  {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"}
                </span>
                <span className="text-neutral-300">/</span>
                <span>Created {created}</span>
              </StripMeta>
            </>
          }
        >
          {/* identity */}
          <div className="px-5 py-7 sm:px-7 sm:py-8">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-[2.2rem] leading-none tracking-[-0.02em] text-neutral-950 sm:text-[3rem]">
                {ws.name}
              </h1>
              <PaperRoleTag role={ws.role} />
            </div>
            {ws.description && (
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-neutral-600">
                {ws.description}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className={inkBtnClass}
                onClick={() =>
                  hasAvatar
                    ? navigate(`/world?workspaceId=${workspaceId}`)
                    : navigate(`/dashboard/avatar?workspaceId=${workspaceId}`)
                }
              >
                <FiMap className="size-4" aria-hidden />
                {hasAvatar ? "Enter spatial office" : "Pick avatar & enter"}
              </button>
              <Link
                to={`/dashboard/invite?workspaceId=${workspaceId}`}
                className={paperGhostBtnClass}
              >
                <FiUserPlus className="size-4" aria-hidden />
                Invite people
              </Link>
              {(ws.role === "owner" || ws.role === "admin") && (
                <Link
                  to={`/dashboard/w/${workspaceId}/settings`}
                  className={paperGhostBtnClass}
                >
                  <FiSettings className="size-4" aria-hidden />
                  Settings
                </Link>
              )}
            </div>

            {!hasDevice && !device.isLoading && (
              <InkNote className="mt-6 max-w-lg">
                Collector offline — run{" "}
                <code className="rounded bg-neutral-900/[0.06] px-1.5 py-0.5 font-mono text-[11.5px]">
                  hive start
                </code>{" "}
                on your machine to go live in the office.
              </InkNote>
            )}
          </div>

          <Hairline />

          {/* roster */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] lg:divide-x lg:divide-neutral-900/10">
            <div className="px-5 py-7 sm:px-7">
              <div className="flex items-baseline justify-between">
                <PaperEyebrow>Members</PaperEyebrow>
                {members.data && members.data.length > 0 && (
                  <AvatarStack people={members.data} />
                )}
              </div>

              {members.isLoading && (
                <div className="mt-5 space-y-3.5">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-9 w-56 animate-pulse rounded-lg bg-neutral-900/[0.05]"
                    />
                  ))}
                </div>
              )}
              {members.isError && (
                <p className="mt-5 text-[13px] text-neutral-500">
                  Couldn't load the roster right now.
                </p>
              )}
              {members.isSuccess && (
                <ul className="divide-y divide-neutral-900/[0.06]">
                  {members.data.map((m) => (
                    <li
                      key={m.userId}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium leading-tight text-neutral-900">
                          {m.name}
                        </p>
                        <p className="truncate text-[12px] leading-tight text-neutral-500">
                          {m.email}
                        </p>
                      </div>
                      <PaperRoleTag role={m.role} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* live presence */}
            <PresencePanel workspaceId={workspaceId} />
          </div>
        </PaperInset>
      </motion.header>
    </div>
  );
}

/* live office presence — real data from the realtime map */
function PresencePanel({ workspaceId }: { workspaceId: string }) {
  const presence = useQuery({
    queryKey: ["workspace", workspaceId, "map"],
    queryFn: () => http.reads.map(workspaceId),
    staleTime: 15_000,
  });

  const people = presence.data?.members ?? [];
  const rank = (s: string) => (s === "online" ? 0 : s === "away" ? 1 : 2);
  const sorted = [...people].sort((a, b) => rank(a.status) - rank(b.status));
  const onlineCount = people.filter((p) => p.status === "online").length;

  return (
    <div className="border-t border-neutral-900/10 px-5 py-7 sm:px-7 lg:border-t-0">
      <div className="flex items-baseline justify-between">
        <PaperEyebrow>In the office</PaperEyebrow>
        <StripMeta>
          <LiveDot
            tone={onlineCount > 0 ? "live" : "off"}
            ping={onlineCount > 0}
          />
          <span className={onlineCount > 0 ? "text-neutral-700" : undefined}>
            <span className="tabular-nums">{onlineCount}</span> online
          </span>
        </StripMeta>
      </div>

      {presence.isLoading ? (
        <div className="mt-5 space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-5 w-36 animate-pulse rounded bg-neutral-900/[0.05]"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="mt-5 font-serif text-[19px] leading-snug tracking-[-0.01em] text-neutral-500">
          The office is quiet —{" "}
          <span className="italic">no one has arrived yet.</span>
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {sorted.slice(0, 6).map((p) => (
            <PresenceRow
              key={p.userId}
              name={p.name}
              avatarUrl={p.avatarUrl}
              status={p.status}
            />
          ))}
          {sorted.length > 6 && (
            <li className="pt-1 text-[11px] text-neutral-500">
              +{sorted.length - 6} more teammates
            </li>
          )}
        </ul>
      )}

      <Hairline className="my-5" />
      <Link
        to={`/world?workspaceId=${workspaceId}`}
        className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:text-neutral-950"
      >
        Join them on the floor
        <FiArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
      </Link>
    </div>
  );
}

export default WorkspaceDetail;
