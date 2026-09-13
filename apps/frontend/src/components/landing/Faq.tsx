import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { FiChevronDown, FiCopy, FiCheck } from "react-icons/fi";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "q1",
    question: "What exactly does this platform do?",
    answer:
      "Hive turns raw AI-coding activity into a living team dashboard. A lightweight local collector observes your agents, terminal, git, and tests — then a cloud backend renders dashboards, token spend, alerts, and a spatial office your team walks around in.",
  },
  {
    id: "q2",
    question: "How does local AI agent tracking work?",
    answer:
      "The hive daemon tails local session logs from Claude Code, Codex, and OpenCode (plus git, filesystem, and an optional shell hook for terminal commands), normalizes them into telemetry events, and ships batched, idempotent updates to your workspace. Stop scrolling the film and the story freezes — same idea: when agents stop, the floor goes quiet.",
  },
  {
    id: "q3",
    question: "How do you calculate token efficiency and spend?",
    answer:
      "Every token event is priced against per-model rates and rolled up into daily charts, per-model and per-member splits, monthly budgets with alert thresholds, and throughput (tasks, PRs, tests, $/task). Watchdog goes further: it flags stuck agents, token burn with no output, failing test streaks, and budget breaches as actionable alerts.",
  },
  {
    id: "q4",
    question: "Can I connect this with my existing stack?",
    answer:
      "Hive is GitHub-native: connect with a GitHub OAuth App, install it on your repos, and pushes and pull requests land on the floor in real time via webhooks. An ambient reviewer bot also reviews PRs — secret scans plus a model pass, comment-only — and logs its spend to your workspace budget.",
  },
  {
    id: "q5",
    question: "Is developer code or prompt data stored on your servers?",
    answer:
      "No. The collector ships metadata, token counters, and activity summaries — raw source code never leaves the machine. Per-workspace privacy switches gate token usage, summaries, git metadata, file paths, exact commands, and prompt metadata server-side, and role-ranked access controls who sees what.",
  },
  {
    id: "q6",
    question: "Does Hive work for hybrid and distributed teams?",
    answer:
      "That's the point. Presence, avatars, live agent summaries, voice, whiteboards, and pair sessions give distributed teams the ambient awareness of a shared floor — know what's happening without asking, and without another status meeting.",
  },
  {
    id: "q7",
    question: "How long does setup take for an engineering team?",
    answer:
      "Under two minutes per machine: install the collector, run hive login (GitHub device flow, no passwords), then hive start to register the device and join a workspace. Joining a workspace requires an online collector — that gate keeps every seat live.",
  },
  {
    id: "q8",
    question: "Can I customize privacy settings for sensitive projects?",
    answer:
      "Yes. Six per-workspace switches — activity summaries, agent status, token usage, git metadata, exact commands, file paths, prompt metadata — redact read responses server-side without changing their shape. Admins and owners manage them; viewers get a read-only surface.",
  },
  {
    id: "q9",
    question: "What AI models and CLI tools are supported?",
    answer:
      "Claude Code, Codex, and OpenCode are observed directly from their local session logs, plus git, filesystem, terminal, and test activity for any workflow. Token pricing is tracked per model, so new models just need a pricing row to light up the spend dashboard.",
  },
];

export const Faq = () => {
  // First question open by default as shown in reference image
  const [openId, setOpenId] = useState<string | null>("q1");

  const toggleFaq = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="faq"
      className="relative bg-[#f0efec] text-neutral-900 py-16 sm:py-28 px-4 sm:px-6 lg:px-12 select-none scroll-mt-16"
    >
      <div className="relative max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* ── LEFT COLUMN: Title, Contact Email, & CTA Card ── */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="font-sans font-bold text-4xl sm:text-5xl tracking-tight text-neutral-950 mb-3"
              >
                Frequently Asked Questions
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-sm sm:text-base text-neutral-600 font-normal mb-8 sm:mb-12"
              >
                Have more doubts? Reach out to us at{" "}
                <a
                  href="mailto:contact@hive.dev"
                  className="text-emerald-700 font-medium underline underline-offset-2 transition-colors"
                >
                  contact@hive.dev
                </a>
              </motion.p>
            </div>

            {/* Install card — the 2-minute promise, copyable */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-[24px] bg-neutral-950 p-7 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)] max-w-md"
            >
              <h3 className="font-sans font-semibold text-xl sm:text-2xl text-white tracking-tight leading-snug mb-3">
                Live on your floor in 2 minutes.
              </h3>
              <InstallSnippet />
              <Link
                to="/install"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                Full install guide
                <span aria-hidden>→</span>
              </Link>
            </motion.div>
          </div>

          {/* ── RIGHT COLUMN: Accordion Questions List ── */}
          <div className="lg:col-span-6 space-y-0 divide-y divide-neutral-400/50 pt-2">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openId === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="py-10 sm:py-9 first:pt-0"
                >
                  <button
                    onClick={() => toggleFaq(item.id)}
                    className="w-full flex items-center gap-4 text-left group focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <span
                      aria-hidden
                      className="font-mono text-[11px] tabular-nums text-neutral-400 shrink-0 w-6"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="flex-1 font-semibold text-neutral-900 sm:text-lg transition-colors tracking-tight">
                      {item.question}
                    </h3>
                    <FiChevronDown
                      className={`size-5 text-neutral-700 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-neutral-900" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm sm:text-base text-neutral-800 leading-relaxed mt-3 pr-6 font-normal">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Faq;

const INSTALL_CMD =
  "curl -fsSL https://cdn.krishlabs.tech/hive/collector/install.sh | bash";

function InstallSnippet() {
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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/60">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-3.5 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
          terminal
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
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed text-emerald-200/90">
        <code>{INSTALL_CMD}</code>
      </pre>
    </div>
  );
}
