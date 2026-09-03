/* ─────────────────────────────────────────────────────────────
   WORKSPACE SETTINGS — identity, webhook secret, repositories,
   GitHub App, danger zone. Same data, dark instrument.
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
  Badge,
  Btn,
  Card,
  CardHead,
  ConfirmBtn,
  CopyField,
  Field,
  Note,
  PageHead,
  Spinner,
  inputClass,
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
          {notMember
            ? "This workspace doesn't exist or you're not a member."
            : "We couldn't load workspace settings."}
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

      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHead title="General" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (dirty) renameMutation.mutate();
            }}
            className="space-y-4 px-5 py-5"
          >
            <Field label="Name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </Field>
            <Field
              label="Description"
              hint="Optional — what this workspace is for."
            >
              <textarea
                className={`${inputClass} h-auto min-h-[80px] resize-y py-2.5`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </Field>
            <div className="flex justify-end">
              <Btn type="submit" disabled={!dirty || renameMutation.isPending}>
                {renameMutation.isPending && <Spinner />}
                Save changes
              </Btn>
            </div>
          </form>
        </Card>

        <Card>
          <CardHead
            title="Webhook secret"
            hint="Verifies GitHub webhooks for this workspace."
          />
          <div className="space-y-3 px-5 py-5">
            {revealedSecret ? (
              <>
                <CopyField value={revealedSecret} />
                <Note tone="info">
                  New secret generated. Copy it now — it won't be shown again.
                </Note>
              </>
            ) : (
              <>
                <code className="block truncate rounded-lg border border-neutral-900/10 bg-neutral-900/[0.04] px-3 py-2.5 font-mono text-[13px] text-neutral-500">
                  {data.webhookSecretMasked}
                </code>
                <p className="text-xs text-neutral-500">
                  The stored secret is masked. Rotate to generate — and copy — a
                  new one.
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
                    "size-4" + (rotateMutation.isPending ? " animate-spin" : "")
                  }
                  aria-hidden
                />
                {rotateMutation.isPending ? "Rotating…" : "Rotate"}
              </ConfirmBtn>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Repositories"
            hint="Push, PR, issue, release and review activity surfaces here."
          />
          <div className="px-5 py-5">
            {data.repositories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-900/15 px-3 py-3 text-[13px] text-neutral-500">
                No repositories linked yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {data.repositories.map((repo) => (
                  <li
                    key={repo.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-900/[0.08] bg-white px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-neutral-800">
                        {repo.fullName}
                      </p>
                      <p className="font-mono text-[11px] text-neutral-400">
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

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                className={`${inputClass} min-w-0 flex-1`}
                value={repositoryId}
                onChange={(e) => setRepositoryId(e.target.value)}
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
        </Card>

        <Card>
          <CardHead
            title="GitHub App"
            hint="Webhooks flow in automatically — no manual secret needed."
          />
          <div className="px-5 py-5">
            {(installations.data?.installations ?? []).length > 0 ? (
              <ul className="divide-y divide-neutral-900/[0.08]">
                {installations.data!.installations.map((inst) => (
                  <li
                    key={inst.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13px] font-medium text-neutral-800">
                        <FiGithub
                          className="size-4 text-neutral-500"
                          aria-hidden
                        />
                        GitHub App installed
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
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
              <div className="flex flex-wrap items-center gap-3">
                <Btn
                  onClick={() => installMutation.mutate()}
                  disabled={installMutation.isPending}
                >
                  {installMutation.isPending && <Spinner />}
                  Install GitHub App
                </Btn>
                {installations.isError && (
                  <span className="text-xs text-rose-700">
                    GitHub App isn't configured yet.
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card className="border-rose-600/25">
          <CardHead
            title="Danger zone"
            hint="Members, settings, and links are removed. Repos stay on GitHub."
          />
          <div className="space-y-4 px-5 py-5">
            <Field label={`Type "${data.name}" to confirm`}>
              <input
                className={inputClass}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={data.name}
                autoComplete="off"
              />
            </Field>
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
        </Card>
      </div>
    </div>
  );
}

export default WorkspaceSettings;
