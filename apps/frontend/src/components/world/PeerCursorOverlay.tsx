import { useEffect, useState } from "react";

interface PeerCursor {
  x: number;
  y: number;
  at: number;
}

interface PeerCursorOverlayProps {
  cursors: ReadonlyMap<string, PeerCursor> | Array<PeerCursor & { id: string }>;
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
}

const CURSOR_TTL = 2500;

/** Collaborative cursors under all UI chrome — tip-anchored, edge-clamped. */
export function PeerCursorOverlay({
  cursors,
  nameOf,
  colorOf,
}: PeerCursorOverlayProps) {
  // Re-render on a beat so stale cursors expire even without parent updates.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const list = Array.isArray(cursors)
    ? cursors
    : [...cursors.entries()].map(([id, c]) => ({ ...c, id }));
  const now = Date.now();
  const live = list.filter((c) => now - c.at < CURSOR_TTL);
  if (live.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
    >
      {live.map((c) => {
        const x = Math.min(0.985, Math.max(0.005, c.x));
        const y = Math.min(0.985, Math.max(0.005, c.y));
        const color = colorOf(c.id);
        const raw = nameOf(c.id);
        const name =
          raw === c.id
            ? "Someone"
            : raw.length > 24
              ? `${raw.slice(0, 24)}…`
              : raw;
        return (
          <div
            key={c.id}
            className="absolute"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              className="-translate-x-[1px] -translate-y-[1px] drop-shadow"
              aria-hidden
            >
              <path d="M1 1 L6 15 L7.8 9.8 L13 8 Z" fill={color} />
            </svg>
            <span
              className="ml-3 mt-0.5 block max-w-[120px] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
              style={{ backgroundColor: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
