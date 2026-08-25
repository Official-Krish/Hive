/* ─────────────────────────────────────────────────────────────
   CREATE WORKSPACE — a short instrument, not a form dump.
   Identity first (name + description), then integrations
   (GitHub repo, webhook secret) below the hairline. The whole
   thing sits on the bone-paper bezel; on success you walk into
   the office.
   ───────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCopy, FiRefreshCw } from "react-icons/fi";
import {
  ApiError,
  http,
  type CreateWorkspaceInput,
  type GitHubRepoOption,
  type WorkspaceSummary,
} from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import {
  InkNote,
  LiveDot,
  PaperInset,
  StripMeta,
  inkBtnClass,
  paperGhostBtnClass,
  paperInputClass,
  paperLabelClass,
} from "@/components/dashboard/Paper";
import { Field, Note, PageHeader, Spinner } from "@/components/dashboard/ui";

function generateSecret(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function CreateWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [webhookSecret, setWebhookSecret] = useState(generateSecret);
  const [repositoryId, setRepositoryId] = useState("");

  const device = useQuery({
    queryKey: ["devices", "me", "status"],
    queryFn: http.devices.status,
    retry: false,
    staleTime: 30_000,
  });
  const hasDevice = device.data?.hasOnlineDevice ?? true;

  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });
  const hasAvatar = !!me.data?.user?.mapAvatarModel;

  const repos = useQuery({
    queryKey: ["github", "repos"],
    queryFn: http.github.listRepos,
    retry: false,
    staleTime: 60_000,
  });
  const repoOptions: GitHubRepoOption[] = repos.data?.repos ?? [];

  const mutation = useMutation({
    mutationFn: (): Promise<WorkspaceSummary> =>
      http.workspaces.create({
        name: name.trim(),
        description: description.trim() || undefined,
        webhookSecret: webhookSecret.trim(),
        ...(repositoryId ? { repositoryId } : {}),
      } satisfies CreateWorkspaceInput),
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      if (hasAvatar) {
        navigate(`/world?workspaceId=${ws.id}`);
      } else {
        navigate(`/dashboard/avatar?workspaceId=${ws.id}`);
      }
    },
  });

  const canSubmit =
    name.trim().length > 0 &&
    webhookSecret.trim().length >= 8 &&
    !mutation.isPending;

  const secretHint = useMemo(
    () =>
      webhookSecret.trim().length < 8
        ? "At least 8 characters. Used to verify GitHub webhooks for this workspace."
        : "Paste this into your GitHub repo's webhook settings.",
    [webhookSecret],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Create workspace"
        title={
          <>
            Start something{" "}
            <span className="italic text-neutral-400">together.</span>
          </>
        }
        subtitle="A workspace is where your team's activity comes together. You'll be its owner."
      />

      <motion.div {...fade(0.05)} className="max-w-2xl">
        <PaperInset
          grid
          top={
            <>
              <StripMeta>
                <span className="uppercase tracking-[0.08em]">
                  New workspace
                </span>
              </StripMeta>
              <StripMeta>
                <LiveDot tone={hasDevice ? "live" : "warn"} ping={hasDevice} />
                {hasDevice ? "Collector online" : "Collector offline"}
              </StripMeta>
            </>
          }
        >
          <form
            className="px-5 py-7 sm:px-7"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) mutation.mutate();
            }}
          >
            {/* identity */}
            <div className="space-y-5">
              <Field
                label="Name"
                htmlFor="ws-name"
                labelClass={paperLabelClass}
              >
                <input
                  id="ws-name"
                  className={paperInputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering"
                  maxLength={100}
                  autoFocus
                />
              </Field>

              <Field
                label="Description"
                htmlFor="ws-desc"
                hint="Optional — a short line on what this workspace is for."
                labelClass={paperLabelClass}
              >
                <textarea
                  id="ws-desc"
                  className={`${paperInputClass} min-h-[84px] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Product & platform engineering"
                  maxLength={500}
                />
              </Field>
            </div>

            {/* integrations */}
            <div className="my-7 h-px bg-neutral-900/[0.08]" />

            <div className="space-y-5">
              <Field
                label="Assign a GitHub repo"
                htmlFor="ws-repo"
                hint="Optional — links a repo to this workspace. Configure its webhook on GitHub with the secret below."
                labelClass={paperLabelClass}
              >
                <select
                  id="ws-repo"
                  className={paperInputClass}
                  value={repositoryId}
                  onChange={(e) => setRepositoryId(e.target.value)}
                >
                  <option value="">None — assign later</option>
                  {repoOptions.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.fullName}
                      {r.private ? " · private" : ""}
                    </option>
                  ))}
                </select>
                {repos.isError && (
                  <p className="mt-2 text-[12px] text-neutral-500">
                    Connect your GitHub account to assign a repo.
                  </p>
                )}
              </Field>

              <Field
                label="Webhook secret"
                htmlFor="ws-secret"
                hint={secretHint}
                labelClass={paperLabelClass}
              >
                <div className="flex items-center gap-2">
                  <input
                    id="ws-secret"
                    className={`${paperInputClass} font-mono text-[13px]`}
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    minLength={8}
                    maxLength={128}
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    aria-label="Regenerate secret"
                    title="Regenerate"
                    className={paperGhostBtnClass}
                    onClick={() => setWebhookSecret(generateSecret())}
                  >
                    <FiRefreshCw className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Copy secret"
                    title="Copy"
                    className={paperGhostBtnClass}
                    onClick={() =>
                      void navigator.clipboard.writeText(webhookSecret)
                    }
                  >
                    <FiCopy className="size-4" aria-hidden />
                  </button>
                </div>
              </Field>
            </div>

            {mutation.isError && (
              <div className="mt-5">
                <Note tone="error" onPaper>
                  {mutation.error instanceof ApiError
                    ? mutation.error.message
                    : "Something went wrong creating the workspace."}
                </Note>
              </div>
            )}

            {/* action row */}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              {!hasDevice && !device.isLoading ? (
                <InkNote className="max-w-xs border-transparent bg-transparent px-0">
                  Start your collector before entering the office.
                </InkNote>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  You'll be its owner
                </span>
              )}
              <button
                type="submit"
                className={inkBtnClass}
                disabled={!canSubmit}
              >
                {mutation.isPending && <Spinner ink />}
                {mutation.isPending ? "Creating…" : "Create workspace"}
              </button>
            </div>
          </form>
        </PaperInset>
      </motion.div>
    </div>
  );
}

export default CreateWorkspace;
