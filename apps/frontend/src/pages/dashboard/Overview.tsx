/* ─────────────────────────────────────────────────────────────
   OVERVIEW — the console's front page.
   Composition mirrors the landing: dark masthead up top, then the
   primary object set on the bone-paper bezel (your featured
   workspace, with its live office presence), the full workspace
   index as a quiet ruled list, and a "setup" rail that reflects
   real account state — collector, avatar, GitHub, invites.
   ───────────────────────────────────────────────────────────── */
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
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
  FiUserPlus,
} from "react-icons/fi";
import { http } from "@/lib/http";
import { notifyInfo } from "@/lib/toast";
import {
  COLLECTOR_INSTALL_CMD,
  COLLECTOR_INSTALL_SCRIPT,
  EASE,
  fade,
  useTick,
} from "@/components/dashboard/primitives";
import {
  Hairline,
  InkNote,
  LiveDot,
  PaperInset,
  PaperEyebrow,
  StripMeta,
  AvatarStack,
  PresenceRow,
  inkBtnClass,
  paperGhostBtnClass,
} from "@/components/dashboard/Paper";
import {
  Note,
  PageHeader,
  Panel,
  PaperRoleTag,
  RoleTag,
  SectionLabel,
  SkeletonList,
  primaryBtnClass,
} from "@/components/dashboard/ui";

export function Overview() {
  useTick();

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
      <PageHeader
        eyebrow="Overview"
        meta={
          <span className="flex items-center gap-1.5">
            <LiveDot tone="live" ping />
            <span className="text-[11px] font-medium tracking-[0.02em] text-neutral-500">
              Console
            </span>
            <span className="text-neutral-300">·</span>
            <span className="text-[11px] tabular-nums text-neutral-500">
              {today}
            </span>
          </span>
        }
        title={
          <>
            Good {greeting()},{" "}
            <span className="italic text-neutral-400">{name}.</span>
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

      {!isLoading && !isError && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_304px] lg:items-start">
          {/* ── primary column ── */}
          <div className="min-w-0 space-y-10">
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

          {/* ── setup rail ── */}
          <SetupRail />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FEATURED WORKSPACE — one bone instrument with live presence
   ═══════════════════════════════════════════════════════════ */
function FeaturedWorkspace({
  workspace: ws,
}: {
  workspace: {
    id: string;
    name: string;
    description: string | null;
    role: string;
    memberCount: number;
    createdAt: string;
  };
}) {
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
    <motion.section {...fadeStagger(0)}>
      <PaperInset
        grid
        top={
          <>
            <StripMeta>
              <LiveDot
                tone={onlineCount > 0 ? "live" : "off"}
                ping={onlineCount > 0}
              />
              <span
                className={onlineCount > 0 ? "text-neutral-700" : undefined}
              >
                {onlineCount > 0 ? (
                  <>
                    <span className="tabular-nums text-neutral-900">
                      {onlineCount}
                    </span>{" "}
                    in the office
                  </>
                ) : (
                  "Office quiet"
                )}
              </span>
            </StripMeta>
            <StripMeta>
              <span className="uppercase tracking-[0.08em]">Workspace</span>
              <span className="text-neutral-300">/</span>
              <span className="tabular-nums">
                {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"}
              </span>
            </StripMeta>
          </>
        }
        bottom={
          <>
            <StripMeta>
              <span className="uppercase tracking-[0.08em]">Created</span>
              <span className="text-neutral-300">·</span>
              <span className="tabular-nums">{created}</span>
            </StripMeta>
            <Link
              to={`/dashboard/w/${ws.id}`}
              className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-700 transition-colors hover:text-neutral-950"
            >
              Open workspace
              <FiArrowUpRight className="size-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
            </Link>
          </>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] lg:divide-x lg:divide-neutral-900/10">
          {/* identity + actions */}
          <div className="px-5 py-7 sm:px-7">
            <PaperEyebrow>Your workspace</PaperEyebrow>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <h2 className="font-serif text-[2rem] leading-none tracking-[-0.02em] text-neutral-950 sm:text-[2.4rem]">
                {ws.name}
              </h2>
              <PaperRoleTag role={ws.role} />
            </div>
            <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-neutral-600">
              {ws.description || "No description yet — add one from settings."}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className={inkBtnClass}
                onClick={() =>
                  hasAvatar
                    ? navigate(`/world?workspaceId=${ws.id}`)
                    : navigate(`/dashboard/avatar?workspaceId=${ws.id}`)
                }
              >
                <FiMap className="size-4" aria-hidden />
                {hasAvatar ? "Enter spatial office" : "Pick avatar & enter"}
              </button>
              <Link
                to={`/dashboard/invite?workspaceId=${ws.id}`}
                className={paperGhostBtnClass}
              >
                <FiUserPlus className="size-4" aria-hidden />
                Invite people
              </Link>
              {(ws.role === "owner" || ws.role === "admin") && (
                <Link
                  to={`/dashboard/w/${ws.id}/settings`}
                  className="group ml-1 inline-flex items-center gap-1.5 px-1 py-2 text-[12.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-950"
                >
                  <FiSettings className="size-3.5" aria-hidden />
                  Settings
                </Link>
              )}
            </div>

            {!hasDevice && !device.isLoading && (
              <InkNote className="mt-5">
                Collector offline — run{" "}
                <code className="rounded bg-neutral-900/[0.06] px-1.5 py-0.5 font-mono text-[11.5px]">
                  hive start
                </code>{" "}
                to go live in the office.
              </InkNote>
            )}
          </div>

          {/* presence */}
          <div className="border-t border-neutral-900/10 px-5 py-7 sm:px-7 lg:border-t-0">
            <div className="flex items-baseline justify-between">
              <PaperEyebrow>In the office</PaperEyebrow>
              {people.length > 0 && <AvatarStack people={people} />}
            </div>

            {presence.isLoading ? (
              <div className="mt-5 space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-5 w-40 animate-pulse rounded bg-neutral-900/[0.05]"
                  />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <p className="mt-5 font-serif text-[19px] leading-snug tracking-[-0.01em] text-neutral-500">
                Nobody here yet —{" "}
                <span className="italic">be the first to arrive.</span>
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {sorted.slice(0, 5).map((p) => (
                  <PresenceRow
                    key={p.userId}
                    name={p.name}
                    avatarUrl={p.avatarUrl}
                    status={p.status}
                  />
                ))}
                {sorted.length > 5 && (
                  <li className="pt-1 text-[11px] text-neutral-500">
                    +{sorted.length - 5} more teammates
                  </li>
                )}
              </ul>
            )}

            <Hairline className="my-5" />
            <Link
              to={`/world?workspaceId=${ws.id}`}
              className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:text-neutral-950"
            >
              Walk the floor
              <FiArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </PaperInset>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════
   WORKSPACE INDEX — quiet ruled list for the rest
   ═══════════════════════════════════════════════════════════ */
function WorkspaceIndex({
  workspaces,
}: {
  workspaces: Array<{
    id: string;
    name: string;
    description: string | null;
    role: string;
    memberCount: number;
  }>;
}) {
  return (
    <motion.section {...fadeStagger(0.08)}>
      <SectionLabel>All workspaces</SectionLabel>
      <Panel className="overflow-hidden">
        <ul>
          {workspaces.map((ws, i) => (
            <motion.li
              key={ws.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.1 + i * 0.05 }}
              className="border-b border-neutral-900/[0.08] last:border-b-0"
            >
              <Link
                to={`/dashboard/w/${ws.id}`}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-neutral-900/[0.025] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-[19px] leading-none tracking-[-0.01em] text-neutral-950">
                      {ws.name}
                    </span>
                    <FiArrowUpRight className="size-3.5 -translate-x-1 text-neutral-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:text-neutral-600 group-hover:opacity-100" />
                  </div>
                  {ws.description && (
                    <p className="mt-1 truncate text-[12.5px] text-neutral-500">
                      {ws.description}
                    </p>
                  )}
                </div>
                <span className="hidden items-center gap-1.5 text-[12px] tabular-nums text-neutral-500 sm:flex">
                  {ws.memberCount}
                </span>
                <RoleTag role={ws.role} />
              </Link>
            </motion.li>
          ))}
        </ul>
      </Panel>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════
   EMPTY WORKSPACES — editorial invitation on paper
   ═══════════════════════════════════════════════════════════ */
function EmptyWorkspaces() {
  const { data: invites } = useQuery({
    queryKey: ["invites", "received"],
    queryFn: http.invites.listReceived,
    staleTime: 30_000,
  });
  const pending = (invites ?? []).filter((i) => i.status === "pending").length;

  return (
    <motion.div {...fadeStagger(0)}>
      <PaperInset grid>
        <div className="px-6 py-14 text-center sm:px-10 sm:py-20">
          <PaperEyebrow className="mb-4">Get started</PaperEyebrow>
          <h2 className="font-serif text-[2.1rem] leading-[1.05] tracking-[-0.02em] text-neutral-950 sm:text-[2.75rem]">
            No workspaces yet.
            <br />
            <span className="italic text-neutral-500">
              Create one, or join your team.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[13.5px] leading-relaxed text-neutral-600">
            A workspace is where your team's activity comes together —
            developers, AI agents, and everything they ship.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/dashboard/create" className={inkBtnClass}>
              Create workspace
              <FiArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/dashboard/invites" className={paperGhostBtnClass}>
              <FiInbox className="size-4" aria-hidden />
              View invites
              {pending > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-950 px-1 text-[9.5px] font-semibold tabular-nums text-white">
                  {pending}
                </span>
              )}
            </Link>
          </div>
        </div>
      </PaperInset>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SETUP RAIL — real account state: collector, avatar, github
   ═══════════════════════════════════════════════════════════ */
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
  const githubLoading = github.isLoading;

  async function connectGithub() {
    try {
      const { url } = await http.github.loginUrl();
      window.location.href = url;
    } catch {
      /* surfaced via query error state */
    }
  }

  return (
    <motion.aside
      {...fadeStagger(0.16)}
      className="space-y-6 lg:sticky lg:top-24"
    >
      <div>
        <SectionLabel>Your setup</SectionLabel>
        <Panel>
          <ul className="divide-y divide-neutral-900/[0.07]">
            <SetupRow
              icon={<FiTerminal className="size-3.5" aria-hidden />}
              label="Collector"
              done={hasDevice}
              loading={device.isLoading}
              doneText={hasDevice ? "Connected" : undefined}
              pendingText={
                <>
                  Run{" "}
                  <code className="rounded bg-neutral-900/[0.06] px-1 py-px font-mono text-[11px] text-neutral-800">
                    hive start
                  </code>{" "}
                  to go live
                </>
              }
            />
            <SetupRow
              icon={<FiUser className="size-3.5" aria-hidden />}
              label="Avatar"
              done={hasAvatar}
              loading={!me}
              doneText={hasAvatar ? "Ready" : undefined}
              pendingText="Pick yours"
              href={hasAvatar ? undefined : "/dashboard/avatar"}
            />
            <SetupRow
              icon={<FiGithub className="size-3.5" aria-hidden />}
              label="GitHub"
              done={githubConnected}
              loading={githubLoading}
              doneText={githubConnected ? "Connected" : undefined}
              pendingText="Connect account"
              onClick={githubConnected ? undefined : connectGithub}
            />
          </ul>
        </Panel>
      </div>

      {!device.isLoading && !hasDevice && (
        <div>
          <SectionLabel icon={<FiDownload className="size-3.5" aria-hidden />}>
            Install the collector
          </SectionLabel>
          <Panel className="space-y-3 p-4">
            <p className="text-[12.5px] leading-relaxed text-neutral-600">
              One line in your terminal — it installs{" "}
              <code className="rounded bg-neutral-900/[0.06] px-1 py-px font-mono text-[11px] text-neutral-800">
                hive
              </code>{" "}
              and walks you through login &amp; start.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-neutral-900/[0.08] bg-neutral-900/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-neutral-800">
                {COLLECTOR_INSTALL_CMD}
              </code>
              <button
                type="button"
                aria-label="Copy install command"
                title="Copy"
                className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-900/15 text-neutral-500 transition-colors hover:border-neutral-900/30 hover:text-neutral-900"
                onClick={() => {
                  void navigator.clipboard.writeText(COLLECTOR_INSTALL_CMD);
                  notifyInfo("Install command copied");
                }}
              >
                <FiCopy className="size-3.5" aria-hidden />
              </button>
            </div>
            <a
              href={COLLECTOR_INSTALL_SCRIPT}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <FiDownload className="size-3.5" aria-hidden />
              Download the install script
            </a>
          </Panel>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <SectionLabel icon={<FiInbox className="size-3.5" aria-hidden />}>
            Invites
          </SectionLabel>
          <Panel>
            <ul className="divide-y divide-neutral-900/[0.07]">
              {pending.slice(0, 3).map((inv) => (
                <li key={inv.id}>
                  <Link
                    to="/dashboard/invites"
                    className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-neutral-900/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-neutral-900">
                        {inv.workspace?.name ?? inv.org.name}
                      </p>
                      <p className="text-[11px] capitalize text-neutral-500">
                        as {inv.role}
                      </p>
                    </div>
                    <FiArrowUpRight className="size-3.5 flex-shrink-0 text-neutral-400 transition-all group-hover:translate-x-0 group-hover:text-neutral-900 sm:-translate-x-1 sm:opacity-0 sm:group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
            {pending.length > 3 && (
              <Link
                to="/dashboard/invites"
                className="block border-t border-neutral-900/[0.07] px-4 py-2.5 text-[11.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
              >
                View all {pending.length} invites
              </Link>
            )}
          </Panel>
        </div>
      )}
    </motion.aside>
  );
}

function SetupRow({
  icon,
  label,
  done,
  loading,
  doneText = "Done",
  pendingText,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  loading?: boolean;
  doneText?: string;
  pendingText: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span
        className={
          done
            ? "flex size-6 flex-shrink-0 items-center justify-center rounded-full border border-emerald-600/25 bg-emerald-600/10 text-emerald-600"
            : "flex size-6 flex-shrink-0 items-center justify-center rounded-full border border-neutral-900/10 bg-neutral-900/[0.03] text-neutral-500"
        }
      >
        {done ? <FiCheck className="size-3" aria-hidden /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-tight text-neutral-900">
          {label}
        </p>
        {!loading && !done && (
          <p className="mt-0.5 text-[11.5px] leading-tight text-neutral-500">
            {pendingText}
          </p>
        )}
      </div>
      {loading ? (
        <span className="h-4 w-12 animate-pulse rounded bg-neutral-900/[0.05]" />
      ) : done ? (
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
          <LiveDot tone="live" />
          {doneText}
        </span>
      ) : href || onClick ? (
        <span className="flex-shrink-0 rounded-full border border-neutral-900/15 px-2.5 py-1 text-[10.5px] font-medium text-neutral-600 transition-colors group-hover:border-neutral-900/30 group-hover:text-neutral-900">
          {href ? "Open" : "Connect"}
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <li>
        <a
          href={href}
          className="group block transition-colors hover:bg-neutral-900/[0.03]"
        >
          {inner}
        </a>
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

/* local motion alias */
const fadeStagger = fade;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
