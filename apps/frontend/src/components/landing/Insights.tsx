import { motion } from "motion/react";

export const Insights = () => {
  return (
    <section className="relative w-full bg-[#08090D] text-white py-12 sm:py-20 px-4 sm:px-6 lg:px-12 overflow-hidden select-none">
      {/* ── TOP SECTION HEADER ── */}
      <div className="max-w-4xl mx-auto text-center sm:mb-28">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-xs font-semibold tracking-[0.2em] text-neutral-400 uppercase mb-4"
        >
          AI USAGE
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-sans font-bold text-4xl sm:text-6xl md:text-7xl tracking-tight text-white text-balance"
        >
          Make every token count.
        </motion.h2>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 text-base sm:text-xl text-neutral-400 font-normal leading-relaxed text-balance max-w-2xl mx-auto"
        >
          See what your team spends on AI, what they&rsquo;re building with it,
          and where that usage turns into shipped work.
        </motion.p>
      </div>

      {/* ── MAIN GENERATIVE SVG VISUALIZATION ── */}
      <div className="relative max-w-6xl mx-auto w-full my-8 sm:my-16">
        {/* Responsive SVG Container */}
        <div className="relative w-full aspect-[2/1] min-h-[380px] sm:min-h-[480px]">
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 1000 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Linear Gradient for AI Streams */}
              <linearGradient
                id="stream-fade"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#404040" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#a3a3a3" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
              </linearGradient>

              {/* Node Glow Filters */}
              <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ── PATH DEFINITIONS & BASE TRACERS ── */}

            {/* Stream 1: Claude (Top) -> Token Hub */}
            <motion.path
              d="M 60 140 C 140 140, 180 250, 260 250"
              stroke="#333333"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
            <motion.path
              d="M 60 140 C 140 140, 180 250, 260 250"
              stroke="#737373"
              strokeWidth="1.5"
              strokeDasharray="4 160"
              fill="none"
              animate={{ strokeDashoffset: [0, -164] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
            />

            {/* Stream 2: Codex (Middle) -> Token Hub */}
            <motion.path
              d="M 60 250 C 140 250, 180 250, 260 250"
              stroke="#333333"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.1, ease: "easeInOut" }}
            />
            <motion.path
              d="M 60 250 C 140 250, 180 250, 260 250"
              stroke="#a3a3a3"
              strokeWidth="1.5"
              strokeDasharray="4 120"
              fill="none"
              animate={{ strokeDashoffset: [0, -124] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
            />

            {/* Stream 3: Gemini (Bottom) -> Token Hub */}
            <motion.path
              d="M 60 360 C 140 360, 180 250, 260 250"
              stroke="#333333"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.2, ease: "easeInOut" }}
            />
            <motion.path
              d="M 60 360 C 140 360, 180 250, 260 250"
              stroke="#737373"
              strokeWidth="1.5"
              strokeDasharray="4 140"
              fill="none"
              animate={{ strokeDashoffset: [0, -144] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
            />

            {/* Stream 4: Token Hub -> Tasks Node 1 (Upper Branch) */}
            <motion.path
              d="M 260 250 C 330 250, 390 170, 480 170"
              stroke="#404040"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.4, ease: "easeInOut" }}
            />
            <motion.path
              d="M 260 250 C 330 250, 390 170, 480 170"
              stroke="#a3a3a3"
              strokeWidth="1.5"
              strokeDasharray="5 150"
              fill="none"
              animate={{ strokeDashoffset: [0, -155] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />

            {/* Stream 5: Token Hub -> Tasks Node 2 (Lower Branch) */}
            <motion.path
              d="M 260 250 C 330 250, 390 330, 480 330"
              stroke="#404040"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.5, ease: "easeInOut" }}
            />
            <motion.path
              d="M 260 250 C 330 250, 390 330, 480 330"
              stroke="#737373"
              strokeWidth="1.5"
              strokeDasharray="5 130"
              fill="none"
              animate={{ strokeDashoffset: [0, -135] }}
              transition={{ duration: 2.7, repeat: Infinity, ease: "linear" }}
            />

            {/* Stream 6: Tasks -> PRs Node */}
            <motion.path
              d="M 480 170 C 560 170, 620 250, 700 250"
              stroke="#525252"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.7, ease: "easeInOut" }}
            />
            <motion.path
              d="M 480 330 C 560 330, 620 250, 700 250"
              stroke="#525252"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.8, ease: "easeInOut" }}
            />
            <motion.path
              d="M 480 170 C 560 170, 620 250, 700 250"
              stroke="#d4d4d4"
              strokeWidth="1.5"
              strokeDasharray="6 140"
              fill="none"
              animate={{ strokeDashoffset: [0, -146] }}
              transition={{ duration: 2.9, repeat: Infinity, ease: "linear" }}
            />

            {/* Stream 7: PRs Node -> Shipped Outcome (Final Accent Stream) */}
            <motion.path
              d="M 700 250 L 920 250"
              stroke="url(#stream-fade)"
              strokeWidth="1.5"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 1.0, ease: "easeInOut" }}
            />
            <motion.path
              d="M 700 250 L 920 250"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="8 100"
              fill="none"
              animate={{ strokeDashoffset: [0, -108] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
            />

            {/* ── NODES & INTERSECTIONS ── */}

            {/* Stream Labels (Left Side) */}
            <g className="text-[11px] font-mono fill-neutral-500 font-medium">
              <text x="50" y="144" textAnchor="end">
                Claude
              </text>
              <text x="50" y="254" textAnchor="end">
                Codex
              </text>
              <text x="50" y="364" textAnchor="end">
                Gemini
              </text>
            </g>

            {/* Input dots */}
            <circle cx="60" cy="140" r="2.5" fill="#525252" />
            <circle cx="60" cy="250" r="2.5" fill="#737373" />
            <circle cx="60" cy="360" r="2.5" fill="#525252" />

            {/* Node 1: Token Convergence */}
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <circle cx="260" cy="250" r="4" fill="#ffffff" />
              <circle
                cx="260"
                cy="250"
                r="12"
                stroke="#ffffff"
                strokeWidth="0.5"
                strokeOpacity="0.3"
              />
            </motion.g>

            {/* Node 2 & 3: Task Branch Points */}
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <circle cx="480" cy="170" r="3" fill="#a3a3a3" />
              <circle cx="480" cy="330" r="3" fill="#a3a3a3" />
            </motion.g>

            {/* Node 4: PR Convergence Point */}
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              <circle cx="700" cy="250" r="4.5" fill="#ffffff" />
              <circle
                cx="700"
                cy="250"
                r="16"
                stroke="#ffffff"
                strokeWidth="0.5"
                strokeOpacity="0.4"
              />
            </motion.g>

            {/* Destination Node: Shipped Outcome */}
            <motion.g
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 1.2 }}
            >
              <circle cx="920" cy="250" r="30" fill="url(#node-glow)" />
              <circle cx="920" cy="250" r="5" fill="#10b981" />
              <circle
                cx="920"
                cy="250"
                r="12"
                stroke="#10b981"
                strokeWidth="1"
                strokeOpacity="0.5"
              />
            </motion.g>
          </svg>

          {/* ── SEQUENTIAL FLOATING TYPOGRAPHY ── */}

          {/* Stage 1: TOKENS */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="absolute left-[26%] top-[22%] -translate-x-1/2 -translate-y-full text-center pointer-events-none"
          >
            <div className="font-sans font-bold text-3xl sm:text-5xl tracking-tight text-white">
              1.84M
            </div>
            <div className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase mt-1">
              TOKENS
            </div>
          </motion.div>

          {/* Stage 2: TASKS */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="absolute left-[48%] top-[10%] -translate-x-1/2 -translate-y-full text-center pointer-events-none"
          >
            <div className="font-sans font-bold text-3xl sm:text-5xl tracking-tight text-white">
              143
            </div>
            <div className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase mt-1">
              TASKS
            </div>
          </motion.div>

          {/* Stage 3: PRS */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.95 }}
            className="absolute left-[70%] top-[22%] -translate-x-1/2 -translate-y-full text-center pointer-events-none"
          >
            <div className="font-sans font-bold text-3xl sm:text-5xl tracking-tight text-white">
              38
            </div>
            <div className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase mt-1">
              PRS
            </div>
          </motion.div>

          {/* Stage 4: SHIPPED */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 1.25 }}
            className="absolute left-[92%] top-[22%] -translate-x-1/2 -translate-y-full text-center pointer-events-none"
          >
            <div className="font-sans font-bold text-3xl sm:text-5xl tracking-tight text-emerald-400">
              17
            </div>
            <div className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-emerald-500/80 uppercase mt-1">
              SHIPPED
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Insights;
