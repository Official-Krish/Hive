/* ─────────────────────────────────────────────────────────────
   CREATE WORKSPACE — step 1 sets the identity, step 2 connects
   GitHub. The GitHub App install is the recommended path (it
   wires every repo at once); a manual repo link is the fallback.
   ───────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiCopy, FiGithub, FiRefreshCw } from "react-icons/fi";
import {
  ApiError,
  http,
  type CreateWorkspaceInput,
  type GitHubRepoOption,
  type WorkspaceSummary,
} from "@/lib/http";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/toast";
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
import { Field, PageHeader, Spinner } from "@/components/dashboard/ui";

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
  const [createdWs, setCreatedWs] = useState<WorkspaceSummary | null>(null);
  const [linkedRepos, setLinkedRepos] = useState<GitHubRepoOption[]>([]);
  const [installing, setInstalling] = useState(false);

  const device = useQuery({
    queryKey: ["devices", "me", "status"],
    queryFn: http.devices.status,
    retry: false,
    staleTime: 30_000,
  });
  const hasDevice = device.data?.hasOnlineDevice ?? true;

  const repos = useQuery({
    queryKey: ["github", "repos"],
    queryFn: http.github.listRepos,
    retry: false,
    staleTime: 60_000,
    enabled: createdWs !== null,
  });
  const repoOptions: GitHubRepoOption[] = repos.data?.repos ?? [];
  const linkedNames = new Set(linkedRepos.map((r) => r.fullName));

  const mutation = useMutation({
    mutationFn: (): Promise<WorkspaceSummary> =>
      http.workspaces.create({
        name: name.trim(),
        description: description.trim() || undefined,
        webhookSecret: webhookSecret.trim(),
      } satisfies CreateWorkspaceInput),
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      notifySuccess(`Workspace "${ws.name}" created`);
      setCreatedWs(ws);
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong creating the workspace.",
      ),
  });

  const linkMutation = useMutation({
    mutationFn: (repoId: string) =>
      http.workspaces.linkRepository(createdWs!.id, repoId),
    onSuccess: (_data, repoId) => {
      const r = repoOptions.find((o) => String(o.id) === repoId);
      if (r) setLinkedRepos((prev) => [...prev, r]);
      setRepositoryId("");
      notifySuccess("Repository linked");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't link the repository.",
      ),
  });

  const startInstall = async () => {
    if (!createdWs) return;
    try {
      setInstalling(true);
      const { url } = await http.github.installUrl(createdWs.id);
      window.location.href = url;
    } catch (err) {
      setInstalling(false);
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Couldn't start the GitHub App install.",
      );
    }
  };

  const canSubmit =
    name.trim().length > 0 &&
    webhookSecret.trim().length >= 8 &&
    !mutation.isPending;

  const secretHint = useMemo(
    () =>
      webhookSecret.trim().length < 8
        ? "At least 8 characters. Used to verify GitHub webhooks for this workspace."
        : "Paste this into your GitHub repo's webhook settings (or skip it — the App handles this for you).",
    [webhookSecret],
  );

  /* ── Step 2: connect GitHub ──────────────────────────────── */
  if (createdWs) {
    return (
      <div>
        <PageHeader
          eyebrow="Connect GitHub"
          title={
            <>
              Bring <span className="italic text-neutral-400">activity</span> to{" "}
              {createdWs.name}.
            </>
          }
          subtitle="Install the Hive GitHub App to stream push, PR, issue, release and review events — or link a single repo manually."
        />

        <motion.div {...fade(0.05)} className="max-w-2xl">
          <PaperInset
            grid
            top={
              <StripMeta>
                <span className="uppercase tracking-[0.08em]">Recommended</span>
              </StripMeta>
            }
          >
            <div className="px-5 py-7 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-neutral-900">
                    Install the Hive GitHub App
                  </p>
                  <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-neutral-600">
                    Grants this workspace access to the repos you choose. Every
                    linked repo's webhooks flow in automatically — no manual
                    secret needed.
                  </p>
                </div>
                <button
                  type="button"
                  className={inkBtnClass}
                  onClick={startInstall}
                  disabled={installing}
                >
                  {installing ? (
                    <Spinner ink />
                  ) : (
                    <FiGithub className="size-4" aria-hidden />
                  )}
                  {installing ? "Redirecting…" : "Install GitHub App"}
                </button>
              </div>

              <div className="my-7 h-px bg-neutral-900/[0.08]" />

              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                Or link a single repo
              </p>

              {linkedRepos.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {linkedRepos.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-neutral-900/[0.08] bg-neutral-900/[0.02] px-3 py-2.5"
                    >
                      <span className="truncate text-[13px] font-medium text-neutral-900">
                        {r.fullName}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        Linked
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  id="ws-repo"
                  className={`${paperInputClass} min-w-0 flex-1`}
                  value={repositoryId}
                  onChange={(e) => setRepositoryId(e.target.value)}
                >
                  <option value="">— Choose a repository —</option>
                  {repoOptions
                    .filter((r) => !linkedNames.has(r.fullName))
                    .map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {r.fullName}
                        {r.private ? " · private" : ""}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className={inkBtnClass}
                  disabled={linkMutation.isPending || !repositoryId}
                  onClick={() => {
                    if (repositoryId) linkMutation.mutate(repositoryId);
                  }}
                >
                  {linkMutation.isPending && <Spinner ink />}
                  Link
                </button>
              </div>
              {repos.isError && (
                <p className="mt-2 text-[12px] text-neutral-500">
                  Connect your GitHub account to link a repo manually.
                </p>
              )}
            </div>
          </PaperInset>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              You're the owner
            </span>
            <button
              type="button"
              className={paperGhostBtnClass}
              onClick={() => navigate(`/dashboard/w/${createdWs.id}`)}
            >
              Enter workspace →
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Step 1: identity ────────────────────────────────────── */
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
                    onClick={() => {
                      void navigator.clipboard.writeText(webhookSecret);
                      notifyInfo("Webhook secret copied to clipboard");
                    }}
                  >
                    <FiCopy className="size-4" aria-hidden />
                  </button>
                </div>
              </Field>
            </div>

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
