/* ─────────────────────────────────────────────────────────────
   INVITE A USER — by GitHub username. Workspace, username, role.
   Same flow, dark instrument.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FiGithub } from "react-icons/fi";
import { ApiError, http, type InviteCreatedResult } from "@/lib/http";
import { notifyError, notifySuccess } from "@/lib/toast";
import {
  Btn,
  Card,
  CardHead,
  Empty,
  Field,
  PageHead,
  SkeletonRows,
  Spinner,
  btnPrimaryClass,
  inputClass,
} from "@/components/dashboard/kit";
import { cn } from "@/lib/utils";

function inviteErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "NOT_FOUND")
      return "No Hive user is linked to that GitHub username. They need to connect with GitHub on Hive first.";
    if (err.code === "CONFLICT")
      return "That person is already a member of this workspace.";
    return err.message;
  }
  return "Something went wrong sending the invite.";
}

const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  member: 1,
  developer: 2,
  maintainer: 3,
  admin: 4,
  owner: 5,
};
const INVITE_ROLES = [
  "member",
  "developer",
  "maintainer",
  "admin",
  "viewer",
] as const;
type InviteRole = (typeof INVITE_ROLES)[number];
const ROLE_DESC: Record<InviteRole, string> = {
  member: "Works in the office",
  developer: "Contributes code and resolves alerts",
  maintainer: "Manages people & repositories",
  admin: "Full management, no ownership",
  viewer: "Read-only observer",
};

export function InviteUser() {
  const [searchParams] = useSearchParams();
  const preSelected = searchParams.get("workspaceId") ?? "";

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: http.workspaces.list,
  });

  const manageable = (workspaces ?? []).filter(
    (w) => w.role === "owner" || w.role === "admin" || w.role === "maintainer",
  );

  const [workspaceId, setWorkspaceId] = useState(preSelected);
  const [githubLogin, setGithubLogin] = useState("");
  const [role, setRole] = useState<InviteRole>("member");

  const selected = manageable.find((w) => w.id === workspaceId);
  const actorRank = selected ? (ROLE_RANK[selected.role] ?? 1) : 0;
  const selectable = INVITE_ROLES.filter(
    (r) => (ROLE_RANK[r] ?? 0) < actorRank,
  );
  const selectableKey = selectable.join(",");
  const manageableIds = manageable.map((w) => w.id).join(",");

  useEffect(() => {
    if (selectable.length === 0) return;
    if (!selectable.includes(role)) setRole(selectable[0]!);
  }, [selectableKey]);

  useEffect(() => {
    if (preSelected && manageable.some((w) => w.id === preSelected)) {
      setWorkspaceId(preSelected);
    } else if (!workspaceId && manageable.length > 0) {
      setWorkspaceId(manageable[0]!.id);
    }
  }, [preSelected, manageableIds]);

  const mutation = useMutation({
    mutationFn: (): Promise<InviteCreatedResult> =>
      http.workspaces.invites.createByGithub(workspaceId, {
        githubLogin: githubLogin.trim(),
        role,
      }),
    onSuccess: () => {
      setGithubLogin("");
      notifySuccess("Invite sent — they'll find it under Invites.");
    },
    onError: (err) => notifyError(inviteErrorMessage(err)),
  });

  const canSubmit =
    workspaceId.length > 0 &&
    githubLogin.trim().length > 0 &&
    !mutation.isPending;

  return (
    <div>
      <PageHead
        eyebrow="Invite"
        title="Bring someone to the floor"
        sub="Send a workspace invite by GitHub username — they accept it under Invites."
      />

      {isLoading ? (
        <div className="max-w-xl">
          <SkeletonRows rows={3} />
        </div>
      ) : manageable.length === 0 ? (
        <Empty
          title="No workspaces to invite into"
          hint="You can only invite people to workspaces you own or administer. Create one first."
          action={
            <Link to="/dashboard/create" className={btnPrimaryClass}>
              Create workspace
            </Link>
          }
        />
      ) : (
        <div className="max-w-xl">
          <Card>
            <CardHead
              title="Invitation"
              hint={selected ? `to ${selected.name}` : undefined}
            />
            <form
              className="space-y-4 px-5 py-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) mutation.mutate();
              }}
            >
              <Field label="Workspace">
                <select
                  className={inputClass}
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                >
                  {manageable.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="GitHub username"
                hint="The person must already have a Hive account connected with GitHub."
              >
                <div className="relative">
                  <FiGithub className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    className={`${inputClass} pl-10`}
                    value={githubLogin}
                    onChange={(e) => setGithubLogin(e.target.value)}
                    placeholder="octocat"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </Field>

              <Field label="Role">
                <div
                  className="grid grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label="Role"
                >
                  {selectable.map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={role === r}
                      onClick={() => setRole(r)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left transition-colors",
                        role === r
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-900/10 bg-white text-neutral-600 hover:border-neutral-900/30",
                      )}
                    >
                      <span className="block text-[13px] font-semibold capitalize">
                        {r}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[11px] leading-tight",
                          role === r ? "text-neutral-500" : "text-neutral-500",
                        )}
                      >
                        {ROLE_DESC[r]}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="pt-1">
                <Btn type="submit" disabled={!canSubmit}>
                  {mutation.isPending && <Spinner />}
                  {mutation.isPending ? "Sending…" : "Send invite"}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

export default InviteUser;
