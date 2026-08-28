import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiTrash2 } from "react-icons/fi";
import { ApiError, http, type OrgMemberPublic } from "@/lib/http";
import { Note, Spinner } from "@/components/dashboard/ui";
import { paperGhostBtnClass } from "@/components/dashboard/Paper";
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
      <div className="flex items-center gap-2.5 text-neutral-500">
        <Spinner /> Loading members…
      </div>
    );
  }

  if (members.isError) {
    return <Note tone="error">We couldn't load the members.</Note>;
  }

  const list: OrgMemberPublic[] = members.data ?? [];

  return (
    <div className="space-y-2">
      {list.length === 0 && (
        <Note>No members yet — invite someone from the console.</Note>
      )}

      {list.map((m) => (
        <div
          key={m.userId}
          className="flex items-center justify-between gap-3 rounded-xl border border-neutral-900/[0.08] bg-neutral-900/[0.02] px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-neutral-900">
              {m.name}
            </p>
            <p className="truncate text-[11px] text-neutral-500">{m.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] uppercase tracking-[0.1em] text-neutral-400 sm:inline">
              {m.status}
            </span>
            {isOwner ? (
              <>
                <select
                  className="rounded-lg border border-neutral-900/15 bg-white px-2 py-1.5 text-[12.5px] text-neutral-900"
                  value={m.role}
                  disabled={changeRole.isPending}
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
                <button
                  type="button"
                  aria-label="Remove member"
                  title="Remove"
                  className={paperGhostBtnClass}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(m.userId)}
                >
                  <FiTrash2 className="size-4" aria-hidden />
                </button>
              </>
            ) : (
              <span className="rounded-md bg-neutral-900/[0.05] px-2 py-1 text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-600">
                {m.role}
              </span>
            )}
          </div>
        </div>
      ))}

      {!isOwner && (
        <p className="pt-2 text-[11.5px] text-neutral-500">
          Only the organization owner can change roles or remove members.
        </p>
      )}
    </div>
  );
}

export default OrgMembers;
