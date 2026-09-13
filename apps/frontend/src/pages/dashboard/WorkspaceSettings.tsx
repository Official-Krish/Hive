/* ─────────────────────────────────────────────────────────────
   WORKSPACE SETTINGS — one continuous scroll. Identity, secret,
   repositories, GitHub App, and the way out in tonal zones.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiGithub, FiRefreshCw } from "react-icons/fi";
import {
  ApiError,
  http,
  type GitHubRepoOption,
  type WorkspaceSettings as WorkspaceSettingsData,
} from "@/lib/http";
import {
  BackLink,
  BaselineField,
  Badge,
  Btn,
  ConfirmBtn,
  CopyField,
  Note,
  PageHead,
  Spinner,
  ToneZone,
  baselineInputClass,
} from "@/components/dashboard/kit";
import { notifyError, notifySuccess } from "@/lib/toast";

export function WorkspaceSettings() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ["workspace", workspaceId, "settings"],
    queryFn: () => http.workspaces.getSettings(workspaceId),
    enabled: workspaceId.length > 0,
    retry: false,
  });

  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      setName(settings.data.name);
      setDescription(settings.data.description ?? "");
    }
  }, [settings.data]);

  const repos = useQuery({
    queryKey: ["github", "repos"],
    queryFn: http.github.listRepos,
    retry: false,
    staleTime: 60_000,
  });
  const repoOptions: GitHubRepoOption[] = repos.data?.repos ?? [];

  const renameMutation = useMutation({
    mutationFn: () =>
      http.workspaces.update(workspaceId, {
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId, "settings"],
      });
      notifySuccess("Changes saved");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't save changes.",
      ),
  });

  const rotateMutation = useMutation({
    mutationFn: () => http.workspaces.rotateSecret(workspaceId),
    onSuccess: (result) => {
      setRevealedSecret(result.secret);
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId, "settings"],
      });
      notifySuccess("New webhook secret generated");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't rotate the secret.",
      ),
  });

  const linkRepoMutation = useMutation({
    mutationFn: (newRepoId: string) =>
      http.workspaces.linkRepository(workspaceId, newRepoId),
    onSuccess: () => {
      setRepositoryId("");
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId, "settings"],
      });
      notifySuccess("Repository linked");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't link the repository.",
      ),
  });

  const unlinkRepoMutation = useMutation({
    mutationFn: (repoId: string) =>
      http.workspaces.unlinkRepository(workspaceId, repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId, "settings"],
      });
      notifySuccess("Repository unlinked");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Couldn't unlink the repository.",
      ),
  });

  const reviewToggleMutation = useMutation({
    mutationFn: ({ repoId, enabled }: { repoId: string; enabled: boolean }) =>
      http.workspaces.setRepoReview(workspaceId, repoId, enabled),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId, "settings"],
      });
      notifySuccess(
        vars.enabled ? "Reviewer enabled for repo" : "Reviewer muted for repo",
      );
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Couldn't update reviewer setting.",
      ),
  });

  const installations = useQuery({
    queryKey: ["github", "installations", workspaceId],
    queryFn: () => http.github.listInstallations(workspaceId),
    enabled: workspaceId.length > 0,
    retry: false,
    staleTime: 60_000,
  });

  const installMutation = useMutation({
    mutationFn: async () => {
      const { url } = await http.github.installUrl(workspaceId);
      window.location.href = url;
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't start the install.",
      ),
  });

  const removeInstallMutation = useMutation({
    mutationFn: (installationDbId: string) =>
      http.github.deleteInstallation(workspaceId, installationDbId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["github", "installations", workspaceId],
      });
      notifySuccess("GitHub App uninstalled");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Couldn't uninstall the GitHub App.",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () => http.workspaces.remove(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate("/dashboard", { replace: true });
      notifySuccess("Workspace deleted");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Couldn't delete the workspace.",
      ),
  });

  if (settings.isLoading) {
    return (
      <div>
        <BackLink to={`/dashboard/w/${workspaceId}`}>
          Back to workspace
        </BackLink>
        <div className="flex items-center gap-2.5 text-sm text-neutral-500">
          <Spinner /> Loading settings…
        </div>
      </div>
    );
  }

  if (settings.isError) {
    const notMember =
      settings.error instanceof ApiError && settings.error.status === 404;
    return (
      <div>
        <BackLink to={`/dashboard/w/${workspaceId}`}>
          Back to workspace
        </BackLink>
        <Note tone="error">
          <span className="flex flex-wrap items-center gap-3">
            <span>
              {notMember
                ? "This workspace doesn't exist or you're not a member."
                : "We couldn't load workspace settings."}
            </span>
            <Btn variant="ghost" onClick={() => settings.refetch()}>
              Retry
            </Btn>
          </span>
        </Note>
      </div>
    );
  }

  const data: WorkspaceSettingsData = settings.data!;
  const linkedFullNames = new Set(
    data.repositories.map((r) => r.fullName).filter(Boolean) as string[],
  );
  const canDelete = !!me.data?.user?.id && data.name === deleteConfirm;
  const dirty =
    data.name !== name.trim() ||
    (data.description ?? "") !== description.trim();

  return (
    <div>
      <BackLink to={`/dashboard/w/${workspaceId}`}>Back to workspace</BackLink>

      <PageHead
        eyebrow="Settings"
        title={data.name}
        sub="Identity, the webhook secret, linked repositories, and the way out."
      />

      <div className="grid items-start gap-10 lg:grid-cols-[160px_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="hidden lg:block lg:sticky lg:top-8"
        >
          <div className="space-y-1">
            {[
              ["general", "General"],
              ["secret", "Secret"],
              ["repos", "Repositories"],
              ["app", "GitHub App"],
              ["danger", "Danger"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="block rounded-lg px-3 py-1.5 text-[13px] text-neutral-500 transition-colors hover:bg-neutral-900/[0.04] hover:text-neutral-900"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="max-w-2xl space-y-14">
          <section id="general" aria-label="General" className="scroll-mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              General
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (dirty) renameMutation.mutate();
              }}
              className="mt-4 space-y-7"
            >
              <BaselineField label="Name">
                <input
                  className={baselineInputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </BaselineField>
              <BaselineField
                label="Description"
                hint="Optional — what this workspace is for."
              >
                <textarea
                  className={`${baselineInputClass} min-h-[80px] resize-y`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                />
              </BaselineField>
              <div className="flex justify-end">
                <Btn
                  type="submit"
                  disabled={!dirty || renameMutation.isPending}
                >
                  {renameMutation.isPending && <Spinner />}
                  Save changes
                </Btn>
              </div>
            </form>
          </section>

          <section
            id="secret"
            aria-label="Webhook secret"
            className="scroll-mt-8"
          >
            <ToneZone>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                Webhook secret
              </p>
              <p className="mt-2 text-[13px] text-neutral-500">
                Verifies GitHub webhooks for this workspace.
              </p>
              <div className="mt-4 space-y-3">
                {revealedSecret ? (
                  <>
                    <CopyField value={revealedSecret} />
                    <Note tone="info">
                      New secret generated. Copy it now — it won&apos;t be shown
                      again.
                    </Note>
                  </>
                ) : (
                  <>
                    <code className="data-mono block truncate rounded-lg bg-neutral-900/[0.05] px-3 py-2.5 text-[13px] text-neutral-500">
                      {data.webhookSecretMasked}
                    </code>
                    <p className="text-xs text-neutral-500">
                      The stored secret is masked. Rotate to generate — and copy
                      — a new one.
                    </p>
                  </>
                )}
                <div className="flex justify-end">
                  <ConfirmBtn
                    variant="ghost"
                    confirmLabel="Rotate secret"
                    pending={rotateMutation.isPending}
                    onConfirm={() => rotateMutation.mutate()}
                  >
                    <FiRefreshCw
                      className={
                        "size-4" +
                        (rotateMutation.isPending ? " animate-spin" : "")
                      }
                      aria-hidden
                    />
                    {rotateMutation.isPending ? "Rotating…" : "Rotate"}
                  </ConfirmBtn>
                </div>
              </div>
            </ToneZone>
          </section>

          <section id="repos" aria-label="Repositories" className="scroll-mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              Repositories
            </p>
            <p className="mt-2 text-[13px] text-neutral-500">
              Push, PR, issue, release and review activity surfaces here.
            </p>
            <div className="mt-4">
              {data.repositories.length === 0 ? (
                <p className="border-t border-neutral-900/10 py-4 text-[13px] text-neutral-500">
                  No repositories linked yet.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
                  {data.repositories.map((repo) => (
                    <li
                      key={repo.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-neutral-800">
                          {repo.fullName}
                        </p>
                        <p className="data-mono text-[11px] uppercase tracking-[0.08em] text-neutral-400">
                          {repo.provider}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {repo.url && (
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open on GitHub"
                            title="Open on GitHub"
                            className="flex size-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-900/[0.05] hover:text-neutral-900"
                          >
                            <FiGithub className="size-4" aria-hidden />
                          </a>
                        )}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={repo.reviewEnabled !== false}
                          title={
                            repo.reviewEnabled !== false
                              ? "Reviewer on — click to mute"
                              : "Reviewer muted — click to enable"
                          }
                          disabled={reviewToggleMutation.isPending}
                          onClick={() =>
                            reviewToggleMutation.mutate({
                              repoId: repo.id,
                              enabled: !(repo.reviewEnabled !== false),
                            })
                          }
                          className={
                            repo.reviewEnabled !== false
                              ? "flex h-6 w-11 items-center rounded-full bg-emerald-600 px-0.5 transition-colors"
                              : "flex h-6 w-11 items-center rounded-full bg-neutral-900/15 px-0.5 transition-colors"
                          }
                        >
                          <span
                            className={
                              repo.reviewEnabled !== false
                                ? "ml-auto size-5 rounded-full bg-white shadow"
                                : "size-5 rounded-full bg-white shadow"
                            }
                          />
                        </button>
                        <span className="hidden font-mono text-[10px] uppercase tracking-wide text-neutral-400 sm:inline">
                          reviewer
                        </span>
                        <ConfirmBtn
                          variant="ghost"
                          confirmLabel="Unlink"
                          pending={unlinkRepoMutation.isPending}
                          onConfirm={() => unlinkRepoMutation.mutate(repo.id)}
                        >
                          Unlink
                        </ConfirmBtn>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <select
                  className={`${baselineInputClass} min-w-0 flex-1`}
                  value={repositoryId}
                  onChange={(e) => setRepositoryId(e.target.value)}
                  aria-label="Add a repository"
                >
                  <option value="">Add a repository…</option>
                  {repoOptions
                    .filter((r) => !linkedFullNames.has(r.fullName))
                    .map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {r.fullName}
                        {r.private ? " · private" : ""}
                      </option>
                    ))}
                </select>
                <Btn
                  disabled={linkRepoMutation.isPending || !repositoryId}
                  onClick={() => {
                    if (repositoryId) linkRepoMutation.mutate(repositoryId);
                  }}
                >
                  {linkRepoMutation.isPending && <Spinner />}
                  Link
                </Btn>
              </div>
            </div>
          </section>

          <section id="app" aria-label="GitHub App" className="scroll-mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              GitHub App
            </p>
            <p className="mt-2 text-[13px] text-neutral-500">
              Webhooks flow in automatically — no manual secret needed.
            </p>
            <div className="mt-4">
              {(installations.data?.installations ?? []).length > 0 ? (
                <ul className="divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
                  {installations.data!.installations.map((inst) => (
                    <li
                      key={inst.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13px] font-medium text-neutral-800">
                          <FiGithub
                            className="size-4 text-neutral-500"
                            aria-hidden
                          />
                          GitHub App installed
                        </p>
                        <p className="data-mono mt-0.5 text-[11px] tabular-nums text-neutral-500">
                          {inst.repositoryCount}{" "}
                          {inst.repositoryCount === 1
                            ? "repository"
                            : "repositories"}
                        </p>
                      </div>
                      <ConfirmBtn
                        variant="ghost"
                        confirmLabel="Uninstall"
                        pending={removeInstallMutation.isPending}
                        onConfirm={() => removeInstallMutation.mutate(inst.id)}
                      >
                        Uninstall
                      </ConfirmBtn>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-wrap items-center gap-3 border-t border-neutral-900/10 py-4">
                  <Btn
                    onClick={() => installMutation.mutate()}
                    disabled={installMutation.isPending}
                  >
                    {installMutation.isPending && <Spinner />}
                    Install GitHub App
                  </Btn>
                  {installations.isError && (
                    <span className="text-xs text-rose-700">
                      GitHub App isn&apos;t configured yet.
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          <section id="danger" aria-label="Danger zone" className="scroll-mt-8">
            <ToneZone tone="danger">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-800">
                Danger zone
              </p>
              <p className="mt-2 text-[13px] text-neutral-600">
                Members, settings, and links are removed. Repos stay on GitHub.
              </p>
              <div className="mt-4 space-y-4">
                <BaselineField label={`Type "${data.name}" to confirm`}>
                  <input
                    className={baselineInputClass}
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={data.name}
                    autoComplete="off"
                  />
                </BaselineField>
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="danger">Irreversible</Badge>
                  <Btn
                    variant="danger"
                    disabled={!canDelete || deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                  >
                    {deleteMutation.isPending && <Spinner />}
                    Delete workspace
                  </Btn>
                </div>
              </div>
            </ToneZone>
          </section>
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-neutral-950 py-2 pl-5 pr-2 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]">
            <span className="text-[13px] font-medium">
              Unsaved name changes
            </span>
            <Btn
              variant="ghost"
              className="border-white/20 bg-white text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950"
              disabled={renameMutation.isPending}
              onClick={() => renameMutation.mutate()}
            >
              {renameMutation.isPending && <Spinner />}
              Save
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceSettings;
