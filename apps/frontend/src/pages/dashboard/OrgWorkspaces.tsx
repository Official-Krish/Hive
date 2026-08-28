import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { http } from "@/lib/http";
import { Note, Spinner } from "@/components/dashboard/ui";
import type { OrgOutletContext } from "./OrgDetail";

export function OrgWorkspaces() {
  const { org } = useOutletContext<OrgOutletContext>();

  const workspaces = useQuery({
    queryKey: ["org", org.id, "workspaces"],
    queryFn: () => http.orgs.workspaces(org.id),
    retry: false,
  });

  if (workspaces.isLoading) {
    return (
      <div className="flex items-center gap-2.5 text-neutral-500">
        <Spinner /> Loading workspaces…
      </div>
    );
  }

  if (workspaces.isError) {
    return <Note tone="error">We couldn't load the workspaces.</Note>;
  }

  const list = workspaces.data ?? [];

  return (
    <div className="space-y-2">
      {list.length === 0 && (
        <Note>
          No workspaces yet. Create one from the console to get started.
        </Note>
      )}

      {list.map((w) => (
        <Link
          key={w.id}
          to={`/dashboard/w/${w.id}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-neutral-900/[0.08] bg-neutral-900/[0.02] px-3 py-2.5 transition-colors hover:bg-neutral-900/[0.05]"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-neutral-900">
              {w.name}
            </p>
            <p className="truncate text-[11px] text-neutral-500">
              {w.description || w.slug} · {w.memberCount} member
              {w.memberCount === 1 ? "" : "s"}
            </p>
          </div>
          <span className="rounded-md bg-neutral-900/[0.05] px-2 py-1 text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-600">
            {w.role}
          </span>
        </Link>
      ))}
    </div>
  );
}

export default OrgWorkspaces;
