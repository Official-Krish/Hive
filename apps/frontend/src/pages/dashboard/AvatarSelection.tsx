/* ─────────────────────────────────────────────────────────────
   AVATAR SELECTION — pick a map avatar. 3D previews render on
   demand (no idle WebGL loops), save preserves the workspace
   context. Same flow, dark instrument.
   ───────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FiCheck } from "react-icons/fi";
import { ApiError, http } from "@/lib/http";
import { notifyError, notifySuccess } from "@/lib/toast";
import {
  BackLink,
  Btn,
  Note,
  PageHead,
  Spinner,
} from "@/components/dashboard/kit";
import { cn } from "@/lib/utils";
import Avatar from "@/components/world/Avatar";
import { AVATARS } from "@/components/world/AvatarConfig";

const AVATAR_OPTIONS = [...AVATARS.male, ...AVATARS.female];

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AVATAR_OPTIONS.map((opt) => {
          const isSelected = selected === opt.model;
          return (
            <button
              key={opt.model}
              type="button"
              onClick={() => setSelected(opt.model)}
              aria-pressed={isSelected}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-xl border transition-colors",
                isSelected
                  ? "border-neutral-900/40 bg-neutral-900/[0.03]"
                  : "border-neutral-900/[0.08] bg-white hover:border-neutral-900/30",
              )}
            >
              <div className="aspect-square w-full bg-[#E9E7E2]">
                <Canvas
                  camera={{
                    position: [0, 1, 3.4],
                    fov: 35,
                    near: 0.1,
                    far: 50,
                  }}
                  dpr={[1, 1.5]}
                  frameloop="demand"
                  gl={{ antialias: true, powerPreference: "low-power" }}
                >
                  <ambientLight intensity={1.6} />
                  <directionalLight position={[3, 5, 3]} intensity={1.4} />
                  <directionalLight position={[-3, 2, -2]} intensity={0.6} />
                  <Avatar
                    modelUrl={opt.model}
                    position={[0, -0.9, 0]}
                    name={opt.name}
                    status=""
                    badgeColor="bg-emerald-400"
                  />
                  <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    target={[0, 0.4, 0]}
                  />
                </Canvas>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-left">
                <span className="truncate text-[13px] font-medium text-neutral-800">
                  {opt.name}
                </span>
                {isSelected && (
                  <FiCheck
                    className="size-4 flex-shrink-0 text-emerald-700"
                    aria-hidden
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

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
