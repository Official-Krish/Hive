import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Reset scroll on route change, but honor in-page anchors (e.g. /#faq):
 * a hash change scrolls to the target instead of the top.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default ScrollToTop;
