import { useQuery } from "@tanstack/react-query";
import { http } from "./http";
import { Navigate } from "react-router-dom";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) return null;
  if (!me?.user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
