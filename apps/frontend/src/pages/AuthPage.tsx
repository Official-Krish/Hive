import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { FiArrowLeft, FiGithub } from "react-icons/fi";
import { Navigate, Link } from "react-router-dom";
import { http } from "@/lib/http";
import { HiveMark } from "@/components/icons/HiveMark";

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f0efec]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 text-sm font-mono text-neutral-500"
        >
          <span className="h-2 w-2 animate-ping rounded-full bg-neutral-400" />
          <span>Loading workspace...</span>
        </motion.div>
      </div>
    );
  }

  if (me.data) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#f0efec]">
      <div className="flex min-h-screen w-full">
        <div className="hidden h-screen aspect-9/16 flex-none overflow-hidden bg-[#0a0a0c] lg:block">
          <img
            src="https://cdn.krishlabs.tech/hive/assets/auth.png"
            alt="Hive workspace"
            loading="eager"
            className="block h-full w-full object-cover"
          />
        </div>
        <div className="relative flex min-h-screen min-w-0 flex-1 flex-col items-center justify-center bg-[#f0efec] px-8 py-12 sm:px-14 lg:px-20">
          <Link
            to="/"
            className="absolute left-8 top-8 flex items-center gap-2.5 sm:left-14 lg:left-20"
            aria-label="Back to home"
          >
            <HiveMark className="size-7 text-[#0a0a0c]" />
            <span className="font-sans font-bold text-lg tracking-tight text-[#0a0a0c]">
              Hive
            </span>
          </Link>
          <Link
            to="/"
            className="absolute right-8 top-9 inline-flex items-center gap-1.5 text-xs font-medium text-[#0a0a0c]/50 transition-colors hover:text-[#0a0a0c] sm:right-14 lg:right-20"
          >
            <FiArrowLeft aria-hidden />
            Home
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex w-full max-w-md flex-col items-start"
          >
            {/* Kicker */}
            <span className="mb-3 text-xs font-mono uppercase tracking-widest text-[#0a0a0c]/60">
              Welcome to Hive
            </span>

            {/* Headline */}
            <h1 className="mb-8 text-balance text-3xl font-semibold leading-[1.12] tracking-tight text-[#0a0a0c] sm:text-4xl lg:text-[2.6rem]">
              Your team&apos;s workspace for <br className="hidden sm:inline" />
              humans + AI agents.
            </h1>

            {/* Login */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate();
              }}
              className="w-full space-y-4"
            >
              <button
                type="submit"
                disabled={login.isPending}
                aria-busy={login.isPending}
                className="
                  group relative flex w-full items-center justify-center
                  gap-3.5 rounded-2xl bg-[#0a0a0c]
                  px-6 py-4 text-base font-medium text-white
                  shadow-lg
                  transition-all duration-300
                  hover:scale-[1.01] hover:bg-[#1f1f24]
                  active:scale-[0.99]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                  disabled:hover:scale-100
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#0a0a0c]/40
                  cursor-pointer
                "
              >
                <FiGithub
                  className="size-5 text-white transition-transform duration-300 group-hover:scale-110"
                  aria-hidden="true"
                />

                <span>
                  {login.isPending
                    ? "Connecting to GitHub..."
                    : "Continue with GitHub"}
                </span>
              </button>

              {/* Error */}
              {login.isError && (
                <p
                  role="alert"
                  className="pt-1 text-center text-xs font-mono text-rose-600"
                >
                  Handshake failed. Please click to try again.
                </p>
              )}

              {/* Terms */}
              <p className="pt-2 text-center text-xs leading-relaxed text-[#0a0a0c]/50">
                By continuing, you agree to Hive&apos;s{" "}
                <Link
                  to="/terms"
                  className="text-[#0a0a0c]/80 underline transition-colors hover:text-[#0a0a0c]"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy"
                  className="text-[#0a0a0c]/80 underline transition-colors hover:text-[#0a0a0c]"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
