/* ─────────────────────────────────────────────────────────────
   CREATE WORKSPACE — a short form.
   Name + optional description. On success it opens the new
   workspace's detail. (Frontend only — the create route already
   exists on the backend.)
   ───────────────────────────────────────────────────────────── */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, http, type WorkspaceSummary } from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import {
  Field,
  Note,
  PageHeader,
  Panel,
  Spinner,
  inputClass,
  primaryBtnClass,
} from "@/components/dashboard/ui";

export function CreateWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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

  const mutation = useMutation({
    mutationFn: (): Promise<WorkspaceSummary> =>
      http.workspaces.create({
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      if (hasAvatar) {
        navigate(`/world?workspaceId=${ws.id}`);
      } else {
        navigate(`/dashboard/avatar?workspaceId=${ws.id}`);
      }
    },
  });

  const canSubmit = name.trim().length > 0 && !mutation.isPending;

  return (
    <div>
      <PageHeader
        eyebrow="Create workspace"
        title="Start a new workspace"
        subtitle="A workspace is where a team's activity is collected. You'll be its owner."
      />

      <Panel className="max-w-xl p-6 sm:p-7">
        <motion.form
          {...fade(0.05)}
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          <Field label="Name" htmlFor="ws-name">
            <input
              id="ws-name"
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
            htmlFor="ws-desc"
            hint="Optional — a short line on what this workspace is for."
          >
            <textarea
              id="ws-desc"
              className={`${inputClass} min-h-[84px] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product & platform engineering"
              maxLength={500}
            />
          </Field>

          {mutation.isError && (
            <Note tone="error">
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : "Something went wrong creating the workspace."}
            </Note>
          )}

          {!hasDevice && !device.isLoading && (
            <Note tone="info">
              Start your Hive collector to enter the spatial office. Run{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-white">
                hive start
              </code>{" "}
              on your machine. Workspace creation still works — you'll just need
              the collector before you can move your avatar around.
            </Note>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className={primaryBtnClass}
              disabled={!canSubmit}
            >
              {mutation.isPending && <Spinner />}
              {mutation.isPending ? "Creating…" : "Create workspace"}
            </button>
          </div>
        </motion.form>
      </Panel>
    </div>
  );
}
