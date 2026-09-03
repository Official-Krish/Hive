import { Outlet, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ApiError, http, type OrgSummary } from "@/lib/http";
import {
  BackLink,
  Card,
  Note,
  PageHead,
  Spinner,
  Tabs,
} from "@/components/dashboard/kit";

export interface OrgOutletContext {
  org: OrgSummary;
}

export function OrgDetail() {
  const { orgId = "" } = useParams();
  const { pathname } = useLocation();

  const org = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => http.orgs.get(orgId),
    enabled: orgId.length > 0,
    retry: false,
  });

  if (org.isLoading) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-neutral-500">
        <Spinner /> Loading organization…
      </div>
    );
  }

  if (org.isError || !org.data) {
    const missing = org.error instanceof ApiError && org.error.status === 404;
    return (
      <div>
        <BackLink to="/dashboard">Overview</BackLink>
        <Note tone="error">
          {missing
            ? "This organization doesn't exist or you're not a member."
            : "We couldn't load this organization."}
        </Note>
      </div>
    );
  }

  const data: OrgSummary = org.data;
  const base = `/dashboard/o/${orgId}`;

  return (
    <div>
      <BackLink to="/dashboard">Overview</BackLink>

      <PageHead
        eyebrow={`Organization · ${data.plan}`}
        title={data.name}
        sub={
          <>
            <span className="font-mono text-xs text-neutral-500">
              {data.slug}
            </span>
            {" · "}
            {data.memberCount} member{data.memberCount === 1 ? "" : "s"} ·{" "}
            {data.workspaceCount} workspace
            {data.workspaceCount === 1 ? "" : "s"}
          </>
        }
      />

      <Card>
        <div className="border-b border-neutral-900/[0.08] px-5 pt-3">
          <Tabs
            tabs={[
              {
                label: "Members",
                href: `${base}/members`,
                active: pathname.endsWith("/members"),
              },
              {
                label: "Workspaces",
                href: `${base}/workspaces`,
                active: pathname.endsWith("/workspaces"),
              },
              {
                label: "Teams",
                href: `${base}/teams`,
                active: pathname.endsWith("/teams"),
              },
            ]}
          />
        </div>
        <div className="px-5 py-5">
          <Outlet context={{ org: data } satisfies OrgOutletContext} />
        </div>
      </Card>
    </div>
  );
}

export default OrgDetail;
