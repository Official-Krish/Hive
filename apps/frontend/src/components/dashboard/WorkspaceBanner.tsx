import { Link, useNavigate } from "react-router-dom";
import { FiMap } from "react-icons/fi";
import { Btn, LiveDot, RoleBadge } from "@/components/dashboard/kit";
import { ASSET_BASE_URL } from "@/lib/config";

const FALLBACK_COVER = `${ASSET_BASE_URL}/assets/hero.png`;

/**
 * Versioned thumbnail URL — thumbnailUpdatedAt changes on every upload,
 * so fresh captures bypass CDN + browser caches of older shots.
 */
export function thumbnailSrc(
  url: string | null,
  updatedAt: string | null,
): string {
  const base = url ?? FALLBACK_COVER;
  return updatedAt ? `${base}?v=${encodeURIComponent(updatedAt)}` : base;
}

export interface BannerWorkspace {
  id: string;
  name: string;
  description: string | null;
  role: string;
  memberCount: number;
  thumbnailUrl: string | null;
  thumbnailUpdatedAt: string | null;
}

/**
 * Cinematic workspace banner — auto-captured world cover with a scrim,
 * live status, and entry actions. Falls back to a staged office still
 * until the first in-world capture lands.
 */
export function WorkspaceBanner({
  workspace: ws,
  onlineCount,
  hasAvatar,
  compact = false,
  inviteHref,
}: {
  workspace: BannerWorkspace;
  onlineCount: number;
  hasAvatar: boolean;
  compact?: boolean;
  inviteHref?: string;
}) {
  const navigate = useNavigate();
  const cover = thumbnailSrc(ws.thumbnailUrl, ws.thumbnailUpdatedAt);

  return (
    <section
      aria-label={`Workspace ${ws.name}`}
      className="relative overflow-hidden rounded-2xl bg-neutral-950"
    >
      <img
        src={cover}
        alt=""
        aria-hidden
        loading={compact ? "lazy" : "eager"}
        className={`w-full object-cover ${compact ? "aspect-[21/7]" : "aspect-[16/10] sm:aspect-[21/9]"}`}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
      />

      <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-3 p-4 sm:p-5">
        {onlineCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 font-mono text-[11px] text-white backdrop-blur-sm">
            <LiveDot tone="live" />
            <span className="data-mono tabular-nums">{onlineCount}</span>
            <span className="text-white/70">in the office</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 font-mono text-[11px] text-white/70 backdrop-blur-sm">
            <LiveDot tone="off" />
            Quiet
          </span>
        )}
        <RoleBadge
          role={ws.role}
          className="border-white/25 bg-black/45 text-white backdrop-blur-sm"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <h2
          className={`font-bold tracking-tight text-white ${
            compact ? "text-2xl" : "text-3xl sm:text-[2.6rem]"
          }`}
        >
          <Link
            to={`/dashboard/w/${ws.id}`}
            className="transition-opacity hover:opacity-85"
          >
            {ws.name}
          </Link>
        </h2>
        {ws.description && !compact && (
          <p className="mt-1.5 max-w-lg truncate text-sm text-white/65">
            {ws.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <span className="data-mono text-[11px] tabular-nums text-white/50">
            {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"}
          </span>
          {!ws.thumbnailUrl && (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
              · live cover appears as your team walks the floor
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn
            onClick={() =>
              hasAvatar
                ? navigate(`/world?workspaceId=${ws.id}`)
                : navigate(`/dashboard/avatar?workspaceId=${ws.id}`)
            }
            className="bg-white text-neutral-950 hover:bg-neutral-200"
          >
            <FiMap className="size-4" aria-hidden />
            {hasAvatar ? "Enter spatial office" : "Pick avatar & enter"}
          </Btn>
          {inviteHref && (
            <Link
              to={inviteHref}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/[0.16]"
            >
              Invite people
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export default WorkspaceBanner;
