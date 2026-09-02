interface PeerCursorEntry {
  x: number;
  y: number;
  at: number;
}

interface PeerCursorOverlayProps {
  cursors: ReadonlyMap<string, PeerCursorEntry>;
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
}

const CURSOR_TTL_MS = 2500;

/**
 * Collaborative cursors for a pair session. Positions are normalised to the
 * window (0..1); each peer's cursor is painted at that relative spot.
 */
export function PeerCursorOverlay({
  cursors,
  nameOf,
  colorOf,
}: PeerCursorOverlayProps) {
  const now = Date.now();
  const live = [...cursors.entries()].filter(
    ([, c]) => now - c.at < CURSOR_TTL_MS,
  );
  if (live.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {live.map(([id, c]) => (
        <div
          key={id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            className="drop-shadow"
          >
            <path d="M1 1 L6 15 L7.8 9.8 L13 8 Z" fill={colorOf(id)} />
          </svg>
          <span
            className="ml-3 mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
            style={{ backgroundColor: colorOf(id) }}
          >
            {nameOf(id)}
          </span>
        </div>
      ))}
    </div>
  );
}
