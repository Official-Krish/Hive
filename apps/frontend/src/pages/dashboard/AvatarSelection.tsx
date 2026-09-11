/* ─────────────────────────────────────────────────────────────
   AVATAR SELECTION — pick a map avatar. 3D previews render on
   demand (no idle WebGL loops), save preserves the workspace
   context. Same flow, dark instrument.
   ───────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, http } from "@/lib/http";
import { notifyError, notifySuccess } from "@/lib/toast";
import {
  BackLink,
  Btn,
  Note,
  PageHead,
  Spinner,
} from "@/components/dashboard/kit";
import { AvatarPicker } from "@/components/dashboard/AvatarPicker";

export function AvatarSelection() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const [selected, setSelected] = useState<string | null>(null);

  const device = useQuery({
    queryKey: ["devices", "me", "status"],
    queryFn: http.devices.status,
    retry: false,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (modelUrl: string) =>
      http.auth.updateProfile({ mapAvatarModel: modelUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      notifySuccess("Avatar saved");
      navigate(workspaceId ? `/dashboard/w/${workspaceId}` : "/dashboard");
    },
    onError: (err) =>
      notifyError(
        err instanceof ApiError
          ? err.message
          : "Couldn't save your avatar. Try again.",
      ),
  });

  const hasDevice = device.data?.hasOnlineDevice ?? true;
  const canSubmit = !!selected && !mutation.isPending;

  const subtitle = useMemo(() => {
    if (device.isLoading) return "Checking your collector status…";
    if (!hasDevice)
      return "You can pick an avatar now, but you'll need the Hive collector running to enter the spatial office.";
    return "Choose the avatar teammates will see in the spatial office. You can change it later.";
  }, [device.isLoading, hasDevice]);

  const backTo = workspaceId ? `/dashboard/w/${workspaceId}` : "/dashboard";

  return (
    <div>
      <BackLink to={backTo}>Back</BackLink>

      <PageHead eyebrow="Map avatar" title="Pick your avatar" sub={subtitle} />

      {!hasDevice && !device.isLoading && (
        <div className="mb-6 max-w-xl">
          <Note tone="info">
            Start your Hive collector to join the spatial office. Run{" "}
            <code className="rounded bg-neutral-900/[0.06] px-1.5 py-0.5 font-mono text-xs text-neutral-700">
              hive start
            </code>{" "}
            on your machine.
          </Note>
        </div>
      )}

      <AvatarPicker selected={selected} onSelect={setSelected} />

      <div className="mt-6 flex items-center gap-3">
        <Btn
          disabled={!canSubmit}
          onClick={() => selected && mutation.mutate(selected)}
        >
          {mutation.isPending && <Spinner />}
          {mutation.isPending ? "Saving…" : "Save avatar"}
        </Btn>
      </div>
    </div>
  );
}

export default AvatarSelection;
