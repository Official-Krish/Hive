import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FiCheck } from "react-icons/fi";
import { cn } from "@/lib/utils";
import Avatar from "@/components/world/Avatar";
import { AVATARS } from "@/components/world/AvatarConfig";

export const AVATAR_OPTIONS = [...AVATARS.male, ...AVATARS.female];

/**
 * Avatar picker grid with on-demand 3D previews (no idle WebGL loops).
 * Controlled: parent owns `selected` + save.
 */
export function AvatarPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (modelUrl: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {AVATAR_OPTIONS.map((opt) => {
        const isSelected = selected === opt.model;
        return (
          <button
            key={opt.model}
            type="button"
            onClick={() => onSelect(opt.model)}
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
  );
}
