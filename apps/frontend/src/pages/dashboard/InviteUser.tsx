/* ─────────────────────────────────────────────────────────────
   INVITE A USER — by GitHub username.
   Pick a workspace you administer, enter the person's GitHub
   username, choose a role. The backend resolves the username to a
   linked Hive account and issues the invite; they'll see it under
   Workspace invites.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FiGithub } from "react-icons/fi";
import { ApiError, http, type InviteCreatedResult } from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import {
  EmptyState,
  Field,
  Note,
  PageHeader,
  Panel,
  Spinner,
  inputClass,
  primaryBtnClass,
} from "@/components/dashboard/ui";

export function InviteUser() {
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: http.workspaces.list,
  });

  const manageable = (workspaces ?? []).filter(
    (w) => w.role === "owner" || w.role === "admin",
  );

  const [workspaceId, setWorkspaceId] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");

  // default to the first workspace we can manage once loaded
  useEffect(() => {
    if (!workspaceId && manageable.length > 0) {
      setWorkspaceId(manageable[0]!.id);
    }
  }, [manageable, workspaceId]);

  const mutation = useMutation({
    mutationFn: (): Promise<InviteCreatedResult> =>
      http.workspaces.invites.createByGithub(workspaceId, {
        githubLogin: githubLogin.trim(),
        role,
      }),
    onSuccess: () => setGithubLogin(""),
  });

  const canSubmit =
    workspaceId.length > 0 &&
    githubLogin.trim().length > 0 &&
    !mutation.isPending;

  const errorMessage = (() => {
    if (!mutation.isError) return null;
    const err = mutation.error;
    if (err instanceof ApiError) {
      if (err.code === "NOT_FOUND")
        return "No Hive user is linked to that GitHub username. They need to connect with GitHub on Hive first.";
      if (err.code === "CONFLICT")
        return "That person is already a member of this workspace.";
      return err.message;
    }
    return "Something went wrong sending the invite.";
  })();

  return (
    <div>
      <PageHeader
        eyebrow="Invite a user"
        title="Invite by GitHub username"
        subtitle="Send a workspace invite to someone by their GitHub username."
      />

      {isLoading ? (
        <Panel className="max-w-xl p-6">
          <div className="h-40 animate-pulse rounded-lg bg-white/[0.03]" />
        </Panel>
      ) : manageable.length === 0 ? (
        <EmptyState
          title="No workspaces to invite into"
          hint="You can only invite people to workspaces you own or administer. Create one first."
          action={
            <Link to="/dashboard/create" className={primaryBtnClass}>
              Create workspace
            </Link>
          }
        />
      ) : (
        <Panel className="max-w-xl p-6 sm:p-7">
          <motion.form
            {...fade(0.05)}
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) mutation.mutate();
            }}
          >
            <Field label="Workspace" htmlFor="inv-ws">
              <select
                id="inv-ws"
                className={inputClass}
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
              >
                {manageable.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#0d0f16]">
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="GitHub username"
              htmlFor="inv-gh"
              hint="The person must already have a Hive account connected with GitHub."
            >
              <div className="relative">
                <FiGithub className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="inv-gh"
                  className={`${inputClass} pl-10`}
                  value={githubLogin}
                  onChange={(e) => setGithubLogin(e.target.value)}
                  placeholder="octocat"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </Field>

            <Field label="Role" htmlFor="inv-role">
              <select
                id="inv-role"
                className={inputClass}
                value={role}
                onChange={(e) => setRole(e.target.value as "member" | "admin")}
              >
                <option value="member" className="bg-[#0d0f16]">
                  Member
                </option>
                <option value="admin" className="bg-[#0d0f16]">
                  Admin
                </option>
              </select>
            </Field>

            {mutation.isSuccess && (
              <Note tone="success">
                Invite sent. They'll find it under Workspace invites.
              </Note>
            )}
            {errorMessage && <Note tone="error">{errorMessage}</Note>}

            <div className="pt-1">
              <button
                type="submit"
                className={primaryBtnClass}
                disabled={!canSubmit}
              >
                {mutation.isPending && <Spinner />}
                {mutation.isPending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </motion.form>
        </Panel>
      )}
    </div>
  );
}
