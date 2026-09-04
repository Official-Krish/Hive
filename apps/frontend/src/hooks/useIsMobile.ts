import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/** True on phone viewports. Live-updates on resize/orientation change. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return mobile;
}

export default useIsMobile;
