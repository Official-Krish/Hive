/* ─────────────────────────────────────────────────────────────
   WORKSPACE DETAIL — one workspace, up close. Identity + actions,
   member roster, live presence. Same data, dark instrument.
   ───────────────────────────────────────────────────────────── */
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowUpRight, FiMap, FiSettings, FiUserPlus } from "react-icons/fi";
import { ApiError, http } from "@/lib/http";
import {
  Avatar,
  AvatarStack,
  BackLink,
  Btn,
  Card,
  LiveDot,
  Note,
  PresenceRow,
  RoleBadge,
  Spinner,
  btnGhostClass,
} from "@/components/dashboard/kit";

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
        <BackLink to="/dashboard">Overview</BackLink>
        <div className="flex items-center gap-2.5 text-sm text-neutral-500">
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
        <BackLink to="/dashboard">Overview</BackLink>
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
      <BackLink to="/dashboard">Overview</BackLink>

      <Card>
        <div className="flex items-center justify-between gap-4 border-b border-neutral-900/[0.08] px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
            Workspace
          </span>
          <span className="font-mono text-[11px] tabular-nums text-neutral-400">
            {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"} · {created}
          </span>
        </div>

        <div className="px-5 py-6 sm:py-7">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] font-semibold leading-none tracking-[-0.02em] text-neutral-900">
              {ws.name}
            </h1>
            <RoleBadge role={ws.role} />
          </div>
          {ws.description && (
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-neutral-500">
              {ws.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Btn
              onClick={() =>
                hasAvatar
                  ? navigate(`/world?workspaceId=${workspaceId}`)
                  : navigate(`/dashboard/avatar?workspaceId=${workspaceId}`)
              }
            >
              <FiMap className="size-4" aria-hidden />
              {hasAvatar ? "Enter spatial office" : "Pick avatar & enter"}
            </Btn>
            <Link
              to={`/dashboard/invite?workspaceId=${workspaceId}`}
              className={btnGhostClass}
            >
              <FiUserPlus className="size-4" aria-hidden />
              Invite people
            </Link>
            {(ws.role === "owner" || ws.role === "admin") && (
              <Link
                to={`/dashboard/w/${workspaceId}/settings`}
                className={btnGhostClass}
              >
                <FiSettings className="size-4" aria-hidden />
                Settings
              </Link>
            )}
          </div>

          {!hasDevice && !device.isLoading && (
            <div className="mt-4 max-w-lg">
              <Note tone="warn">
                Collector offline — run{" "}
                <code className="rounded bg-neutral-900/[0.06] px-1.5 py-0.5 font-mono text-[11px]">
                  hive start
                </code>{" "}
                on your machine to go live in the office.
              </Note>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 border-t border-neutral-900/[0.08] lg:grid-cols-[1.4fr_1fr] lg:divide-x lg:divide-neutral-900/[0.08]">
          <div className="px-5 py-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                Members
              </p>
              {members.data && members.data.length > 0 && (
                <AvatarStack people={members.data} />
              )}
            </div>

            {members.isLoading && (
              <div className="mt-4 space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-9 w-56 animate-pulse rounded-lg bg-neutral-900/[0.05]"
                  />
                ))}
              </div>
            )}
            {members.isError && (
              <p className="mt-4 text-[13px] text-neutral-500">
                Couldn't load the roster right now.
              </p>
            )}
            {members.isSuccess && (
              <ul className="mt-2 divide-y divide-neutral-900/[0.08]">
                {members.data.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center gap-3 py-3 first:pt-1 last:pb-0"
                  >
                    <Avatar name={m.name} src={m.avatarUrl} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight text-neutral-800">
                        {m.name}
                      </p>
                      <p className="truncate text-xs leading-tight text-neutral-500">
                        {m.email}
                      </p>
                    </div>
                    <RoleBadge role={m.role} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <PresencePanel workspaceId={workspaceId} />
        </div>
      </Card>
    </div>
  );
}

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
    <div className="border-t border-neutral-900/[0.08] px-5 py-6 lg:border-t-0">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
          In the office
        </p>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-500">
          <LiveDot tone={onlineCount > 0 ? "live" : "off"} />
          <span className="tabular-nums">{onlineCount}</span> online
        </span>
      </div>

      {presence.isLoading ? (
        <div className="mt-4 space-y-2.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-4 w-36 animate-pulse rounded bg-neutral-900/[0.05]"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-neutral-500">
          The office is quiet — no one has arrived yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {sorted.slice(0, 6).map((p) => (
            <PresenceRow
              key={p.userId}
              name={p.name}
              avatarUrl={p.avatarUrl}
              status={p.status}
            />
          ))}
          {sorted.length > 6 && (
            <li className="pt-1 font-mono text-[11px] text-neutral-400">
              +{sorted.length - 6} more
            </li>
          )}
        </ul>
      )}

      <Link
        to={`/world?workspaceId=${workspaceId}`}
        className="group mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        Join them on the floor
        <FiArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
      </Link>
    </div>
  );
}

export default WorkspaceDetail;
