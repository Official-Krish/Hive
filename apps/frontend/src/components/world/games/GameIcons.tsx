import { cn } from "@/lib/utils";

/** Pip layouts on a 3×3 grid (fractions of the viewBox). */
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.3, 0.3],
    [0.7, 0.7],
  ],
  3: [
    [0.3, 0.3],
    [0.5, 0.5],
    [0.7, 0.7],
  ],
  4: [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ],
  5: [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.5, 0.5],
    [0.3, 0.7],
    [0.7, 0.7],
  ],
  6: [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.3, 0.7],
    [0.7, 0.7],
  ],
};

/**
 * Custom die-face SVG (no emoji). `value` picks the pip layout 1–6;
 * anything else renders a blank die.
 */
export function DieIcon({
  value,
  className,
}: {
  value?: number;
  className?: string;
}) {
  const pips = (value !== undefined && PIPS[value]) || [];
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)}>
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="5"
        fill="currentColor"
        opacity="0.16"
      />
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {pips.map(([x, y], i) => (
        <circle key={i} cx={x * 24} cy={y * 24} r="2.1" fill="currentColor" />
      ))}
    </svg>
  );
}

function Base({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)}>
      {children}
    </svg>
  );
}

/** Crown (checkers kings, glyphs). */
export function CrownIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path
        d="M3 8.5 5.5 11 8 6.5 12 12l4-5.5L18.5 11 21 8.5 19 17.5H5L3 8.5Z"
        fill="currentColor"
      />
      <rect x="5" y="18.5" width="14" height="2" rx="1" fill="currentColor" />
    </Base>
  );
}

/** Anchor (battleship glyph). */
export function AnchorIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle
        cx="12"
        cy="5.5"
        r="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 7.5v11M7 11.5h10M5 14c0 4 3 7 7 7s7-3 7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Base>
  );
}

/** Five-point star (wild cards, home plate). */
export function StarIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path
        d="M12 2.8 14.9 9l6.6.5-5 4.3 1.5 6.4-6-3.6-6 3.6 1.5-6.4-5-4.3 6.6-.5L12 2.8Z"
        fill="currentColor"
      />
    </Base>
  );
}

/** Skip (circle-slash). */
export function SkipIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M6.5 6.5l11 11"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </Base>
  );
}

/** Hit marker (filled dot). */
export function HitIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="6" fill="currentColor" />
    </Base>
  );
}

/** Miss marker (small dot). */
export function MissIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.7" />
    </Base>
  );
}

/** Wreck marker (cross). */
export function WreckIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Base>
  );
}

/** Ship segment (rounded square). */
export function ShipIcon({ className }: { className?: string }) {
  return (
    <Base className={className}>
      <rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" />
    </Base>
  );
}
