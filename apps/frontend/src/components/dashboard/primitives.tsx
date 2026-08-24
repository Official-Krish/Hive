/* ─────────────────────────────────────────────────────────────
   DASHBOARD TOKENS
   Surface + motion tokens for the dashboard. Monochrome by design:
   white/greys on the dark shell, near-black on the cream inset.
   Green is reserved exclusively for the live / online indicator.
   ───────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";

/* surfaces */
export const SHELL = "#08090d";
export const PANEL = "#0d0f16"; // raised dark surface
export const BONE = "#f0efec"; // cream instrument inset

/* the product's signature ease */
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
