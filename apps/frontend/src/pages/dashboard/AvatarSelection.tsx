/* ─────────────────────────────────────────────────────────────
   AVATAR SELECTION — pick a map avatar once.
   Renders a 3D preview of each GLB option, calls
   http.auth.updateProfile with the chosen model path, and
   navigates to the WorldPage. Skips if the user already picked
   one and only redirects to the map.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FiArrowLeft, FiCheck } from "react-icons/fi";
import { ApiError, http } from "@/lib/http";
import { fade } from "@/components/dashboard/primitives";
import {
  Note,
  PageHeader,
  Spinner,
  primaryBtnClass,
} from "@/components/dashboard/ui";
import Avatar from "@/components/world/Avatar";
import { AVATARS } from "@/components/world/AvatarConfig";

const AVATAR_OPTIONS = [...AVATARS.male, ...AVATARS.female];

export function AvatarSelection() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const [selected, setSelected] = useState<string | null>(null);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  const device = useQuery({
    queryKey: ["devices", "me", "status"],
    queryFn: http.devices.status,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!meLoading && me?.user?.mapAvatarModel) {
      navigate(workspaceId ? `/world?workspaceId=${workspaceId}` : "/world", {
        replace: true,
      });
    }
  }, [meLoading, me, workspaceId, navigate]);

  const mutation = useMutation({
    mutationFn: (modelUrl: string) =>
      http.auth.updateProfile({ mapAvatarModel: modelUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate(workspaceId ? `/world?workspaceId=${workspaceId}` : "/world");
    },
  });

  const hasDevice = device.data?.hasOnlineDevice ?? true;
  const canSubmit = !!selected && !mutation.isPending;

  const subtitle = useMemo(() => {
    if (device.isLoading) return "Checking your collector status…";
    if (!hasDevice)
      return "You can pick an avatar now, but you'll need the Hive collector running to enter the spatial office.";
    return "Choose the avatar teammates will see in the spatial office. You can change it later from the dashboard.";
  }, [device.isLoading, hasDevice]);

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          navigate(workspaceId ? `/dashboard/w/${workspaceId}` : "/dashboard")
        }
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-slate-400 transition-colors hover:text-white"
      >
        <FiArrowLeft className="size-4" aria-hidden />
        Back
      </button>

      <PageHeader
        eyebrow="Map avatar"
        title="Pick your avatar"
        subtitle={subtitle}
      />

      {!hasDevice && !device.isLoading && (
        <Note tone="info">
          Start your Hive collector to join the spatial office. Run{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-white">
            hive start
          </code>{" "}
          on your machine.
        </Note>
      )}

      <motion.div {...fade(0.05)} className="mt-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {AVATAR_OPTIONS.map((opt) => {
            const isSelected = selected === opt.model;
            return (
              <button
                key={opt.model}
                type="button"
                onClick={() => setSelected(opt.model)}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all ${
                  isSelected
                    ? "border-white/40 bg-white/[0.05]"
                    : "border-white/[0.07] bg-[#0d0f16] hover:border-white/20"
                }`}
              >
                <div className="aspect-square w-full bg-gradient-to-b from-slate-700/40 to-slate-900/60">
                  <Canvas
                    camera={{
                      position: [0, 1, 3.4],
                      fov: 35,
                      near: 0.1,
                      far: 50,
                    }}
                    dpr={[1, 1.5]}
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
                  <span className="truncate text-[13px] font-medium text-white">
                    {opt.name}
                  </span>
                  {isSelected && (
                    <FiCheck
                      className="size-4 flex-shrink-0 text-emerald-400"
                      aria-hidden
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          className={primaryBtnClass}
          disabled={!canSubmit}
          onClick={() => selected && mutation.mutate(selected)}
        >
          {mutation.isPending && <Spinner />}
          {mutation.isPending ? "Saving…" : "Enter spatial office"}
        </button>
      </div>

      {mutation.isError && (
        <div className="mt-4">
          <Note tone="error">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : "Couldn't save your avatar. Try again."}
          </Note>
        </div>
      )}
    </div>
  );
}

export default AvatarSelection;
