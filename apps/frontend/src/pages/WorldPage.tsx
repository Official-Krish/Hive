import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ApiError, http } from "@/lib/http";
import { WorldCanvas } from "@/components/world/WorldCanvas";
import {
  Card,
  Note,
  Spinner,
  btnPrimaryClass,
} from "@/components/dashboard/kit";

/**
 * Workspace-aware spatial office. Entry is deliberate: a workspaceId must be
 * present and the backend must confirm membership (GET /workspaces/:id 404s
 * for non-members) before the 3D world mounts.
 */
export function WorldPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceId = searchParams.get("workspaceId") ?? "";

  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  const workspace = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => http.workspaces.get(workspaceId),
    enabled: workspaceId.length > 0,
    retry: false,
  });

  // No workspace in the URL — the office is only reachable from the
  // dashboard's per-workspace entries.
  if (!workspaceId) {
    return <Navigate to="/dashboard" replace />;
  }

  if (me.isLoading || workspace.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-[#F4F3EF] text-sm text-neutral-500">
        <Spinner /> Loading spatial office…
      </div>
    );
  }

  if (me.isError || !me.data?.user) {
    return (
      <Centered>
        <Note tone="error">
          You need to sign in to enter the spatial office.
        </Note>
        <button
          type="button"
          className={btnPrimaryClass}
          onClick={() => navigate("/auth")}
        >
          Sign in
        </button>
      </Centered>
    );
  }

  if (workspace.isError) {
    const notMember =
      workspace.error instanceof ApiError && workspace.error.status === 404;
    return (
      <Centered>
        <Note tone="error">
          {notMember
            ? "This workspace doesn't exist or you're not a member."
            : "Couldn't load this workspace."}
        </Note>
        <button
          type="button"
          className={btnPrimaryClass}
          onClick={() => navigate("/dashboard")}
        >
          Back to dashboard
        </button>
      </Centered>
    );
  }

  return (
    <WorldCanvas
      workspaceId={workspaceId}
      myUserId={me.data.user.id}
      myAvatarModel={me.data.user.mapAvatarModel}
      workspaceName={workspace.data?.name ?? "Spatial office"}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F4F3EF] p-6">
      <Card className="w-full max-w-md space-y-4 p-6">{children}</Card>
    </div>
  );
}

export default WorldPage;
