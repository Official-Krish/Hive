/* ─────────────────────────────────────────────────────────────
   WORKSPACE INVITES — your inbox.
   Invites addressed to you. Accepting joins the workspace — which
   requires an online collector on your machine, so a device-gated
   invite explains what to do rather than just failing.
   ───────────────────────────────────────────────────────────── */
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiInbox } from "react-icons/fi";
import {
  ApiError,
  http,
  type ReceivedInvite,
  type WorkspaceSummary,
} from "@/lib/http";
import { EASE } from "@/components/dashboard/primitives";
import {
  Avatar,
  EmptyState,
  Note,
  PageHeader,
  Panel,
  RoleTag,
  Spinner,
  primaryBtnClass,
} from "@/components/dashboard/ui";

function expiryLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

export function WorkspaceInvites() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invites", "received"],
    queryFn: http.invites.listReceived,
  });

  const mutation = useMutation({
    mutationFn: (inviteId: string): Promise<WorkspaceSummary> =>
      http.invites.acceptById(inviteId),
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["invites", "received"] });
      navigate(`/dashboard/w/${ws.id}`);
    },
  });

  const invites = data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Workspace invites"
        title="Invites for you"
        subtitle="Workspaces you've been invited to join."
      />

      {isError && (
        <Note tone="error">
          We couldn't load your invites. Refresh to try again.
        </Note>
      )}

      {isLoading && (
        <Panel className="p-6">
          <div className="h-24 animate-pulse rounded-lg bg-white/[0.03]" />
        </Panel>
      )}

      {!isLoading && !isError && invites.length === 0 && (
        <EmptyState
          icon={<FiInbox className="size-5" />}
          title="No pending invites"
          hint="When someone invites you to a workspace, it'll appear here."
        />
      )}

      {!isLoading && !isError && invites.length > 0 && (
        <div className="space-y-3">
          {invites.map((invite, i) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              index={i}
              pending={mutation.isPending && mutation.variables === invite.id}
              error={
                mutation.isError && mutation.variables === invite.id
                  ? mutation.error
                  : null
              }
              onAccept={() => mutation.mutate(invite.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InviteRow({
  invite,
  index,
  pending,
  error,
  onAccept,
}: {
  invite: ReceivedInvite;
  index: number;
  pending: boolean;
  error: unknown;
  onAccept: () => void;
}) {
  const expired = invite.status !== "pending";
  const deviceRequired =
    error instanceof ApiError && error.code === "DEVICE_REQUIRED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.05 + index * 0.05 }}
    >
      <Panel className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="font-serif text-[21px] leading-none tracking-[-0.01em] text-white">
                {invite.workspace?.name ?? "Workspace"}
              </span>
              <RoleTag role={invite.role} />
            </div>
            <p className="mt-1.5 text-[13px] text-slate-500">
              in {invite.org.name} · {expiryLabel(invite.expiresAt)}
            </p>
            {invite.invitedBy && (
              <div className="mt-3 flex items-center gap-2 text-[12.5px] text-slate-400">
                <Avatar
                  name={invite.invitedBy.name}
                  src={invite.invitedBy.avatarUrl}
                  size={22}
                />
                <span>
                  Invited by{" "}
                  <span className="text-slate-200">
                    {invite.invitedBy.name}
                  </span>
                </span>
              </div>
            )}
          </div>

          <button
            className={primaryBtnClass}
            onClick={onAccept}
            disabled={pending || expired}
          >
            {pending && <Spinner />}
            {expired ? "Expired" : pending ? "Joining…" : "Accept & join"}
          </button>
        </div>

        {error != null && (
          <div className="mt-4">
            <Note tone={deviceRequired ? "info" : "error"}>
              {deviceRequired ? (
                <>
                  Joining a workspace needs an online collector on your machine.
                  Start the Hive collector, then accept again.
                </>
              ) : error instanceof ApiError ? (
                error.message
              ) : (
                "Something went wrong joining this workspace."
              )}
            </Note>
          </div>
        )}
      </Panel>
    </motion.div>
  );
}
