import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ApiError, http } from "@/lib/http";
import { WorldCanvas } from "@/components/world/WorldCanvas";
import {
  Note,
  Panel,
  Spinner,
  primaryBtnClass,
} from "@/components/dashboard/ui";

/**
 * Workspace-aware spatial office. Loads the current user + workspace, then
 * mounts the 3D world. Redirects unauthenticated users to /auth and shows a
 * friendly message when the workspace can't be loaded.
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

  if (me.isLoading || (workspaceId && workspace.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1017] text-slate-300">
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
          className={primaryBtnClass}
          onClick={() => navigate("/auth")}
        >
          Sign in
        </button>
      </Centered>
    );
  }

  if (workspaceId && workspace.isError) {
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
          className={primaryBtnClass}
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b1017] p-6">
      <Panel className="max-w-md p-6">{children}</Panel>
    </div>
  );
}

export default WorldPage;
