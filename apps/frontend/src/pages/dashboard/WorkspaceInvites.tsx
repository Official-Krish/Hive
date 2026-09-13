/* ─────────────────────────────────────────────────────────────
   INVITES — your inbox. Accept stays on the page so you can work
   through several. Quiet rows, no boxes.
   ───────────────────────────────────────────────────────────── */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, http, type ReceivedInvite } from "@/lib/http";
import { notifyError, notifySuccess } from "@/lib/toast";
import {
  Avatar,
  Btn,
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

  const { data, isLoading, isError, refetch } = useQuery({
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
  const pending = invites.filter((i) => i.status === "pending");
  const history = invites.filter((i) => i.status !== "pending");

  return (
    <div>
      <PageHead
        eyebrow="Invites"
        meta={
          pendingCount > 0 ? (
            <span className="data-mono text-[11px] tabular-nums text-neutral-500">
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
            <span className="flex flex-wrap items-center gap-3">
              <span>We couldn&apos;t load your invites.</span>
              <Btn variant="ghost" onClick={() => refetch()}>
                Retry
              </Btn>
            </span>
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
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Pending · {pending.length}
          </p>
          <ul className="mt-1 divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
            {pending.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                pending={mutation.isPending && mutation.variables === invite.id}
                onAccept={() => mutation.mutate(invite.id)}
              />
            ))}
          </ul>
          {pending.length === 0 && (
            <p className="border-t border-neutral-900/10 py-4 text-sm text-neutral-500">
              All caught up — nothing waiting.
            </p>
          )}

          {history.length > 0 && (
            <>
              <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                Earlier
              </p>
              <ul className="mt-1 divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
                {history.map((invite) => (
                  <InviteRow
                    key={invite.id}
                    invite={invite}
                    pending={false}
                    onAccept={() => {}}
                  />
                ))}
              </ul>
            </>
          )}
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
    <li className="flex items-center gap-4 py-4">
      <Avatar
        name={invite.invitedBy?.name ?? invite.workspace?.name ?? "W"}
        src={invite.invitedBy?.avatarUrl ?? null}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">
            {invite.workspace?.name ?? "Workspace"}
          </span>
          <RoleBadge role={invite.role} />
        </div>
        <p className="mt-1 truncate text-xs text-neutral-500">
          {invite.invitedBy ? (
            <>
              Invited by{" "}
              <span className="font-medium text-neutral-700">
                {invite.invitedBy.name}
              </span>{" "}
              ·{" "}
            </>
          ) : null}
          {invite.org.name} · {expiryLabel(invite)}
        </p>
      </div>

      {active ? (
        <Btn className="flex-shrink-0" onClick={onAccept} disabled={pending}>
          {pending && <Spinner />}
          {pending ? "Accepting…" : "Accept"}
        </Btn>
      ) : (
        <span className="data-mono flex-shrink-0 text-[11px] uppercase tracking-[0.12em] text-neutral-400">
          {invite.status === "accepted" ? "Joined" : "Expired"}
        </span>
      )}
    </li>
  );
}

export default WorkspaceInvites;
