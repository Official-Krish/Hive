import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { FiArrowRight } from "react-icons/fi";
import { CHAPTERS } from "./cinematic/chapters";

export function MobileHero() {
  return (
    <>
      <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-black">
        <div className="pointer-events-none absolute inset-0 select-none">
          <img
            src="https://cdn.krishlabs.tech/hive/assets/hero.png"
            alt="Hive engineering floor"
            className="h-full w-full object-cover object-center"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 px-5 pb-14 pt-32"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
            Hive · Engineering intelligence
          </p>
          <h1 className="mt-3 text-balance font-sans text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] text-white">
            Your team is already building.{" "}
            <span className="text-white/60">Now you can see it.</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
            Developers, AI agents, and everything they ship — together in one
            living workspace.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.98]"
            >
              Get started
              <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/install"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.12]"
            >
              Install the collector
            </Link>
          </div>
        </motion.div>
      </section>

      {/* The 8 scenes as a swipeable stills strip — the film, condensed */}
      <section aria-label="Story scenes" className="relative bg-black pb-14">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHAPTERS.map((c) => (
            <figure
              key={c.scene}
              className="relative w-[240px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10"
            >
              <img
                src={c.poster}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-3.5">
                <div className="font-mono text-[10px] tracking-[0.18em] text-white/45">
                  SCENE {c.scene}
                </div>
                <div className="mt-1 text-[13px] font-semibold leading-snug text-white">
                  {c.title}{" "}
                  {c.accent && (
                    <span className="text-white/60">{c.accent}</span>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-3 px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          Swipe · the film in 8 stills
        </p>
      </section>
    </>
  );
}

export default MobileHero;
