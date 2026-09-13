import { Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowUpRight } from "react-icons/fi";
import { http } from "@/lib/http";
import { Note, RoleBadge, Row, Spinner, Btn } from "@/components/dashboard/kit";
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
      <div className="flex items-center gap-2.5 text-sm text-neutral-500">
        <Spinner /> Loading workspaces…
      </div>
    );
  }

  if (workspaces.isError) {
    return (
      <Note tone="error">
        <span className="flex flex-wrap items-center gap-3">
          <span>We couldn&apos;t load the workspaces.</span>
          <Btn variant="ghost" onClick={() => workspaces.refetch()}>
            Retry
          </Btn>
        </span>
      </Note>
    );
  }

  const list = workspaces.data ?? [];

  if (list.length === 0) {
    return (
      <Note>
        No workspaces yet.{" "}
        <Link to="/dashboard/create" className="underline underline-offset-2">
          Create one
        </Link>{" "}
        to get started.
      </Note>
    );
  }

  return (
    <ul className="divide-y divide-neutral-900/[0.07] border-t border-neutral-900/10">
      {list.map((w) => (
        <li key={w.id}>
          <Row to={`/dashboard/w/${w.id}`} className="px-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-neutral-800">
                {w.name}
              </p>
              <p className="truncate text-[11px] text-neutral-500">
                {w.description || w.slug} · {w.memberCount} member
                {w.memberCount === 1 ? "" : "s"}
              </p>
            </div>
            <RoleBadge role={w.role} />
            <FiArrowUpRight className="size-3.5 flex-shrink-0 text-neutral-400" />
          </Row>
        </li>
      ))}
    </ul>
  );
}

export default OrgWorkspaces;
