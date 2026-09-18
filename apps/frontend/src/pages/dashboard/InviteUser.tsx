/* ─────────────────────────────────────────────────────────────
   INVITE A USER — stepped flow. Workspace → person → role, with a
   live invitation preview. Quiet canvas, no boxes.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FiArrowLeft, FiArrowRight, FiGithub } from "react-icons/fi";
import { ApiError, http, type InviteCreatedResult } from "@/lib/http";
import { notifyError, notifySuccess } from "@/lib/toast";
import {
  BaselineField,
  BaselineSelect,
  Btn,
  Empty,
  PageHead,
  PreviewPanel,
  SkeletonRows,
  Spinner,
  Stepspine,
  baselineInputClass,
  btnPrimaryClass,
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
  const [step, setStep] = useState(0);

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

  const stepValid = [
    workspaceId.length > 0,
    githubLogin.trim().length > 0,
    true,
  ][step];

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
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <Stepspine steps={["Workspace", "Person", "Role"]} current={step} />

            <div className="mt-2 min-h-[220px]">
              {step === 0 && (
                <BaselineField
                  label="Which workspace are they joining?"
                  hint="You can invite into workspaces you own, administer, or maintain."
                >
                  <BaselineSelect
                    value={workspaceId}
                    autoFocus
                    ariaLabel="Which workspace are they joining?"
                    options={manageable.map((w) => ({
                      value: w.id,
                      label: w.name,
                    }))}
                    onValueChange={setWorkspaceId}
                  />
                </BaselineField>
              )}

              {step === 1 && (
                <BaselineField
                  label="What's their GitHub username?"
                  hint="They must already have a Hive account connected with GitHub."
                >
                  <div className="relative">
                    <FiGithub className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      className={`${baselineInputClass} pl-7`}
                      value={githubLogin}
                      onChange={(e) => setGithubLogin(e.target.value)}
                      placeholder="octocat"
                      autoComplete="off"
                      spellCheck={false}
                      autoFocus
                    />
                  </div>
                </BaselineField>
              )}

              {step === 2 && (
                <div>
                  <p className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    What can they do?
                  </p>
                  <div
                    className="divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10"
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
                          "flex w-full items-center gap-3 py-3 text-left transition-colors",
                          role === r
                            ? "text-neutral-900"
                            : "text-neutral-500 hover:text-neutral-800",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
                            role === r
                              ? "border-neutral-900 bg-neutral-900"
                              : "border-neutral-900/25",
                          )}
                        >
                          {role === r && (
                            <span className="size-1.5 rounded-full bg-white" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold capitalize">
                            {r}
                          </span>
                          <span className="block text-[12px] text-neutral-500">
                            {ROLE_DESC[r]}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-neutral-900/10 pt-5">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
                >
                  <FiArrowLeft className="size-4" aria-hidden />
                  Back
                </button>
              ) : (
                <span />
              )}
              {step < 2 ? (
                <Btn disabled={!stepValid} onClick={() => setStep(step + 1)}>
                  Continue
                  <FiArrowRight className="size-4" aria-hidden />
                </Btn>
              ) : (
                <Btn disabled={!canSubmit} onClick={() => mutation.mutate()}>
                  {mutation.isPending && <Spinner />}
                  {mutation.isPending ? "Sending…" : "Send invite"}
                </Btn>
              )}
            </div>
          </div>

          <PreviewPanel label="Invitation">
            <p className="truncate text-xl font-bold tracking-tight text-neutral-900">
              {githubLogin.trim() ? `@${githubLogin.trim()}` : "Someone"}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
              joins{" "}
              <span className="font-medium text-neutral-800">
                {selected?.name ?? "…"}
              </span>{" "}
              as{" "}
              <span className="font-medium capitalize text-neutral-800">
                {role}
              </span>
            </p>
            <p className="data-mono mt-4 border-t border-neutral-900/10 pt-4 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
              {ROLE_DESC[role]}
            </p>
          </PreviewPanel>
        </div>
      )}
    </div>
  );
}

export default InviteUser;
