import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useNavigation } from "react-router-dom";

/* ─────────────────────────────────────────────────────────────
   TOP PROGRESS BAR — YouTube-style loading line.
   Visible while a route transition is pending OR any query/mutation
   is in flight (e.g. the dashboard refetch storm after leaving the
   world). Pure CSS indeterminate slide; hidden for reduced-motion.
   Mount once inside each top-level layout (it is position:fixed).
   ───────────────────────────────────────────────────────────── */
export function TopProgressBar() {
  const navigation = useNavigation();
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = navigation.state !== "idle" || fetching > 0 || mutating > 0;
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      className="route-progress-track motion-reduce:hidden"
    >
      <div className="route-progress-bar" />
    </div>
  );
}
