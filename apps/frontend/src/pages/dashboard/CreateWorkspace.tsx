/* ─────────────────────────────────────────────────────────────
   CREATE WORKSPACE — guided sequence. Step 1: identity with a live
   preview. Step 2: connect GitHub. Quiet canvas, no boxes.
   ───────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiArrowRight, FiCopy, FiGithub, FiRefreshCw } from "react-icons/fi";
import {
  ApiError,
  http,
  type CreateWorkspaceInput,
  type GitHubRepoOption,
  type WorkspaceSummary,
} from "@/lib/http";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/toast";
import {
  BaselineField,
  Btn,
  LiveDot,
  PageHead,
  PreviewPanel,
  Spinner,
  Stepspine,
  ToneZone,
  baselineInputClass,
} from "@/components/dashboard/kit";

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
    mutationFn: (repoId: string) => {
      if (!createdWs) throw new Error("No workspace");
      return http.workspaces.linkRepository(createdWs.id, repoId);
    },
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
        ? "At least 8 characters. Used to verify GitHub webhooks."
        : "Paste this into your repo's webhook settings — or skip it, the App handles this.",
    [webhookSecret],
  );

  /* ── Step 2: connect GitHub ──────────────────────────────── */
  if (createdWs) {
    return (
      <div>
        <PageHead
          eyebrow="Create workspace · Step 2 of 2"
          title={`Bring activity to ${createdWs.name}`}
          sub="Install the Hive GitHub App to stream push, PR, issue, release and review events — or link a single repo manually."
        />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <Stepspine steps={["Identity", "Connect"]} current={1} />

            <ToneZone className="mt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-neutral-900">
                    Install the Hive GitHub App
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Recommended — every linked repo&apos;s webhooks flow in
                    automatically.
                  </p>
                </div>
                <Btn onClick={startInstall} disabled={installing}>
                  {installing ? (
                    <Spinner />
                  ) : (
                    <FiGithub className="size-4" aria-hidden />
                  )}
                  {installing ? "Redirecting…" : "Install"}
                </Btn>
              </div>
            </ToneZone>

            <div className="mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                Or link a single repo
              </p>

              {linkedRepos.length > 0 && (
                <ul className="mt-3 divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
                  {linkedRepos.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="data-mono truncate text-[13px] text-neutral-700">
                        {r.fullName}
                      </span>
                      <span className="data-mono flex-shrink-0 text-[11px] uppercase tracking-[0.12em] text-emerald-700">
                        Linked
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className={baselineInputClass}
                  value={repositoryId}
                  onChange={(e) => setRepositoryId(e.target.value)}
                  aria-label="Choose a repository"
                >
                  <option value="">Choose a repository…</option>
                  {repoOptions
                    .filter((r) => !linkedNames.has(r.fullName))
                    .map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {r.fullName}
                        {r.private ? " · private" : ""}
                      </option>
                    ))}
                </select>
                <Btn
                  disabled={linkMutation.isPending || !repositoryId}
                  onClick={() => {
                    if (repositoryId) linkMutation.mutate(repositoryId);
                  }}
                >
                  {linkMutation.isPending && <Spinner />}
                  Link
                </Btn>
              </div>
              {repos.isError && (
                <p className="mt-2 text-xs text-neutral-500">
                  Connect your GitHub account to link a repo manually.
                </p>
              )}
            </div>

            <div className="mt-10 flex items-center justify-between border-t border-neutral-900/10 pt-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                You&apos;re the owner
              </span>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/w/${createdWs.id}`)}
                className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
              >
                Enter workspace
                <FiArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          <PreviewPanel label="Taking shape">
            <p className="truncate text-xl font-bold tracking-tight text-neutral-900">
              {createdWs.name}
            </p>
            <p className="data-mono mt-2 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
              Owner · just created
            </p>
            <div className="mt-4 border-t border-neutral-900/10 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                Linked repos · {linkedRepos.length}
              </p>
              {linkedRepos.length === 0 ? (
                <p className="mt-2 text-[13px] text-neutral-500">
                  None yet — install the App or link one manually.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {linkedRepos.map((r) => (
                    <li
                      key={r.id}
                      className="data-mono truncate text-[12px] text-neutral-700"
                    >
                      {r.fullName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PreviewPanel>
        </div>
      </div>
    );
  }

  /* ── Step 1: identity ────────────────────────────────────── */
  return (
    <div>
      <PageHead
        eyebrow="Create workspace · Step 1 of 2"
        title="Start something together"
        sub="A workspace is where your team's activity comes together. You'll be its owner."
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <Stepspine steps={["Identity", "Connect"]} current={0} />

          <form
            className="mt-2 space-y-7"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) mutation.mutate();
            }}
          >
            <BaselineField label="Name">
              <input
                className={baselineInputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering"
                maxLength={100}
                autoFocus
              />
            </BaselineField>

            <BaselineField
              label="Description"
              hint="Optional — a short line on what this workspace is for."
            >
              <textarea
                className={`${baselineInputClass} min-h-[84px] resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product & platform engineering"
                maxLength={500}
              />
            </BaselineField>

            <BaselineField label="Webhook secret" hint={secretHint}>
              <div className="flex items-center gap-1">
                <input
                  className={`${baselineInputClass} data-mono font-mono text-[13px]`}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  spellCheck={false}
                />
                <Btn
                  variant="quiet"
                  className="px-2"
                  aria-label="Regenerate secret"
                  onClick={() => setWebhookSecret(generateSecret())}
                >
                  <FiRefreshCw className="size-4" aria-hidden />
                </Btn>
                <Btn
                  variant="quiet"
                  className="px-2"
                  aria-label="Copy secret"
                  onClick={() => {
                    void navigator.clipboard.writeText(webhookSecret);
                    notifyInfo("Webhook secret copied to clipboard");
                  }}
                >
                  <FiCopy className="size-4" aria-hidden />
                </Btn>
              </div>
            </BaselineField>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-900/10 pt-5">
              {!hasDevice && !device.isLoading ? (
                <p className="font-mono text-[11px] text-amber-800">
                  Start your collector before entering the office.
                </p>
              ) : (
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-500">
                  <LiveDot tone={hasDevice ? "live" : "away"} />
                  {hasDevice ? "Collector online" : "Collector offline"}
                </span>
              )}
              <Btn type="submit" disabled={!canSubmit}>
                {mutation.isPending && <Spinner />}
                {mutation.isPending ? "Creating…" : "Create workspace"}
              </Btn>
            </div>
          </form>
        </div>

        <PreviewPanel label="Preview">
          <p className="truncate text-xl font-bold tracking-tight text-neutral-900">
            {name.trim() || "Untitled workspace"}
          </p>
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-neutral-500">
            {description.trim() || "No description yet."}
          </p>
          <p className="data-mono mt-4 border-t border-neutral-900/10 pt-4 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
            Owner · you
          </p>
        </PreviewPanel>
      </div>
    </div>
  );
}

export default CreateWorkspace;
