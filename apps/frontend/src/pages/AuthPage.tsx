import { useMutation, useQuery } from "@tanstack/react-query";
import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiGithub,
  FiLoader,
} from "react-icons/fi";
import { Navigate } from "react-router-dom";
import { HiveLogo } from "@/components/icons";
import { http } from "@/lib/http";

export function AuthPage() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: http.auth.me,
    retry: false,
  });

  const login = useMutation({
    mutationFn: http.github.loginUrl,
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
  });

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090D]">
        <FiLoader className="size-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (me.data) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08090D] px-4 text-slate-100">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[360px] w-[520px] rounded-full bg-indigo-600/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-[#0f131d]/80 p-8 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-2 rounded-full bg-cyan-500/20 blur-sm" />
              <HiveLogo className="relative" size={44} />
            </div>
            <h1 className="font-sans text-2xl font-bold tracking-tight text-white">
              Welcome to Hive
            </h1>
            <p className="text-center text-sm text-slate-400">
              Sign in with GitHub to connect your repos and stream telemetry
              from your local AI agents.
            </p>
          </div>

          <button
            type="button"
            onClick={() => login.mutate()}
            disabled={login.isPending}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(56,189,248,0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(56,189,248,0.5)] disabled:opacity-60 disabled:hover:scale-100"
          >
            {login.isPending ? (
              <FiLoader className="size-4 animate-spin" />
            ) : (
              <FiGithub className="size-4 transition-transform group-hover:rotate-6" />
            )}
            <span>
              {login.isPending
                ? "Redirecting to GitHub…"
                : "Continue with GitHub"}
            </span>
            {!login.isPending && (
              <FiArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            )}
          </button>

          {login.isError && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-rose-400">
              <FiAlertTriangle className="size-3.5" />
              Couldn&apos;t reach the backend to start GitHub sign-in.
            </p>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500"></div>
        </div>
      </div>
    </div>
  );
}
