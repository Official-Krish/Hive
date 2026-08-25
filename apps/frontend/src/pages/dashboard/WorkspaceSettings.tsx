/* ─────────────────────────────────────────────────────────────
   WORKSPACE SETTINGS — rename, description, webhook secret,
   repository assignment, and delete. Each group is its own
   bone instrument with a labelled strip; controls sit on paper.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiArrowLeft, FiCopy, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import {
  ApiError,
  http,
  type GitHubRepoOption,
  type WorkspaceSettings as WorkspaceSettingsData,
} from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import {
  PaperInset,
  StripMeta,
  inkBtnClass,
  paperGhostBtnClass,
  paperInputClass,
  paperLabelClass,
} from "@/components/dashboard/Paper";
import { Field, Note, PageHeader, Spinner } from "@/components/dashboard/ui";

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
      setRepositoryId(settings.data.repository?.id ?? "");
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
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () => http.workspaces.rotateSecret(workspaceId),
    onSuccess: (result) => {
      setRevealedSecret(result.secret);
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId, "settings"],
      });
    },
  });

  const assignRepoMutation = useMutation({
    mutationFn: (newRepoId: string) =>
      http.workspaces.assignRepo(workspaceId, newRepoId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceId, "settings"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => http.workspaces.remove(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate("/dashboard", { replace: true });
    },
  });

  if (settings.isLoading) {
    return (
      <div>
        <BackLink workspaceId={workspaceId} />
        <div className="flex items-center gap-2.5 text-neutral-500">
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
        <BackLink workspaceId={workspaceId} />
        <Note tone="error">
          {notMember
            ? "This workspace doesn't exist or you're not a member."
            : "We couldn't load workspace settings."}
        </Note>
      </div>
    );
  }

  const data: WorkspaceSettingsData = settings.data!;
  const canDelete = me.data?.user?.id && data.name === deleteConfirm;
  const dirty =
    data.name !== name.trim() ||
    (data.description ?? "") !== description.trim();

  return (
    <div>
      <BackLink workspaceId={workspaceId} />

      <PageHeader
        eyebrow="Settings"
        title={
          <>
            {data.name}
            <span className="italic text-neutral-400">, tuned.</span>
          </>
        }
        subtitle="Identity, the webhook secret, repository assignment, and the way out."
      />

      <motion.section {...fade(0.05)} className="max-w-2xl space-y-5">
        {/* general */}
        <PaperInset
          top={
            <StripMeta>
              <span className="uppercase tracking-[0.08em]">General</span>
            </StripMeta>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (dirty) renameMutation.mutate();
            }}
            className="space-y-5 px-5 py-6 sm:px-7"
          >
            <Field label="Name" htmlFor="set-name" labelClass={paperLabelClass}>
              <input
                id="set-name"
                className={paperInputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </Field>
            <Field
              label="Description"
              htmlFor="set-desc"
              hint="Optional — what this workspace is for."
              labelClass={paperLabelClass}
            >
              <textarea
                id="set-desc"
                className={`${paperInputClass} min-h-[80px] resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </Field>
            {renameMutation.isError && (
              <Note tone="error" onPaper>
                {renameMutation.error instanceof ApiError
                  ? renameMutation.error.message
                  : "Couldn't save changes."}
              </Note>
            )}
            {renameMutation.isSuccess && !renameMutation.isPending && (
              <Note tone="success" onPaper>
                Saved.
              </Note>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                className={inkBtnClass}
                disabled={!dirty || renameMutation.isPending}
              >
                {renameMutation.isPending && <Spinner ink />}
                Save changes
              </button>
            </div>
          </form>
        </PaperInset>

        {/* webhook secret */}
        <PaperInset
          top={
            <StripMeta>
              <span className="uppercase tracking-[0.08em]">
                Webhook secret
              </span>
            </StripMeta>
          }
        >
          <div className="px-5 py-6 sm:px-7">
            <p className="text-[12.5px] leading-relaxed text-neutral-600">
              Verifies GitHub webhooks for this workspace. Paste it into your
              repo's webhook settings.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-neutral-900/15 bg-white px-3.5 py-2.5 font-mono text-[12.5px] text-neutral-900">
                {revealedSecret ?? data.webhookSecretMasked}
              </code>
              <button
                type="button"
                aria-label="Copy secret"
                title="Copy"
                className={paperGhostBtnClass}
                onClick={() => {
                  const value = revealedSecret ?? data.webhookSecretMasked;
                  void navigator.clipboard.writeText(value);
                }}
              >
                <FiCopy className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={paperGhostBtnClass}
                onClick={() => rotateMutation.mutate()}
                disabled={rotateMutation.isPending}
              >
                <FiRefreshCw
                  className={
                    "size-4" + (rotateMutation.isPending ? " animate-spin" : "")
                  }
                  aria-hidden
                />
                {rotateMutation.isPending ? "Rotating…" : "Rotate"}
              </button>
            </div>
            {revealedSecret && (
              <div className="mt-3">
                <Note tone="info" onPaper>
                  New secret generated. Copy it now — it won't be shown again.
                </Note>
              </div>
            )}
            {rotateMutation.isError && (
              <div className="mt-3">
                <Note tone="error" onPaper>
                  {rotateMutation.error instanceof ApiError
                    ? rotateMutation.error.message
                    : "Couldn't rotate the secret."}
                </Note>
              </div>
            )}
          </div>
        </PaperInset>

        {/* repository */}
        <PaperInset
          top={
            <StripMeta>
              <span className="uppercase tracking-[0.08em]">Repository</span>
            </StripMeta>
          }
        >
          <div className="px-5 py-6 sm:px-7">
            <p className="text-[12.5px] leading-relaxed text-neutral-600">
              Assign a GitHub repo to this workspace, then configure its webhook
              on GitHub manually with the secret above.
            </p>
            {data.repository && (
              <p className="mt-3 rounded-xl border border-neutral-900/[0.08] bg-neutral-900/[0.02] px-3 py-2 text-[12.5px] text-neutral-600">
                Currently{" "}
                <span className="font-medium text-neutral-900">
                  {data.repository.fullName}
                </span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                className={`${paperInputClass} min-w-0 flex-1`}
                value={repositoryId}
                onChange={(e) => setRepositoryId(e.target.value)}
              >
                <option value="">— None —</option>
                {repoOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                    {r.private ? " · private" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={inkBtnClass}
                disabled={
                  assignRepoMutation.isPending ||
                  repositoryId === (data.repository?.id ?? "")
                }
                onClick={() => {
                  if (repositoryId) assignRepoMutation.mutate(repositoryId);
                }}
              >
                {assignRepoMutation.isPending && <Spinner ink />}
                Assign
              </button>
            </div>
            {assignRepoMutation.isError && (
              <div className="mt-3">
                <Note tone="error" onPaper>
                  {assignRepoMutation.error instanceof ApiError
                    ? assignRepoMutation.error.message
                    : "Couldn't assign the repository."}
                </Note>
              </div>
            )}
          </div>
        </PaperInset>

        {/* danger zone */}
        <PaperInset
          top={
            <StripMeta className="text-rose-800">
              <FiTrash2 className="size-3.5" aria-hidden />
              <span className="uppercase tracking-[0.08em]">Danger zone</span>
            </StripMeta>
          }
        >
          <div className="px-5 py-6 sm:px-7">
            <p className="text-[12.5px] leading-relaxed text-neutral-600">
              Deleting removes members, settings, and links. Repositories are
              unlinked but not deleted on GitHub.
            </p>
            <div className="mt-4">
              <Field
                label={`Type "${data.name}" to confirm`}
                htmlFor="del-confirm"
                labelClass={paperLabelClass}
              >
                <input
                  id="del-confirm"
                  className={paperInputClass}
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={data.name}
                  autoComplete="off"
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-700 px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canDelete || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending && <Spinner />}
                Delete workspace
              </button>
            </div>
            {deleteMutation.isError && (
              <div className="mt-3">
                <Note tone="error" onPaper>
                  {deleteMutation.error instanceof ApiError
                    ? deleteMutation.error.message
                    : "Couldn't delete the workspace."}
                </Note>
              </div>
            )}
          </div>
        </PaperInset>
      </motion.section>
    </div>
  );
}

function BackLink({ workspaceId }: { workspaceId: string }) {
  return (
    <Link
      to={`/dashboard/w/${workspaceId}`}
      className="group mb-7 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
    >
      <FiArrowLeft
        className="size-4 transition-transform group-hover:-translate-x-0.5"
        aria-hidden
      />
      Back to workspace
    </Link>
  );
}

export default WorkspaceSettings;
