import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, http, type OrgMemberPublic } from "@/lib/http";
import {
  Avatar,
  Btn,
  ConfirmBtn,
  Note,
  RoleBadge,
  Spinner,
  baselineInputClass,
} from "@/components/dashboard/kit";
import { notifyError, notifySuccess } from "@/lib/toast";
import type { OrgOutletContext } from "./OrgDetail";

const ROLES = ["owner", "admin", "member"] as const;

export function OrgMembers() {
  const { org } = useOutletContext<OrgOutletContext>();
  const queryClient = useQueryClient();
  const isOwner = org.role === "owner";

  const members = useQuery({
    queryKey: ["org", org.id, "members"],
    queryFn: () => http.orgs.members.list(org.id),
    retry: false,
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      http.orgs.members.changeRole(org.id, userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", org.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["org", org.id] });
      notifySuccess("Role updated");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't update role.",
      ),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => http.orgs.members.remove(org.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", org.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["org", org.id] });
      notifySuccess("Member removed");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError ? err.message : "Couldn't remove member.",
      ),
  });

  if (members.isLoading) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-neutral-500">
        <Spinner /> Loading members…
      </div>
    );
  }

  if (members.isError) {
    return (
      <Note tone="error">
        <span className="flex flex-wrap items-center gap-3">
          <span>We couldn&apos;t load the members.</span>
          <Btn variant="ghost" onClick={() => members.refetch()}>
            Retry
          </Btn>
        </span>
      </Note>
    );
  }

  const list: OrgMemberPublic[] = members.data ?? [];

  return (
    <div>
      {list.length === 0 && (
        <Note>
          No members yet — workspaces in this org will add people here.
        </Note>
      )}

      {list.length > 0 && (
        <ul className="divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
          {list.map((m) => {
            const rowBusy =
              (changeRole.isPending &&
                changeRole.variables?.userId === m.userId) ||
              (remove.isPending && remove.variables === m.userId);
            return (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={m.name} src={m.avatarUrl} size={28} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-neutral-800">
                      {m.name}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {m.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  {isOwner ? (
                    <>
                      <select
                        className={`${baselineInputClass} h-8 w-auto px-0 text-xs`}
                        value={m.role}
                        disabled={rowBusy}
                        onChange={(e) =>
                          changeRole.mutate({
                            userId: m.userId,
                            role: e.target.value,
                          })
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <ConfirmBtn
                        variant="ghost"
                        confirmLabel="Remove"
                        pending={remove.isPending}
                        onConfirm={() => remove.mutate(m.userId)}
                      >
                        Remove
                      </ConfirmBtn>
                    </>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!isOwner && (
        <p className="pt-2 font-mono text-[11px] text-neutral-400">
          Only the organization owner can change roles or remove members.
        </p>
      )}
    </div>
  );
}

export default OrgMembers;
