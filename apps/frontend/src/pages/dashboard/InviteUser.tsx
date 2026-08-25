/* ─────────────────────────────────────────────────────────────
   INVITE A USER — by GitHub username.
   Pick a workspace you administer, enter the person's GitHub
   username, choose a role. The backend resolves the username to
   a linked Hive account and issues the invite; they'll see it
   under Invites. Set on the bone-paper bezel.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FiGithub } from "react-icons/fi";
import { ApiError, http, type InviteCreatedResult } from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import {
  PaperInset,
  StripMeta,
  inkBtnClass,
  paperInputClass,
  paperLabelClass,
} from "@/components/dashboard/Paper";
import {
  EmptyState,
  Field,
  Note,
  PageHeader,
  Spinner,
  primaryBtnClass,
} from "@/components/dashboard/ui";

export function InviteUser() {
  const [searchParams] = useSearchParams();
  const preSelected = searchParams.get("workspaceId") ?? "";

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: http.workspaces.list,
  });

  const manageable = (workspaces ?? []).filter(
    (w) => w.role === "owner" || w.role === "admin",
  );

  const [workspaceId, setWorkspaceId] = useState(preSelected);
  const [githubLogin, setGithubLogin] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");

  // Pre-select the workspace from the query param if it's one we manage.
  useEffect(() => {
    if (preSelected && manageable.some((w) => w.id === preSelected)) {
      setWorkspaceId(preSelected);
    } else if (!workspaceId && manageable.length > 0) {
      setWorkspaceId(manageable[0]!.id);
    }
  }, [preSelected, manageable, workspaceId]);

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

  const selected = manageable.find((w) => w.id === workspaceId);

  return (
    <div>
      <PageHeader
        eyebrow="Invite"
        title={
          <>
            Bring someone{" "}
            <span className="italic text-neutral-400">to the floor.</span>
          </>
        }
        subtitle="Send a workspace invite by GitHub username — they accept it under Invites."
      />

      {isLoading ? (
        <div className="max-w-xl">
          <PaperInset>
            <div className="p-6">
              <div className="h-40 animate-pulse rounded-lg bg-neutral-900/[0.04]" />
            </div>
          </PaperInset>
        </div>
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
        <motion.div {...fade(0.05)} className="max-w-xl">
          <PaperInset
            grid
            top={
              <>
                <StripMeta>
                  <span className="uppercase tracking-[0.08em]">
                    Invitation
                  </span>
                </StripMeta>
                {selected && (
                  <StripMeta>
                    <span className="max-w-[160px] truncate">
                      {selected.name}
                    </span>
                  </StripMeta>
                )}
              </>
            }
          >
            <form
              className="space-y-5 px-5 py-7 sm:px-7"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) mutation.mutate();
              }}
            >
              <Field
                label="Workspace"
                htmlFor="inv-ws"
                labelClass={paperLabelClass}
              >
                <select
                  id="inv-ws"
                  className={paperInputClass}
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
                htmlFor="inv-gh"
                hint="The person must already have a Hive account connected with GitHub."
                labelClass={paperLabelClass}
              >
                <div className="relative">
                  <FiGithub className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="inv-gh"
                    className={`${paperInputClass} pl-10`}
                    value={githubLogin}
                    onChange={(e) => setGithubLogin(e.target.value)}
                    placeholder="octocat"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </Field>

              <Field
                label="Role"
                htmlFor="inv-role"
                labelClass={paperLabelClass}
              >
                <div
                  className="grid grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label="Role"
                >
                  {(["member", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={role === r}
                      onClick={() => setRole(r)}
                      className={
                        "rounded-xl border px-3 py-2.5 text-left transition-all " +
                        (role === r
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-900/15 bg-white text-neutral-700 hover:border-neutral-900/35")
                      }
                    >
                      <span className="block text-[13px] font-semibold capitalize">
                        {r}
                      </span>
                      <span
                        className={
                          "mt-0.5 block text-[11px] leading-tight " +
                          (role === r ? "text-neutral-300" : "text-neutral-500")
                        }
                      >
                        {r === "member"
                          ? "Works in the office"
                          : "Invites & manages people"}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              {mutation.isSuccess && (
                <Note tone="success" onPaper>
                  Invite sent. They'll find it under Invites.
                </Note>
              )}
              {errorMessage && (
                <Note tone="error" onPaper>
                  {errorMessage}
                </Note>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  className={inkBtnClass}
                  disabled={!canSubmit}
                >
                  {mutation.isPending && <Spinner ink />}
                  {mutation.isPending ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </PaperInset>
        </motion.div>
      )}
    </div>
  );
}

export default InviteUser;
