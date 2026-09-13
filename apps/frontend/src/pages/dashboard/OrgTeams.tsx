import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiChevronDown, FiPlus } from "react-icons/fi";
import { ApiError, http } from "@/lib/http";
import {
  Avatar,
  BaselineField,
  Btn,
  ConfirmBtn,
  Note,
  RoleBadge,
  Spinner,
  baselineInputClass,
} from "@/components/dashboard/kit";
import { notifyError, notifySuccess } from "@/lib/toast";
import type { OrgOutletContext } from "./OrgDetail";
import { cn } from "@/lib/utils";

const TEAM_ROLES = ["admin", "member"] as const;

export function OrgTeams() {
  const { org } = useOutletContext<OrgOutletContext>();
  const queryClient = useQueryClient();
  const canManage = org.role === "admin" || org.role === "owner";

  const teams = useQuery({
    queryKey: ["org", org.id, "teams"],
    queryFn: () => http.teams.list(org.id),
    retry: false,
  });

  const orgMembers = useQuery({
    queryKey: ["org", org.id, "members"],
    queryFn: () => http.orgs.members.list(org.id),
    retry: false,
    enabled: canManage,
  });

  const createTeam = useMutation({
    mutationFn: (input: { name: string; slug?: string }) =>
      http.teams.create(org.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", org.id, "teams"] });
      notifySuccess("Team created");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't create team.",
      ),
  });

  if (teams.isLoading) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-neutral-500">
        <Spinner /> Loading teams…
      </div>
    );
  }

  if (teams.isError) {
    return (
      <Note tone="error">
        <span className="flex flex-wrap items-center gap-3">
          <span>We couldn&apos;t load the teams.</span>
          <Btn variant="ghost" onClick={() => teams.refetch()}>
            Retry
          </Btn>
        </span>
      </Note>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <CreateTeamForm
          onCreate={createTeam.mutate}
          busy={createTeam.isPending}
        />
      )}

      {teams.data?.length === 0 && (
        <Note>No teams yet. Teams group members inside this organization.</Note>
      )}

      <div className="divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
        {teams.data?.map((t) => (
          <TeamCard
            key={t.id}
            orgId={org.id}
            team={t}
            orgRole={org.role}
            orgMemberOptions={orgMembers.data ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function CreateTeamForm({
  onCreate,
  busy,
}: {
  onCreate: (input: { name: string; slug?: string }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate({ name: name.trim(), slug: slug.trim() || undefined });
        setName("");
        setSlug("");
      }}
      className="flex flex-wrap items-end gap-4 border-t border-neutral-900/10 py-4"
    >
      <div className="min-w-[160px] flex-1">
        <BaselineField label="New team name">
          <input
            className={baselineInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Platform"
          />
        </BaselineField>
      </div>
      <div className="min-w-[160px] flex-1">
        <BaselineField label="Slug (optional)">
          <input
            className={baselineInputClass}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={40}
            placeholder="platform"
            spellCheck={false}
          />
        </BaselineField>
      </div>
      <Btn type="submit" disabled={busy || !name.trim()}>
        <FiPlus className="size-4" aria-hidden />
        {busy ? "Creating…" : "Create team"}
      </Btn>
    </form>
  );
}

function TeamCard({
  orgId,
  team,
  orgRole,
  orgMemberOptions,
}: {
  orgId: string;
  team: { id: string; name: string; slug: string; memberCount: number };
  orgRole: string;
  orgMemberOptions: { userId: string; name: string; email: string }[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const isOwner = orgRole === "owner";
  const canManage = orgRole === "admin" || orgRole === "owner";

  const members = useQuery({
    queryKey: ["org", orgId, "teams", team.id, "members"],
    queryFn: () => http.teams.members.list(orgId, team.id),
    enabled: open,
    retry: false,
  });

  const [pickUserId, setPickUserId] = useState("");
  const [pickRole, setPickRole] = useState<string>("member");

  const addMember = useMutation({
    mutationFn: (input: { userId: string; role: string }) =>
      http.teams.members.add(orgId, team.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["org", orgId, "teams", team.id, "members"],
      });
      queryClient.invalidateQueries({ queryKey: ["org", orgId, "teams"] });
      setPickUserId("");
      setPickRole("member");
      notifySuccess("Member added");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't add member.",
      ),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      http.teams.members.changeRole(orgId, team.id, userId, role),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["org", orgId, "teams", team.id, "members"],
      }),
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't update role.",
      ),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      http.teams.members.remove(orgId, team.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["org", orgId, "teams", team.id, "members"],
      });
      queryClient.invalidateQueries({ queryKey: ["org", orgId, "teams"] });
      notifySuccess("Member removed");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't remove member.",
      ),
  });

  const deleteTeam = useMutation({
    mutationFn: () => http.teams.remove(orgId, team.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", orgId, "teams"] });
      notifySuccess("Team deleted");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't delete team.",
      ),
  });

  const inTeam = useMemo(
    () => new Set((members.data ?? []).map((m) => m.userId)),
    [members.data],
  );
  const candidates = orgMemberOptions.filter((m) => !inTeam.has(m.userId));

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-3 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <FiChevronDown
            className={cn(
              "size-4 flex-shrink-0 text-neutral-500 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
          <span className="truncate text-[14px] font-semibold text-neutral-800">
            {team.name}
          </span>
          <span className="data-mono truncate text-[11px] text-neutral-400">
            {team.slug}
          </span>
          <span className="data-mono flex-shrink-0 text-[11px] tabular-nums text-neutral-400">
            {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
          </span>
        </button>
        {canManage && (
          <ConfirmBtn
            variant="ghost"
            confirmLabel="Delete team"
            pending={deleteTeam.isPending}
            onConfirm={() => deleteTeam.mutate()}
          >
            Delete
          </ConfirmBtn>
        )}
      </div>

      {open && (
        <div className="space-y-2 py-2">
          {members.isLoading && (
            <div className="flex items-center gap-2.5 text-sm text-neutral-500">
              <Spinner /> Loading members…
            </div>
          )}
          {members.isError && (
            <Note tone="error">
              <span className="flex flex-wrap items-center gap-3">
                <span>Couldn&apos;t load members.</span>
                <Btn variant="ghost" onClick={() => members.refetch()}>
                  Retry
                </Btn>
              </span>
            </Note>
          )}

          {(members.data ?? []).map((m) => {
            const rowBusy =
              (changeRole.isPending &&
                changeRole.variables?.userId === m.userId) ||
              (removeMember.isPending && removeMember.variables === m.userId);
            return (
              <div
                key={m.userId}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar
                    name={m.name}
                    src={
                      "avatarUrl" in m ? (m.avatarUrl as string | null) : null
                    }
                    size={26}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-neutral-800">
                      {m.name}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {m.email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {isOwner ? (
                    <>
                      <select
                        className={`${baselineInputClass} h-8 w-auto px-0 text-xs`}
                        value={m.role}
                        disabled={rowBusy}
                        onChange={(e) =>
                          changeRole.mutate({
                            userId: m.userId,
                            role: e.target.value,
                          })
                        }
                      >
                        {TEAM_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <ConfirmBtn
                        variant="ghost"
                        confirmLabel="Remove"
                        pending={removeMember.isPending}
                        onConfirm={() => removeMember.mutate(m.userId)}
                      >
                        Remove
                      </ConfirmBtn>
                    </>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </div>
              </div>
            );
          })}

          {canManage && candidates.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!pickUserId) return;
                addMember.mutate({ userId: pickUserId, role: pickRole });
              }}
              className="flex flex-wrap items-end gap-4 border-t border-neutral-900/[0.08] pt-4"
            >
              <div className="min-w-[160px] flex-1">
                <BaselineField label="Add member">
                  <select
                    className={baselineInputClass}
                    value={pickUserId}
                    onChange={(e) => setPickUserId(e.target.value)}
                  >
                    <option value="">Select an org member…</option>
                    {candidates.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} · {m.email}
                      </option>
                    ))}
                  </select>
                </BaselineField>
              </div>
              <div>
                <BaselineField label="Role">
                  <select
                    className={baselineInputClass}
                    value={pickRole}
                    onChange={(e) => setPickRole(e.target.value)}
                  >
                    {TEAM_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </BaselineField>
              </div>
              <Btn type="submit" disabled={addMember.isPending || !pickUserId}>
                <FiPlus className="size-4" aria-hidden />
                {addMember.isPending ? "Adding…" : "Add"}
              </Btn>
            </form>
          )}

          {canManage && candidates.length === 0 && members.isSuccess && (
            <p className="font-mono text-[11px] text-neutral-400">
              Every organization member is already on this team.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default OrgTeams;
