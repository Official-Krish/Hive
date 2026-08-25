/* ─────────────────────────────────────────────────────────────
   DASHBOARD TOKENS
   Surface + motion tokens shared by every console page.
   Two materials, exactly like the landing page:
   · SHELL  — the off-white console world (#faf9f6) with raised
              PANEL surfaces in white
   · PAPER  — the bone instrument inset (#f4f2ed), the same
              surface as the marketing site's Activity bezel
   Green is reserved exclusively for live / online state.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";

/* surfaces */
export const SHELL = "#faf9f6"; // off-white console background
export const PANEL = "#ffffff"; // raised surface on the shell
export const BONE = "#f0efec"; // landing section paper
export const PAPER = "#f4f2ed"; // console instrument inset

/* the product's signature ease (spring-ish, never linear) */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fade = (delay = 0, y = 8) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE, delay },
});

/* re-render on an interval so a clock / relative time stays honest */
export function useTick(intervalMs = 30_000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

/* "just now" / "4m ago" / "3h ago" / "Mar 12" — honest relative time */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
