import { Link } from "react-router-dom";
import { FiArrowLeft, FiGrid } from "react-icons/fi";
import { usePageMeta } from "@/hooks/usePageMeta";

export function NotFound() {
  usePageMeta(
    "Page not found",
    "This Hive page doesn't exist. Head home or back to your console.",
  );
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
        Error 404
      </p>
      <h1 className="mt-4 max-w-xl text-balance font-sans text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-6xl">
        Lost in the office?
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/55">
        This room doesn't exist. The floor is still here — head back and keep
        building.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.98]"
        >
          <FiArrowLeft
            className="transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
          Back home
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.12]"
        >
          <FiGrid aria-hidden />
          Console
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
