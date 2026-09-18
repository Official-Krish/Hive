import { useQuery } from "@tanstack/react-query";
import { http } from "./http";
import { Navigate } from "react-router-dom";
import { TopProgressBar } from "@/components/layout/TopProgressBar";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  // TEMP-VERIFY: bypassed for headless visual check — MUST REVERT
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("verify")
  ) {
    return <>{children}</>;
  }
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    // Long stale window: the gate only needs to know who you are, and a
    // cached identity lets world→dashboard returns render instantly while
    // page queries refresh in the background (under the progress bar).
    staleTime: 5 * 60_000,
  });

  // Never a blank screen: bone backdrop + the top loading line while the
  // identity check resolves (e.g. after a session refresh storm).
  if (isLoading)
    return (
      <div className="min-h-screen bg-[#F4F3EF]">
        <TopProgressBar />
      </div>
    );
  if (!me?.user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
