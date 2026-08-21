import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { FiArrowRight } from "react-icons/fi";

export function HeroSection() {
  return (
    <section className="relative min-h-[92vh] sm:min-h-screen pt-32 sm:pt-40 pb-28 sm:pb-36 overflow-hidden bg-black flex flex-col justify-between">
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden z-0">
        <img
          src="https://cdn.krishlabs.tech/hive/assets/hero.png"
          alt="Hero Background"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 w-full mt-20">
        {/* Main Split Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-end">
          {/* Left Column: Big Bold Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7"
          >
            <h1 className="font-sans font-bold text-4xl sm:text-6xl md:text-7xl lg:text-[5.2rem] leading-[1.04] tracking-[-0.035em] text-white text-balance">
              Where your team and AI agents build together.
            </h1>

            <div className="mt-6 sm:mt-8 max-w-2xl">
              <p className="text-base sm:text-lg text-neutral-300 font-normal leading-relaxed text-balance">
                See your developers, AI agents, and engineering activity come
                alive in one shared workspace.
              </p>

              {/* CTAs Row */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {/* Primary Get Started Button */}
                <Link
                  to="/auth"
                  className="group relative inline-flex items-center justify-center rounded-full bg-white text-black font-semibold px-7 py-3 text-sm transition-all duration-200 hover:bg-neutral-200 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02]"
                >
                  <span>Get started</span>
                </Link>

                {/* Secondary See How It Works Button */}
                <a
                  href="#features"
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-6 py-3 text-sm font-medium text-white backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:border-white/30"
                >
                  <span>See how it works</span>
                  <FiArrowRight className="text-sm text-neutral-400 group-hover:text-white transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
