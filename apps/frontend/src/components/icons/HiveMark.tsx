import { cn } from "@/lib/utils";

/**
 * Hive mark — five agent-nodes converging on a central hub.
 * Two pillars + an above-center crossbar leave an "H" in negative space.
 * Uses currentColor so it adapts to light and dark surfaces.
 */
export function HiveMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      >
        <path d="M18 16v32" />
        <path d="M46 16v32" />
        <path d="M18 29h28" />
      </g>
      <g fill="currentColor">
        <circle cx="18" cy="16" r="7" />
        <circle cx="18" cy="48" r="7" />
        <circle cx="46" cy="16" r="7" />
        <circle cx="46" cy="48" r="7" />
        <circle cx="32" cy="29" r="9" />
      </g>
    </svg>
  );
}

export default HiveMark;
