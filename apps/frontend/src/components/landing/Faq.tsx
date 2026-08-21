import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FiChevronDown } from "react-icons/fi";

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
      "Hive is a virtual office for engineering teams. It combines real-time developer presence with local agent tracking, showing live summaries of what your engineers and AI subagents are building in one unified workspace.",
  },
  {
    id: "q2",
    question: "How does local AI agent tracking work?",
    answer:
      "Our lightweight daemon runs locally alongside your CLI tools (Claude, Codex, Cursor, etc.). It synthesizes live telemetry into real-time activity updates displayed right above your avatar in the virtual workspace.",
  },
  {
    id: "q3",
    question: "How do you calculate token efficiency and spend?",
    answer:
      "Hive aggregates token usage across all connected AI models and maps token burn directly to pull requests, tasks, and shipped code so team leads can measure real engineering output per dollar.",
  },
  {
    id: "q4",
    question: "Can I connect this with my existing stack?",
    answer:
      "Yes! Hive integrates natively with GitHub, GitLab, Slack, Notion, and your terminal environment to track commits, PR status, and live agent runs automatically.",
  },
  {
    id: "q5",
    question: "Is developer code or prompt data stored on your servers?",
    answer:
      "No. Hive only processes agent metadata, token counters, and high-level activity summaries. Your raw source code and environment variables stay entirely on your local machine.",
  },
  {
    id: "q6",
    question: "Does Hive work for hybrid and distributed teams?",
    answer:
      "Absolutely. Hive gives remote and distributed teams the ambient presence of a shared physical office, making it effortless to see who is working on what without annoying status sync meetings.",
  },
  {
    id: "q7",
    question: "How long does setup take for an engineering team?",
    answer:
      "Setup takes under 2 minutes. Install the CLI daemon, sign in with your team credentials, and your active agent sessions automatically stream presence to the shared office map.",
  },
  {
    id: "q8",
    question: "Can I customize privacy settings for sensitive projects?",
    answer:
      "Yes. You can configure granular privacy rules to redact specific file names, paths, or prompt parameters before telemetry is broadcasted to the team workspace.",
  },
  {
    id: "q9",
    question: "What AI models and CLI tools are supported?",
    answer:
      "Hive supports all major AI models and tools out of the box, including Claude (Anthropic), Codex / Copilot (OpenAI), Gemini (Google), DeepSeek, Cursor, Aider, and custom local LLM servers.",
  },
];

export const Faq = () => {
  // First question open by default as shown in reference image
  const [openId, setOpenId] = useState<string | null>("q1");

  const toggleFaq = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="relative bg-[#f0efec] text-neutral-900 py-16 sm:py-28 px-4 sm:px-6 lg:px-12 select-none border-t border-neutral-300/40">
      <div className="relative max-w-8xl">
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

            {/* CTA Card (Matches reference card design) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-[24px] bg-white p-7 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-neutral-200/80 max-w-md"
            >
              <h3 className="font-sans font-semibold text-xl sm:text-2xl text-neutral-950 tracking-tight leading-snug mb-3">
                Need a fast moving team of engineers for your startup?
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed mb-6 font-normal">
                Hive is your best bet, we have live presence, subagent tracking,
                and intelligence to take your project from 0-1.
              </p>
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
                    className="w-full flex items-center justify-between gap-4 text-left group focus:outline-none"
                    aria-expanded={isOpen}
                  >
                    <h3 className="font-semibold text-neutral-900 sm:text-lg transition-colors tracking-tight">
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
