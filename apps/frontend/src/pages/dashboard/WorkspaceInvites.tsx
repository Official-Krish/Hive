/* ─────────────────────────────────────────────────────────────
   INVITES — your inbox. Accept stays on the page so you can work
   through several. Same data, dark instrument.
   ───────────────────────────────────────────────────────────── */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, http, type ReceivedInvite } from "@/lib/http";
import { notifyError, notifySuccess } from "@/lib/toast";
import {
  Avatar,
  Badge,
  Btn,
  Card,
  Empty,
  Note,
  PageHead,
  RoleBadge,
  SkeletonRows,
  Spinner,
} from "@/components/dashboard/kit";

function expiryLabel(invite: ReceivedInvite): string {
  if (invite.status !== "pending") {
    return invite.status === "accepted" ? "Accepted" : "No longer valid";
  }
  const ms = new Date(invite.expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

export function WorkspaceInvites() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invites", "received"],
    queryFn: http.invites.listReceived,
  });

  const mutation = useMutation({
    mutationFn: (inviteId: string) => http.invites.acceptById(inviteId),
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["invites", "received"] });
      notifySuccess(`Joined "${ws.name}".`);
    },
    onError: (err) => {
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong accepting this invite.",
      );
    },
  });

  const invites = data ?? [];
  const pendingCount = invites.filter((i) => i.status === "pending").length;

  return (
    <div>
      <PageHead
        eyebrow="Invites"
        meta={
          pendingCount > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-neutral-500">
              {pendingCount} pending
            </span>
          ) : undefined
        }
        title="Waiting for you"
        sub="Workspaces you've been invited to join."
      />

      {isError && (
        <div className="mb-6">
          <Note tone="error">
            We couldn't load your invites. Refresh to try again.
          </Note>
        </div>
      )}

      {isLoading && <SkeletonRows rows={3} />}

      {!isLoading && !isError && invites.length === 0 && (
        <Empty
          title="No invites right now"
          hint="When someone invites you to a workspace, it'll appear here."
        />
      )}

      {!isLoading && !isError && invites.length > 0 && (
        <div className="max-w-2xl space-y-3">
          {invites.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              pending={mutation.isPending && mutation.variables === invite.id}
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
  pending,
  onAccept,
}: {
  invite: ReceivedInvite;
  pending: boolean;
  onAccept: () => void;
}) {
  const active = invite.status === "pending";

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-neutral-900/[0.08] px-5 py-2.5">
        <span className="truncate font-mono text-[11px] text-neutral-400">
          {invite.org.name}
        </span>
        <span className="flex-shrink-0 font-mono text-[11px] text-neutral-400">
          {expiryLabel(invite)}
        </span>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[18px] font-semibold tracking-[-0.01em] text-neutral-900">
              {invite.workspace?.name ?? "Workspace"}
            </span>
            <RoleBadge role={invite.role} />
          </div>
          {invite.invitedBy && (
            <div className="mt-2.5 flex items-center gap-2 text-xs text-neutral-500">
              <Avatar
                name={invite.invitedBy.name}
                src={invite.invitedBy.avatarUrl}
                size={20}
              />
              <span>
                Invited by{" "}
                <span className="font-medium text-neutral-700">
                  {invite.invitedBy.name}
                </span>
              </span>
            </div>
          )}
        </div>

        {active ? (
          <Btn className="flex-shrink-0" onClick={onAccept} disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Accepting…" : "Accept"}
          </Btn>
        ) : (
          <Badge tone={invite.status === "accepted" ? "live" : "neutral"}>
            {invite.status}
          </Badge>
        )}
      </div>
    </Card>
  );
}

export default WorkspaceInvites;
