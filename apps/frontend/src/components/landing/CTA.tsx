import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { FiArrowRight, FiCheck, FiCopy } from "react-icons/fi";

const INSTALL_CMD =
  "curl -fsSL https://cdn.krishlabs.tech/hive/collector/install.sh | bash";

export const CTA = () => {
  return (
    <section className="relative overflow-hidden bg-[#08090D] select-none">
      <div
        data-slot="container"
        className="relative mx-auto flex w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl sm:rounded-[2rem]"
        >
          {/* watermark — masked so it never bleeds off-card */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-end overflow-hidden"
          >
            <span className="w-full truncate whitespace-nowrap bg-[linear-gradient(90deg,#FFFFFF_0%,rgba(52,52,52,0)_100%)] bg-clip-text text-center font-medium leading-none text-transparent opacity-25 text-[clamp(4rem,14vw,12rem)] [mask-image:linear-gradient(to_top,black_55%,transparent)]">
              Hive Office
            </span>
          </div>

          <div className="relative z-10 flex flex-col gap-10 px-6 py-12 sm:px-10 md:px-14 md:py-16 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/40">
                Finale · your floor
              </p>
              <h2 className="mt-4 text-balance font-sans text-[clamp(2.25rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
                Give your team a place to build.
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
                One command installs the collector. Two more connect it. Your
                office goes live.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/auth"
                  className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.98]"
                >
                  Launch your floor
                  <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/install"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.12]"
                >
                  Install guide
                </Link>
              </div>
            </div>

            <TerminalCard />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

function TerminalCard() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — selection still works */
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <span className="flex items-center gap-1.5" aria-hidden>
          <i className="block size-2.5 rounded-full bg-white/15" />
          <i className="block size-2.5 rounded-full bg-white/15" />
          <i className="block size-2.5 rounded-full bg-white/15" />
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy install command"}
          className="flex items-center gap-1.5 font-mono text-[11px] text-white/50 transition-colors hover:text-white"
        >
          {copied ? (
            <FiCheck className="size-3.5 text-emerald-400" />
          ) : (
            <FiCopy className="size-3.5" />
          )}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-relaxed">
        <code className="text-white/85">
          <span className="text-white/30">$ </span>
          <span className="text-emerald-200/90">{INSTALL_CMD}</span>
          {"\n"}
          <span className="text-white/30">$ </span>hive login
          {"  "}
          <span className="text-white/30"># once, GitHub device flow</span>
          {"\n"}
          <span className="text-white/30">$ </span>hive start
          {"  "}
          <span className="text-white/30"># register + go live</span>
        </code>
      </pre>
    </motion.div>
  );
}

export default CTA;
