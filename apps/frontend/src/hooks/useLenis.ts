import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Snappy smooth scroll for the landing film.
 * Scoped to wherever it's mounted (LandingPage) — destroyed on unmount
 * so the dashboard keeps native scroll. Disabled entirely under
 * prefers-reduced-motion. The rAF loop pauses when the tab is hidden.
 */
export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 0.8,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.2,
      anchors: true,
    });

    let raf = 0;
    let stopped = false;
    const loop = (time: number) => {
      if (stopped) return;
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onVis = () => {
      if (document.hidden) {
        stopped = true;
        cancelAnimationFrame(raf);
        lenis.stop();
      } else {
        stopped = false;
        lenis.start();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [enabled]);
}

export default useLenis;
