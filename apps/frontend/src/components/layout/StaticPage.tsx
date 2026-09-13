import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { FiArrowRight } from "react-icons/fi";
import { usePageMeta } from "@/hooks/usePageMeta";
import { cn } from "@/lib/utils";

export interface StaticSection {
  id: string;
  label: string;
}

/**
 * Shared shell for public static pages — same voice as the landing:
 * mono eyebrow, grotesk display title, quiet prose, TOC sidebar on desktop.
 */
export function StaticPage({
  eyebrow,
  title,
  description,
  updated,
  sections,
  children,
  cta = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  updated?: string;
  sections?: StaticSection[];
  children: ReactNode;
  cta?: boolean;
}) {
  usePageMeta(title, description);
  const activeId = useActiveSection(sections);

  return (
    <div className="relative bg-[#08090D] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36 lg:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/40">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-balance font-sans text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
          {description}
        </p>
        {updated && (
          <p className="mt-4 font-mono text-[11px] tabular-nums text-white/30">
            Last updated · {updated}
          </p>
        )}

        <div
          className={cn(
            "mt-12 grid gap-12",
            sections && sections.length > 0
              ? "lg:grid-cols-[220px_minmax(0,1fr)]"
              : "max-w-3xl",
          )}
        >
          {sections && sections.length > 0 && (
            <>
              <details className="lg:hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
                  On this page
                </summary>
                <nav aria-label="On this page" className="mt-2 space-y-1 pb-1">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      aria-current={activeId === s.id ? "location" : undefined}
                      className={cn(
                        "block rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                        activeId === s.id
                          ? "bg-white/[0.07] text-white"
                          : "text-white/45 hover:bg-white/[0.05] hover:text-white/85",
                      )}
                    >
                      {s.label}
                    </a>
                  ))}
                </nav>
              </details>
              <nav aria-label="On this page" className="hidden lg:block">
                <div className="sticky top-24 space-y-1">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      aria-current={activeId === s.id ? "location" : undefined}
                      className={cn(
                        "block rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                        activeId === s.id
                          ? "bg-white/[0.07] text-white"
                          : "text-white/45 hover:bg-white/[0.05] hover:text-white/85",
                      )}
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              </nav>
            </>
          )}

          <article className="static-prose min-w-0 max-w-3xl">
            {children}
          </article>
        </div>

        {cta && (
          <div className="mt-20 flex flex-col items-start gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-10">
            <p className="max-w-xl font-sans text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Give your team a place to build.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
              >
                Get started
                <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/install"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              >
                Install the collector
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tracks the section currently nearest the top of the viewport. */
function useActiveSection(sections?: StaticSection[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!sections || sections.length === 0) return;
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);
  return active;
}
