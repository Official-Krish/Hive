import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiChevronDown, FiPlus, FiTrash2 } from "react-icons/fi";
import { ApiError, http } from "@/lib/http";
import { Note, Spinner } from "@/components/dashboard/ui";
import {
  inkBtnClass,
  paperGhostBtnClass,
  paperInputClass,
} from "@/components/dashboard/Paper";
import { notifyError, notifySuccess } from "@/lib/toast";
import type { OrgOutletContext } from "./OrgDetail";

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
      <div className="flex items-center gap-2.5 text-neutral-500">
        <Spinner /> Loading teams…
      </div>
    );
  }

  if (teams.isError) {
    return <Note tone="error">We couldn't load the teams.</Note>;
  }

  return (
    <div className="space-y-5">
      {canManage && (
        <CreateTeamForm
          onCreate={createTeam.mutate}
          busy={createTeam.isPending}
        />
      )}

      {teams.data?.length === 0 && (
        <Note>No teams yet. Teams group members inside this organization.</Note>
      )}

      <div className="space-y-2">
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
      className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-900/[0.08] bg-neutral-900/[0.02] px-3 py-3"
    >
      <label className="flex-1 min-w-[160px]">
        <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-neutral-500">
          New team name
        </span>
        <input
          className={paperInputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Platform"
        />
      </label>
      <label className="flex-1 min-w-[160px]">
        <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-neutral-500">
          Slug (optional)
        </span>
        <input
          className={paperInputClass}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          maxLength={40}
          placeholder="platform"
        />
      </label>
      <button
        type="submit"
        className={inkBtnClass}
        disabled={busy || !name.trim()}
      >
        <FiPlus className="size-4" aria-hidden />
        {busy ? "Creating…" : "Create team"}
      </button>
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

  const addMember = useMutation({
    mutationFn: (input: { userId: string; role: string }) =>
      http.teams.members.add(orgId, team.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["org", orgId, "teams", team.id, "members"],
      });
      queryClient.invalidateQueries({ queryKey: ["org", orgId, "teams"] });
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
  const [pickUserId, setPickUserId] = useState("");
  const [pickRole, setPickRole] = useState<string>("member");

  return (
    <div className="rounded-xl border border-neutral-900/[0.08] bg-neutral-900/[0.02]">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <FiChevronDown
            className={`size-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
          <span className="truncate text-[13px] font-medium text-neutral-900">
            {team.name}
          </span>
          <span className="font-mono text-[11px] text-neutral-500">
            {team.slug}
          </span>
          <span className="text-[11px] text-neutral-400">
            {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
          </span>
        </button>
        {canManage && (
          <button
            type="button"
            aria-label="Delete team"
            title="Delete team"
            className={paperGhostBtnClass}
            disabled={deleteTeam.isPending}
            onClick={() => deleteTeam.mutate()}
          >
            <FiTrash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 border-t border-neutral-900/[0.07] px-3 py-3">
          {members.isLoading && (
            <div className="flex items-center gap-2.5 text-neutral-500">
              <Spinner /> Loading members…
            </div>
          )}
          {members.isError && <Note tone="error">Couldn't load members.</Note>}

          {(members.data ?? []).map((m) => (
            <div
              key={m.userId}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-900/[0.06] bg-white/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-neutral-900">
                  {m.name}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {m.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isOwner ? (
                  <>
                    <select
                      className="rounded-lg border border-neutral-900/15 bg-white px-2 py-1.5 text-[12.5px] text-neutral-900"
                      value={m.role}
                      disabled={changeRole.isPending}
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
                    <button
                      type="button"
                      aria-label="Remove member"
                      title="Remove"
                      className={paperGhostBtnClass}
                      disabled={removeMember.isPending}
                      onClick={() => removeMember.mutate(m.userId)}
                    >
                      <FiTrash2 className="size-4" aria-hidden />
                    </button>
                  </>
                ) : (
                  <span className="rounded-md bg-neutral-900/[0.05] px-2 py-1 text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-600">
                    {m.role}
                  </span>
                )}
              </div>
            </div>
          ))}

          {canManage && candidates.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!pickUserId) return;
                addMember.mutate({ userId: pickUserId, role: pickRole });
                setPickUserId("");
                setPickRole("member");
              }}
              className="flex flex-wrap items-end gap-2 border-t border-neutral-900/[0.07] pt-3"
            >
              <label className="flex-1 min-w-[160px]">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-neutral-500">
                  Add member
                </span>
                <select
                  className={paperInputClass}
                  value={pickUserId}
                  onChange={(e) => setPickUserId(e.target.value)}
                >
                  <option value="">— Select an org member —</option>
                  {candidates.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} · {m.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-neutral-500">
                  Role
                </span>
                <select
                  className={paperInputClass}
                  value={pickRole}
                  onChange={(e) => setPickRole(e.target.value)}
                >
                  {TEAM_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className={inkBtnClass}
                disabled={addMember.isPending || !pickUserId}
              >
                <FiPlus className="size-4" aria-hidden />
                {addMember.isPending ? "Adding…" : "Add"}
              </button>
            </form>
          )}

          {canManage && candidates.length === 0 && (
            <p className="text-[11.5px] text-neutral-500">
              Every organization member is already on this team.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default OrgTeams;
