import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { FiArrowLeft } from "react-icons/fi";
import { ApiError, http, type OrgSummary } from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import { Note, PageHeader, Spinner } from "@/components/dashboard/ui";
import { PaperInset, StripMeta } from "@/components/dashboard/Paper";
import { cn } from "@/lib/utils";

export interface OrgOutletContext {
  org: OrgSummary;
}

const TABS = [
  { label: "Members", to: "members" },
  { label: "Workspaces", to: "workspaces" },
  { label: "Teams", to: "teams" },
];

export function OrgDetail() {
  const { orgId = "" } = useParams();

  const org = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => http.orgs.get(orgId),
    enabled: orgId.length > 0,
    retry: false,
  });

  if (org.isLoading) {
    return (
      <div className="flex items-center gap-2.5 text-neutral-500">
        <Spinner /> Loading organization…
      </div>
    );
  }

  if (org.isError || !org.data) {
    const missing = org.error instanceof ApiError && org.error.status === 404;
    return (
      <div>
        <BackLink />
        <Note tone="error">
          {missing
            ? "This organization doesn't exist or you're not a member."
            : "We couldn't load this organization."}
        </Note>
      </div>
    );
  }

  const data: OrgSummary = org.data;

  return (
    <div>
      <BackLink />

      <PageHeader
        eyebrow={`Organization · ${data.plan}`}
        title={
          <>
            {data.name}
            <span className="italic text-neutral-400">, the roster.</span>
          </>
        }
        subtitle={
          <>
            <span className="font-mono text-[12px] text-neutral-500">
              {data.slug}
            </span>{" "}
            · {data.memberCount} member{data.memberCount === 1 ? "" : "s"} ·{" "}
            {data.workspaceCount} workspace
            {data.workspaceCount === 1 ? "" : "s"}
          </>
        }
      />

      <PaperInset
        className="mt-2"
        top={
          <StripMeta>
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2.5 py-1 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors",
                    isActive
                      ? "bg-neutral-900/[0.06] text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900",
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </StripMeta>
        }
      >
        <motion.div {...fade(0.05)} className="px-5 py-6 sm:px-7">
          <Outlet context={{ org: data } satisfies OrgOutletContext} />
        </motion.div>
      </PaperInset>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/dashboard"
      className="group mb-7 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
    >
      <FiArrowLeft
        className="size-4 transition-transform group-hover:-translate-x-0.5"
        aria-hidden
      />
      Back to console
    </Link>
  );
}

export default OrgDetail;
