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
