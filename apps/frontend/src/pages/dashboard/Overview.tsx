/* ─────────────────────────────────────────────────────────────
   OVERVIEW — console front page. Featured workspace with live
   presence, workspace index, setup rail. Same data, dark instrument.
   ───────────────────────────────────────────────────────────── */
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FiArrowRight,
  FiArrowUpRight,
  FiCheck,
  FiCopy,
  FiDownload,
  FiGithub,
  FiInbox,
  FiMap,
  FiSettings,
  FiTerminal,
  FiUser,
} from "react-icons/fi";
import { http } from "@/lib/http";
import { notifyInfo } from "@/lib/toast";
import { COLLECTOR_INSTALL_CMD } from "@/components/dashboard/primitives";
import {
  AvatarStack,
  Badge,
  Btn,
  Card,
  Empty,
  LiveDot,
  Note,
  PageHead,
  PresenceRow,
  RoleBadge,
  Row,
  SkeletonRows,
  btnGhostClass,
  btnPrimaryClass,
} from "@/components/dashboard/kit";

type Ws = {
  id: string;
  name: string;
  description: string | null;
  role: string;
  memberCount: number;
  createdAt: string;
};

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
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div>
      <PageHead
        eyebrow="Overview"
        meta={
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-400">
            <LiveDot tone="live" />
            <span className="tabular-nums">{today}</span>
          </span>
        }
        title={`Good ${greeting()}, ${name}.`}
        sub={
          isLoading
            ? "Loading your workspaces…"
            : count === 0
              ? "You haven't joined any workspaces yet."
              : `You belong to ${count} workspace${count === 1 ? "" : "s"}.`
        }
        actions={
          <Link to="/dashboard/create" className={btnPrimaryClass}>
            Create workspace
          </Link>
        }
      />

      {isError && (
        <div className="mb-6">
          <Note tone="error">
            We couldn't load your workspaces. Refresh to try again.
          </Note>
        </div>
      )}

      {isLoading && <SkeletonRows />}

      {!isLoading && !isError && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-8">
            {count === 0 ? (
              <EmptyWorkspaces />
            ) : (
              <>
                <FeaturedWorkspace workspace={workspaces![0]!} />
                {count > 1 && (
                  <WorkspaceIndex workspaces={workspaces!.slice(1)} />
                )}
              </>
            )}
          </div>
          <SetupRail />
        </div>
      )}
    </div>
  );
}

/* ── Featured workspace ────────────────────────────────────── */
function FeaturedWorkspace({ workspace: ws }: { workspace: Ws }) {
  const navigate = useNavigate();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    staleTime: 60_000,
  });
  const device = useQuery({
    queryKey: ["devices", "me", "status"],
    queryFn: http.devices.status,
    retry: false,
    staleTime: 30_000,
  });
  const presence = useQuery({
    queryKey: ["workspace", ws.id, "map"],
    queryFn: () => http.reads.map(ws.id),
    staleTime: 15_000,
  });
  const hasAvatar = !!me?.user?.mapAvatarModel;
  const hasDevice = device.data?.hasOnlineDevice ?? true;

  const people = presence.data?.members ?? [];
  const rank = (s: string) => (s === "online" ? 0 : s === "away" ? 1 : 2);
  const sorted = [...people].sort((a, b) => rank(a.status) - rank(b.status));
  const onlineCount = people.filter((p) => p.status === "online").length;
  const created = new Date(ws.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-neutral-900/[0.08] px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] text-neutral-500">
          <LiveDot tone={onlineCount > 0 ? "live" : "off"} />
          {onlineCount > 0 ? (
            <span>
              <span className="tabular-nums text-neutral-700">
                {onlineCount}
              </span>{" "}
              in the office
            </span>
          ) : (
            "Office quiet"
          )}
        </span>
        <span className="font-mono text-[11px] text-neutral-400">
          {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"} · {created}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] lg:divide-x lg:divide-neutral-900/[0.08]">
        <div className="px-5 py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Workspace
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-neutral-900">
              {ws.name}
            </h2>
            <RoleBadge role={ws.role} />
          </div>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-neutral-500">
            {ws.description || "No description yet — add one from settings."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Btn
              onClick={() =>
                hasAvatar
                  ? navigate(`/world?workspaceId=${ws.id}`)
                  : navigate(`/dashboard/avatar?workspaceId=${ws.id}`)
              }
            >
              <FiMap className="size-4" aria-hidden />
              {hasAvatar ? "Enter spatial office" : "Pick avatar & enter"}
            </Btn>
            <Link
              to={`/dashboard/invite?workspaceId=${ws.id}`}
              className={btnGhostClass}
            >
              Invite people
            </Link>
            {(ws.role === "owner" || ws.role === "admin") && (
              <Link
                to={`/dashboard/w/${ws.id}/settings`}
                className="ml-1 inline-flex items-center gap-1.5 px-1 py-2 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800"
              >
                <FiSettings className="size-3.5" aria-hidden />
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
                to go live in the office.
              </Note>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-900/[0.08] px-5 py-6 lg:border-t-0">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              Presence
            </p>
            {people.length > 0 && <AvatarStack people={people} />}
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
              Nobody here yet — be the first to arrive.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {sorted.slice(0, 5).map((p) => (
                <PresenceRow
                  key={p.userId}
                  name={p.name}
                  avatarUrl={p.avatarUrl}
                  status={p.status}
                />
              ))}
              {sorted.length > 5 && (
                <li className="pt-1 font-mono text-[11px] text-neutral-400">
                  +{sorted.length - 5} more
                </li>
              )}
            </ul>
          )}

          <Link
            to={`/world?workspaceId=${ws.id}`}
            className="group mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Walk the floor
            <FiArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ── Workspace index ───────────────────────────────────────── */
function WorkspaceIndex({ workspaces }: { workspaces: Ws[] }) {
  return (
    <section>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
        All workspaces
      </p>
      <Card>
        <ul className="divide-y divide-neutral-900/[0.08]">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Row to={`/dashboard/w/${ws.id}`} className="gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-neutral-800">
                      {ws.name}
                    </span>
                    <FiArrowUpRight className="size-3.5 flex-shrink-0 -translate-x-1 text-neutral-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                  {ws.description && (
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {ws.description}
                    </p>
                  )}
                </div>
                <span className="hidden text-xs tabular-nums text-neutral-500 sm:block">
                  {ws.memberCount}
                </span>
                <RoleBadge role={ws.role} />
              </Row>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/* ── Empty ─────────────────────────────────────────────────── */
function EmptyWorkspaces() {
  const { data: invites } = useQuery({
    queryKey: ["invites", "received"],
    queryFn: http.invites.listReceived,
    staleTime: 30_000,
  });
  const pending = (invites ?? []).filter((i) => i.status === "pending").length;

  return (
    <Empty
      title="No workspaces yet"
      hint="A workspace is where your team's activity comes together — developers, AI agents, and everything they ship."
      action={
        <>
          <Link to="/dashboard/create" className={btnPrimaryClass}>
            Create workspace
            <FiArrowRight className="size-4" aria-hidden />
          </Link>
          <Link to="/dashboard/invites" className={btnGhostClass}>
            View invites
            {pending > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-950 px-1 text-[10px] font-semibold tabular-nums text-white">
                {pending}
              </span>
            )}
          </Link>
        </>
      }
    />
  );
}

/* ── Setup rail ────────────────────────────────────────────── */
function SetupRail() {
  const device = useQuery({
    queryKey: ["devices", "me", "status"],
    queryFn: http.devices.status,
    retry: false,
    staleTime: 30_000,
  });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    staleTime: 60_000,
  });
  const github = useQuery({
    queryKey: ["github", "repos"],
    queryFn: http.github.listRepos,
    retry: false,
    staleTime: 60_000,
  });
  const { data: invites } = useQuery({
    queryKey: ["invites", "received"],
    queryFn: http.invites.listReceived,
    staleTime: 30_000,
  });

  const pending = (invites ?? []).filter((i) => i.status === "pending");
  const hasAvatar = !!me?.user?.mapAvatarModel;
  const hasDevice = device.data?.hasOnlineDevice ?? false;
  const githubConnected = github.isSuccess;

  async function connectGithub() {
    try {
      const { url } = await http.github.loginUrl();
      window.location.href = url;
    } catch {
      /* surfaced via query error state */
    }
  }

  return (
    <aside className="space-y-6 lg:sticky lg:top-8">
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
          Your setup
        </p>
        <Card>
          <ul className="divide-y divide-neutral-900/[0.08]">
            <SetupRow
              icon={<FiTerminal className="size-3.5" aria-hidden />}
              label="Collector"
              done={hasDevice}
              loading={device.isLoading}
              doneText="Connected"
              pendingText="Run hive start to go live"
            />
            <SetupRow
              icon={<FiUser className="size-3.5" aria-hidden />}
              label="Avatar"
              done={hasAvatar}
              loading={!me}
              doneText="Ready"
              pendingText="Pick yours"
              to={hasAvatar ? undefined : "/dashboard/avatar"}
            />
            <SetupRow
              icon={<FiGithub className="size-3.5" aria-hidden />}
              label="GitHub"
              done={githubConnected}
              loading={github.isLoading}
              doneText="Connected"
              pendingText="Connect account"
              onClick={githubConnected ? undefined : connectGithub}
            />
          </ul>
        </Card>
      </div>

      {!device.isLoading && !hasDevice && (
        <Card className="space-y-3 p-4">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            <FiDownload className="size-3.5" aria-hidden />
            Install the collector
          </p>
          <p className="text-xs leading-relaxed text-neutral-500">
            One line in your terminal — installs{" "}
            <code className="rounded bg-neutral-900/[0.06] px-1 py-px font-mono text-[11px] text-neutral-700">
              hive
            </code>{" "}
            and walks you through login &amp; start.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-neutral-900/10 bg-neutral-900/[0.04] px-2.5 py-2 font-mono text-[11px] text-neutral-700">
              {COLLECTOR_INSTALL_CMD}
            </code>
            <Btn
              variant="ghost"
              className="h-9 px-3"
              aria-label="Copy install command"
              onClick={() => {
                void navigator.clipboard.writeText(COLLECTOR_INSTALL_CMD);
                notifyInfo("Install command copied");
              }}
            >
              <FiCopy className="size-3.5" aria-hidden />
            </Btn>
          </div>
        </Card>
      )}

      {pending.length > 0 && (
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            <FiInbox className="size-3.5" aria-hidden />
            Invites
          </p>
          <Card>
            <ul className="divide-y divide-neutral-900/[0.08]">
              {pending.slice(0, 3).map((inv) => (
                <li key={inv.id}>
                  <Row to="/dashboard/invites">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-neutral-800">
                        {inv.workspace?.name ?? inv.org.name}
                      </p>
                      <p className="text-[11px] capitalize text-neutral-500">
                        as {inv.role}
                      </p>
                    </div>
                    <FiArrowUpRight className="size-3.5 flex-shrink-0 text-neutral-400" />
                  </Row>
                </li>
              ))}
            </ul>
            {pending.length > 3 && (
              <Link
                to="/dashboard/invites"
                className="block border-t border-neutral-900/[0.08] px-5 py-2.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800"
              >
                View all {pending.length} invites
              </Link>
            )}
          </Card>
        </div>
      )}
    </aside>
  );
}

function SetupRow({
  icon,
  label,
  done,
  loading,
  doneText = "Done",
  pendingText,
  to,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  loading?: boolean;
  doneText?: string;
  pendingText: React.ReactNode;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={
          done
            ? "flex size-6 flex-shrink-0 items-center justify-center rounded-full border border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
            : "flex size-6 flex-shrink-0 items-center justify-center rounded-full border border-neutral-900/10 bg-neutral-900/[0.02] text-neutral-500"
        }
      >
        {done ? <FiCheck className="size-3" aria-hidden /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-tight text-neutral-800">
          {label}
        </p>
        {!loading && !done && (
          <p className="mt-0.5 font-mono text-[11px] leading-tight text-neutral-500">
            {pendingText}
          </p>
        )}
      </div>
      {loading ? (
        <span className="h-4 w-12 animate-pulse rounded bg-neutral-900/[0.06]" />
      ) : done ? (
        <Badge tone="live">{doneText}</Badge>
      ) : to || onClick ? (
        <span className="flex-shrink-0 rounded-full border border-neutral-900/15 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
          {to ? "Open" : "Connect"}
        </span>
      ) : null}
    </div>
  );

  if (to) {
    return (
      <li>
        <Link
          to={to}
          className="group block transition-colors hover:bg-neutral-900/[0.03]"
        >
          {inner}
        </Link>
      </li>
    );
  }
  if (onClick) {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          className="group block w-full text-left transition-colors hover:bg-neutral-900/[0.03]"
        >
          {inner}
        </button>
      </li>
    );
  }
  return <li>{inner}</li>;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
