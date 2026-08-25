/* ─────────────────────────────────────────────────────────────
   WORKSPACE INVITES — your inbox.
   Invites addressed to you, delivered as paper mail on the bezel.
   Accepting joins the workspace — which requires an online
   collector, so a device-gated invite explains what to do rather
   than just failing.
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
  InkNote,
  PaperInset,
  StripMeta,
  inkBtnClass,
} from "@/components/dashboard/Paper";
import {
  Avatar,
  EmptyState,
  Note,
  PageHeader,
  PaperRoleTag,
  Spinner,
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

  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });
  const hasAvatar = !!me.data?.user?.mapAvatarModel;

  const mutation = useMutation({
    mutationFn: (inviteId: string): Promise<WorkspaceSummary> =>
      http.invites.acceptById(inviteId),
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["invites", "received"] });
      if (hasAvatar) {
        navigate(`/world?workspaceId=${ws.id}`);
      } else {
        navigate(`/dashboard/avatar?workspaceId=${ws.id}`);
      }
    },
  });

  const invites = data ?? [];
  const pendingCount = invites.filter((i) => i.status === "pending").length;

  return (
    <div>
      <PageHeader
        eyebrow="Invites"
        meta={
          pendingCount > 0 ? (
            <StripMeta className="text-neutral-500">
              <span className="tabular-nums text-neutral-800">
                {pendingCount}
              </span>
              pending
            </StripMeta>
          ) : undefined
        }
        title={
          <>
            Waiting for you,{" "}
            <span className="italic text-neutral-400">sealed and sent.</span>
          </>
        }
        subtitle="Workspaces you've been invited to join."
      />

      {isError && (
        <Note tone="error">
          We couldn't load your invites. Refresh to try again.
        </Note>
      )}

      {isLoading && (
        <PaperInset>
          <div className="p-6">
            <div className="h-24 animate-pulse rounded-lg bg-neutral-900/[0.04]" />
          </div>
        </PaperInset>
      )}

      {!isLoading && !isError && invites.length === 0 && (
        <EmptyState
          icon={<FiInbox className="size-5" />}
          title="No invites right now."
          hint="When someone invites you to a workspace, it'll appear here."
        />
      )}

      {!isLoading && !isError && invites.length > 0 && (
        <div className="space-y-4">
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
      transition={{ duration: 0.45, ease: EASE, delay: 0.05 + index * 0.06 }}
    >
      <PaperInset
        grid={index === 0 && !expired}
        top={
          <>
            <StripMeta>
              <span className="uppercase tracking-[0.08em]">Invitation</span>
              <span className="text-neutral-300">·</span>
              <span>{invite.org.name}</span>
            </StripMeta>
            <StripMeta className={expired ? "text-rose-700" : undefined}>
              {expiryLabel(invite.expiresAt)}
            </StripMeta>
          </>
        }
      >
        <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-serif text-[24px] leading-none tracking-[-0.01em] text-neutral-950">
                {invite.workspace?.name ?? "Workspace"}
              </span>
              <PaperRoleTag role={invite.role} />
            </div>
            {invite.workspace?.description && (
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-neutral-600">
                {invite.workspace.description}
              </p>
            )}
            {invite.invitedBy && (
              <div className="mt-3.5 flex items-center gap-2 text-[12.5px] text-neutral-600">
                <span className="flex items-center gap-1 text-neutral-500">
                  <Avatar
                    name={invite.invitedBy.name}
                    src={invite.invitedBy.avatarUrl}
                    size={20}
                  />
                </span>
                <span>
                  Invited by{" "}
                  <span className="font-medium text-neutral-900">
                    {invite.invitedBy.name}
                  </span>
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className={
              expired
                ? "flex-shrink-0 cursor-not-allowed rounded-full px-5 py-2.5 text-[13px] font-medium text-neutral-400"
                : inkBtnClass
            }
            onClick={onAccept}
            disabled={pending || expired}
          >
            {expired ? (
              "Expired"
            ) : (
              <>
                {pending && <Spinner ink />}
                {pending ? "Joining…" : "Accept & join"}
              </>
            )}
          </button>
        </div>

        {error != null && (
          <div className="border-t border-neutral-900/10 px-5 py-3.5 sm:px-7">
            {deviceRequired ? (
              <InkNote className="border-transparent bg-transparent px-0 py-0">
                Joining needs an online collector on your machine — run{" "}
                <code className="rounded bg-neutral-900/[0.06] px-1.5 py-0.5 font-mono text-[11.5px]">
                  hive start
                </code>{" "}
                , then accept again.
              </InkNote>
            ) : (
              <Note tone="error" onPaper>
                {error instanceof ApiError
                  ? error.message
                  : "Something went wrong joining this workspace."}
              </Note>
            )}
          </div>
        )}
      </PaperInset>
    </motion.div>
  );
}

export default WorkspaceInvites;
