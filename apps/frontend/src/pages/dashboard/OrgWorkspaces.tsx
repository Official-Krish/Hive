import { Link, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowUpRight } from "react-icons/fi";
import { http } from "@/lib/http";
import { Note, RoleBadge, Row, Spinner } from "@/components/dashboard/kit";
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
    return <Note tone="error">We couldn't load the workspaces.</Note>;
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
    <ul className="space-y-2">
      {list.map((w) => (
        <li
          key={w.id}
          className="rounded-lg border border-neutral-900/[0.08] bg-white transition-colors hover:bg-neutral-900/[0.03]"
        >
          <Row to={`/dashboard/w/${w.id}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-neutral-800">
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
