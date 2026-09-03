/* ─────────────────────────────────────────────────────────────
   CREATE WORKSPACE — step 1: identity. Step 2: connect GitHub.
   Same flow, dark instrument.
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
  Badge,
  Btn,
  Card,
  CardHead,
  Field,
  LiveDot,
  PageHead,
  Spinner,
  inputClass,
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

        <div className="max-w-2xl">
          <Card>
            <CardHead
              title="Install the Hive GitHub App"
              hint="Recommended — every linked repo's webhooks flow in automatically."
              right={
                <Btn onClick={startInstall} disabled={installing}>
                  {installing ? (
                    <Spinner />
                  ) : (
                    <FiGithub className="size-4" aria-hidden />
                  )}
                  {installing ? "Redirecting…" : "Install"}
                </Btn>
              }
            />
            <div className="px-5 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                Or link a single repo
              </p>

              {linkedRepos.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {linkedRepos.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-neutral-900/[0.08] bg-white px-3 py-2.5"
                    >
                      <span className="truncate font-mono text-[13px] text-neutral-700">
                        {r.fullName}
                      </span>
                      <Badge tone="live">Linked</Badge>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className={`${inputClass} min-w-0 flex-1`}
                  value={repositoryId}
                  onChange={(e) => setRepositoryId(e.target.value)}
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
          </Card>

          <div className="mt-5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              You're the owner
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

      <div className="max-w-2xl">
        <Card>
          <CardHead
            title="New workspace"
            right={
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-500">
                <LiveDot tone={hasDevice ? "live" : "away"} />
                {hasDevice ? "Collector online" : "Collector offline"}
              </span>
            }
          />
          <form
            className="space-y-4 px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) mutation.mutate();
            }}
          >
            <Field label="Name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering"
                maxLength={100}
                autoFocus
              />
            </Field>

            <Field
              label="Description"
              hint="Optional — a short line on what this workspace is for."
            >
              <textarea
                className={`${inputClass} h-auto min-h-[84px] resize-y py-2.5`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product & platform engineering"
                maxLength={500}
              />
            </Field>

            <Field label="Webhook secret" hint={secretHint}>
              <div className="flex items-center gap-2">
                <input
                  className={`${inputClass} font-mono text-[13px]`}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  spellCheck={false}
                />
                <Btn
                  variant="ghost"
                  className="h-10 px-3"
                  aria-label="Regenerate secret"
                  onClick={() => setWebhookSecret(generateSecret())}
                >
                  <FiRefreshCw className="size-4" aria-hidden />
                </Btn>
                <Btn
                  variant="ghost"
                  className="h-10 px-3"
                  aria-label="Copy secret"
                  onClick={() => {
                    void navigator.clipboard.writeText(webhookSecret);
                    notifyInfo("Webhook secret copied to clipboard");
                  }}
                >
                  <FiCopy className="size-4" aria-hidden />
                </Btn>
              </div>
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {!hasDevice && !device.isLoading ? (
                <p className="font-mono text-[11px] text-amber-800">
                  Start your collector before entering the office.
                </p>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  You'll be its owner
                </span>
              )}
              <Btn type="submit" disabled={!canSubmit}>
                {mutation.isPending && <Spinner />}
                {mutation.isPending ? "Creating…" : "Create workspace"}
              </Btn>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default CreateWorkspace;
