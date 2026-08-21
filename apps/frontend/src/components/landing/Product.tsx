import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────────────────────────────────────────
   CHARACTER DATA — inhabitants of the virtual office
   ───────────────────────────────────────────────────────── */
interface Inhabitant {
  id: string;
  name: string;
  task: string;
  type: "developer" | "agent";
  x: number;
  y: number;
}

const inhabitants: Inhabitant[] = [
  {
    id: "krish",
    name: "Krish",
    task: "Building authentication",
    type: "developer",
    x: 18,
    y: 65,
  },
  {
    id: "claude",
    name: "Claude",
    task: "Implementing OAuth",
    type: "agent",
    x: 27,
    y: 64,
  },
  {
    id: "sarah",
    name: "Sarah",
    task: "Reviewing AST Telemetry PR",
    type: "developer",
    x: 50,
    y: 56,
  },
  {
    id: "alex",
    name: "Alex",
    task: "Optimizing render pipeline",
    type: "developer",
    x: 72,
    y: 60,
  },
  {
    id: "copilot",
    name: "Copilot",
    task: "Refactoring batch renderer",
    type: "agent",
    x: 81,
    y: 58,
  },
];

export function Product() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section className="relative bg-[#f0efec] text-neutral-900 py-24 sm:py-32 px-4 sm:px-6 lg:px-10 overflow-hidden">
      {/* Background Subtle Grain */}
      <div className="absolute inset-0 pointer-events-none opacity-25 select-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(#a39f97 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-xs font-semibold tracking-widest uppercase text-neutral-500 mb-3"
          >
            ONE SHARED WORKSPACE
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-sans font-extrabold text-4xl sm:text-6xl tracking-tight text-neutral-950 text-balance"
          >
            See your team at work.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-neutral-600 font-normal leading-relaxed text-balance"
          >
            Developers, AI agents, and engineering activity — together in one
            living workspace.
          </motion.p>
        </div>

        {/* ═══════════════════════════════════════════════
            THE VIRTUAL OFFICE
            ═══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="relative rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.3)]"
        >
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: "16 / 9" }}
          >
            {/* The Full SVG Scene */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1600 900"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                {/* ── GRADIENTS ── */}
                <linearGradient id="ceilingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1c1e24" />
                  <stop offset="100%" stopColor="#22252c" />
                </linearGradient>
                <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#252830" />
                  <stop offset="100%" stopColor="#2a2d36" />
                </linearGradient>
                <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3a3428" />
                  <stop offset="100%" stopColor="#2e2820" />
                </linearGradient>
                <linearGradient id="twilight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e2a48" />
                  <stop offset="35%" stopColor="#2d3d5e" />
                  <stop offset="65%" stopColor="#c08858" />
                  <stop offset="100%" stopColor="#e8a060" />
                </linearGradient>
                <radialGradient id="pendantCone" cx="50%" cy="0%" r="100%">
                  <stop offset="0%" stopColor="#f5c878" stopOpacity="0.5" />
                  <stop offset="30%" stopColor="#f5b850" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="deskLampGlow" cx="50%" cy="20%" r="80%">
                  <stop offset="0%" stopColor="#f5c878" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="screenGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#8ab8e8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#8ab8e8" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="agentAmber" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f5a623" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="agentCyan" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </radialGradient>
                {/* Floor wood pattern */}
                <pattern
                  id="woodFloor"
                  x="0"
                  y="0"
                  width="120"
                  height="30"
                  patternUnits="userSpaceOnUse"
                  patternTransform="skewX(-15)"
                >
                  <rect
                    width="118"
                    height="28"
                    rx="1"
                    fill="#3d3628"
                    stroke="#353022"
                    strokeWidth="0.5"
                  />
                  <line
                    x1="0"
                    y1="14"
                    x2="118"
                    y2="14"
                    stroke="#38321e"
                    strokeWidth="0.3"
                    opacity="0.3"
                  />
                </pattern>
                {/* Ceiling panel pattern */}
                <pattern
                  id="ceilingTiles"
                  x="0"
                  y="0"
                  width="160"
                  height="80"
                  patternUnits="userSpaceOnUse"
                >
                  <rect
                    width="158"
                    height="78"
                    fill="none"
                    stroke="#282b33"
                    strokeWidth="0.8"
                  />
                </pattern>
              </defs>
              {/* ══════════════════════════════════════════════════
                  LAYER 1: CEILING
                  ══════════════════════════════════════════════════ */}
              <rect
                x="0"
                y="0"
                width="1600"
                height="120"
                fill="url(#ceilingGrad)"
              />
              <rect
                x="0"
                y="0"
                width="1600"
                height="120"
                fill="url(#ceilingTiles)"
                opacity="0.5"
              />
              {/* Ceiling beams */}
              <rect x="0" y="116" width="1600" height="8" fill="#2e3038" />
              <rect x="0" y="116" width="1600" height="2" fill="#353840" />
              {/* Cross beams */}
              <rect x="395" y="0" width="10" height="124" fill="#282b33" />
              <rect x="795" y="0" width="10" height="124" fill="#282b33" />
              <rect x="1195" y="0" width="10" height="124" fill="#282b33" />
              {/* ══════════════════════════════════════════════════
                  LAYER 2: BACK WALL
                  ══════════════════════════════════════════════════ */}
              <rect
                x="0"
                y="124"
                width="1600"
                height="306"
                fill="url(#wallGrad)"
              />
              {/* Wall baseboard at bottom */}
              <rect x="0" y="420" width="1600" height="10" fill="#32353e" />
              {/* Subtle wall texture lines */}
              <line
                x1="0"
                y1="250"
                x2="1600"
                y2="250"
                stroke="#2e3138"
                strokeWidth="0.5"
                opacity="0.4"
              />
              {/* ── WALL ART: Framed poster (left) ── */}
              <rect
                x="60"
                y="170"
                width="90"
                height="120"
                rx="3"
                fill="#1e2028"
              />
              <rect
                x="56"
                y="166"
                width="98"
                height="128"
                rx="4"
                fill="none"
                stroke="#3a3d46"
                strokeWidth="3"
              />
              {/* Abstract art inside */}
              <circle cx="105" cy="210" r="20" fill="#c08858" opacity="0.15" />
              <circle cx="95" cy="225" r="14" fill="#8ab8e8" opacity="0.1" />
              <rect
                x="75"
                y="255"
                width="50"
                height="3"
                rx="1"
                fill="#555"
                opacity="0.15"
              />
              <rect
                x="82"
                y="262"
                width="36"
                height="2"
                rx="1"
                fill="#555"
                opacity="0.1"
              />
              {/* ── WALL ART: Company logo / poster (center-left) ── */}
              <rect
                x="310"
                y="185"
                width="70"
                height="90"
                rx="3"
                fill="#1e2028"
              />
              <rect
                x="306"
                y="181"
                width="78"
                height="98"
                rx="4"
                fill="none"
                stroke="#3a3d46"
                strokeWidth="3"
              />
              <rect
                x="320"
                y="200"
                width="50"
                height="4"
                rx="2"
                fill="#f5a623"
                opacity="0.2"
              />
              <rect
                x="325"
                y="210"
                width="40"
                height="3"
                rx="1"
                fill="#fff"
                opacity="0.06"
              />
              <rect
                x="322"
                y="218"
                width="46"
                height="3"
                rx="1"
                fill="#fff"
                opacity="0.04"
              />
              <circle cx="345" cy="245" r="8" fill="#f5a623" opacity="0.08" />
              {/* ── CLOCK on wall ── */}
              <circle
                cx="520"
                cy="200"
                r="22"
                fill="#1e2028"
                stroke="#3a3d46"
                strokeWidth="2.5"
              />
              <circle
                cx="520"
                cy="200"
                r="18"
                fill="none"
                stroke="#444"
                strokeWidth="0.5"
              />
              {/* Clock hands */}
              <line
                x1="520"
                y1="200"
                x2="520"
                y2="186"
                stroke="#c8c0b0"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="520"
                y1="200"
                x2="530"
                y2="196"
                stroke="#c8c0b0"
                strokeWidth="1"
                strokeLinecap="round"
              />
              <circle cx="520" cy="200" r="2" fill="#c8c0b0" />
              {/* Hour markers */}
              <circle cx="520" cy="183" r="1" fill="#666" />
              <circle cx="537" cy="200" r="1" fill="#666" />
              <circle cx="520" cy="217" r="1" fill="#666" />
              <circle cx="503" cy="200" r="1" fill="#666" />
              {/* ── SHELVES (left wall area) ── */}
              <rect
                x="180"
                y="220"
                width="100"
                height="6"
                rx="2"
                fill="#3a3228"
              />
              <rect
                x="180"
                y="275"
                width="100"
                height="6"
                rx="2"
                fill="#3a3228"
              />
              <rect
                x="180"
                y="330"
                width="100"
                height="6"
                rx="2"
                fill="#3a3228"
              />
              {/* Books on shelves */}
              <rect
                x="185"
                y="228"
                width="8"
                height="44"
                rx="1"
                fill="#5a4038"
              />
              <rect
                x="195"
                y="231"
                width="6"
                height="41"
                rx="1"
                fill="#384858"
              />
              <rect
                x="203"
                y="229"
                width="7"
                height="43"
                rx="1"
                fill="#58503a"
              />
              <rect
                x="212"
                y="232"
                width="5"
                height="40"
                rx="1"
                fill="#3a5048"
              />
              <rect
                x="219"
                y="228"
                width="8"
                height="44"
                rx="1"
                fill="#5a3838"
              />
              <rect
                x="229"
                y="230"
                width="6"
                height="42"
                rx="1"
                fill="#485838"
              />
              <rect
                x="237"
                y="233"
                width="7"
                height="39"
                rx="1"
                fill="#4a3850"
              />
              <rect
                x="250"
                y="229"
                width="5"
                height="43"
                rx="1"
                fill="#504a38"
              />
              <rect
                x="257"
                y="231"
                width="8"
                height="41"
                rx="1"
                fill="#385058"
              />
              <rect
                x="267"
                y="228"
                width="6"
                height="44"
                rx="1"
                fill="#584a38"
              />
              {/* Second shelf books */}
              <rect
                x="188"
                y="283"
                width="7"
                height="39"
                rx="1"
                fill="#485040"
              />
              <rect
                x="197"
                y="285"
                width="6"
                height="37"
                rx="1"
                fill="#584838"
              />
              <rect
                x="205"
                y="282"
                width="8"
                height="40"
                rx="1"
                fill="#3a4858"
              />
              <rect
                x="215"
                y="286"
                width="5"
                height="36"
                rx="1"
                fill="#504038"
              />
              <rect
                x="222"
                y="283"
                width="7"
                height="39"
                rx="1"
                fill="#385848"
              />
              {/* Small plant on shelf */}
              <rect
                x="248"
                y="310"
                width="12"
                height="17"
                rx="3"
                fill="#4a4038"
              />
              <ellipse cx="254" cy="303" rx="10" ry="12" fill="#3a6838" />
              <ellipse cx="250" cy="298" rx="7" ry="9" fill="#458040" />
              <ellipse cx="258" cy="300" rx="6" ry="8" fill="#3a5830" />
              {/* Third shelf — small objects */}
              <rect
                x="190"
                y="338"
                width="14"
                height="20"
                rx="3"
                fill="#4a4038"
              />
              <ellipse cx="197" cy="332" rx="8" ry="10" fill="#3a6040" />
              <rect
                x="220"
                y="343"
                width="20"
                height="14"
                rx="2"
                fill="#383840"
              />
              <rect
                x="250"
                y="340"
                width="12"
                height="17"
                rx="2"
                fill="#504838"
              />
              {/* ── WHITEBOARD (center wall) ── */}
              <rect
                x="600"
                y="155"
                width="180"
                height="130"
                rx="4"
                fill="#32353e"
              />
              <rect
                x="605"
                y="160"
                width="170"
                height="120"
                rx="2"
                fill="#d8d4cc"
                opacity="0.08"
              />
              {/* Whiteboard content — sticky notes & writing */}
              <rect
                x="615"
                y="172"
                width="32"
                height="24"
                rx="2"
                fill="#f5a623"
                opacity="0.12"
              />
              <rect
                x="652"
                y="172"
                width="32"
                height="24"
                rx="2"
                fill="#38bdf8"
                opacity="0.1"
              />
              <rect
                x="689"
                y="172"
                width="32"
                height="24"
                rx="2"
                fill="#4ade80"
                opacity="0.08"
              />
              <rect
                x="726"
                y="172"
                width="32"
                height="24"
                rx="2"
                fill="#f5a623"
                opacity="0.08"
              />
              <rect
                x="615"
                y="200"
                width="32"
                height="24"
                rx="2"
                fill="#38bdf8"
                opacity="0.06"
              />
              <rect
                x="652"
                y="200"
                width="32"
                height="24"
                rx="2"
                fill="#f87171"
                opacity="0.08"
              />
              {/* Lines connecting */}
              <line
                x1="631"
                y1="196"
                x2="668"
                y2="184"
                stroke="#fff"
                strokeWidth="0.5"
                opacity="0.06"
              />
              <line
                x1="668"
                y1="196"
                x2="705"
                y2="184"
                stroke="#fff"
                strokeWidth="0.5"
                opacity="0.06"
              />
              {/* Sprint text */}
              <rect
                x="620"
                y="240"
                width="60"
                height="3"
                rx="1"
                fill="#fff"
                opacity="0.05"
              />
              <rect
                x="620"
                y="248"
                width="80"
                height="3"
                rx="1"
                fill="#fff"
                opacity="0.04"
              />
              <rect
                x="620"
                y="256"
                width="45"
                height="3"
                rx="1"
                fill="#fff"
                opacity="0.03"
              />
              {/* Whiteboard marker tray */}
              <rect
                x="640"
                y="288"
                width="80"
                height="4"
                rx="1"
                fill="#3a3d45"
              />
              <rect
                x="650"
                y="285"
                width="12"
                height="4"
                rx="1"
                fill="#e85050"
                opacity="0.4"
              />
              <rect
                x="666"
                y="285"
                width="12"
                height="4"
                rx="1"
                fill="#4488cc"
                opacity="0.4"
              />
              <rect
                x="682"
                y="285"
                width="12"
                height="4"
                rx="1"
                fill="#44aa55"
                opacity="0.4"
              />
              {/* ══════════════════════════════════════════════════
                  WINDOWS (right wall area)
                  ══════════════════════════════════════════════════ */}
              {/* Window 1 */}
              <rect
                x="1020"
                y="135"
                width="140"
                height="270"
                rx="3"
                fill="url(#twilight)"
              />
              <rect
                x="1020"
                y="135"
                width="140"
                height="270"
                rx="3"
                fill="none"
                stroke="#404550"
                strokeWidth="3"
              />
              <line
                x1="1090"
                y1="135"
                x2="1090"
                y2="405"
                stroke="#404550"
                strokeWidth="2"
              />
              <line
                x1="1020"
                y1="270"
                x2="1160"
                y2="270"
                stroke="#404550"
                strokeWidth="2"
              />
              {/* Window ledge */}
              <rect
                x="1015"
                y="402"
                width="150"
                height="10"
                rx="2"
                fill="#3a3d45"
              />
              {/* Small plant on ledge */}
              <rect
                x="1040"
                y="390"
                width="10"
                height="14"
                rx="3"
                fill="#4a4038"
              />
              <ellipse cx="1045" cy="384" rx="8" ry="10" fill="#3a7040" />
              <ellipse cx="1042" cy="380" rx="5" ry="7" fill="#458848" />
              {/* Window 2 */}
              <rect
                x="1190"
                y="135"
                width="140"
                height="270"
                rx="3"
                fill="url(#twilight)"
                opacity="0.9"
              />
              <rect
                x="1190"
                y="135"
                width="140"
                height="270"
                rx="3"
                fill="none"
                stroke="#404550"
                strokeWidth="3"
              />
              <line
                x1="1260"
                y1="135"
                x2="1260"
                y2="405"
                stroke="#404550"
                strokeWidth="2"
              />
              <line
                x1="1190"
                y1="270"
                x2="1330"
                y2="270"
                stroke="#404550"
                strokeWidth="2"
              />
              <rect
                x="1185"
                y="402"
                width="150"
                height="10"
                rx="2"
                fill="#3a3d45"
              />
              {/* Window 3 (partial, far right) */}
              <rect
                x="1360"
                y="135"
                width="120"
                height="270"
                rx="3"
                fill="url(#twilight)"
                opacity="0.7"
              />
              <rect
                x="1360"
                y="135"
                width="120"
                height="270"
                rx="3"
                fill="none"
                stroke="#404550"
                strokeWidth="3"
              />
              <line
                x1="1420"
                y1="135"
                x2="1420"
                y2="405"
                stroke="#404550"
                strokeWidth="2"
              />
              <line
                x1="1360"
                y1="270"
                x2="1480"
                y2="270"
                stroke="#404550"
                strokeWidth="2"
              />
              <rect
                x="1355"
                y="402"
                width="130"
                height="10"
                rx="2"
                fill="#3a3d45"
              />
              {/* Window light spill on wall */}
              <rect
                x="1020"
                y="135"
                width="460"
                height="270"
                fill="none"
                opacity="0.04"
              >
                <animate
                  attributeName="opacity"
                  values="0.04;0.06;0.04"
                  dur="6s"
                  repeatCount="indefinite"
                />
              </rect>
              {/* ══════════════════════════════════════════════════
                  LAYER 3: FLOOR
                  ══════════════════════════════════════════════════ */}
              <rect
                x="0"
                y="430"
                width="1600"
                height="470"
                fill="url(#floorGrad)"
              />
              {/* Wood plank texture */}
              <rect
                x="0"
                y="430"
                width="1600"
                height="470"
                fill="url(#woodFloor)"
                opacity="0.6"
              />
              {/* Floor sheen / reflection zone */}
              <rect
                x="0"
                y="430"
                width="1600"
                height="120"
                fill="url(#ceilingGrad)"
                opacity="0.15"
              />
              {/* ══════════════════════════════════════════════════
                  STRUCTURAL: PILLAR
                  ══════════════════════════════════════════════════ */}
              <rect x="598" y="124" width="26" height="306" fill="#30333c" />
              <rect x="596" y="124" width="2" height="306" fill="#383b44" />
              <rect x="624" y="124" width="2" height="306" fill="#2a2d35" />
              {/* Pillar base molding */}
              <rect
                x="593"
                y="415"
                width="36"
                height="15"
                rx="2"
                fill="#35383f"
              />
              {/* ══════════════════════════════════════════════════
                  PENDANT LIGHTS (with warm volumetric cones)
                  ══════════════════════════════════════════════════ */}
              {/* Pendant 1 — over Desk 1 */}
              <line
                x1="260"
                y1="0"
                x2="260"
                y2="90"
                stroke="#505560"
                strokeWidth="1.5"
              />
              <path
                d="M 242 90 L 248 105 L 272 105 L 278 90 Z"
                fill="#5a5545"
              />
              <ellipse
                cx="260"
                cy="106"
                rx="14"
                ry="4"
                fill="#f5c878"
                opacity="0.9"
              >
                <animate
                  attributeName="opacity"
                  values="0.9;0.7;0.9"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </ellipse>
              {/* Light cone */}
              <path
                d="M 245 108 L 180 430 L 340 430 Z"
                fill="url(#pendantCone)"
                opacity="0.35"
              >
                <animate
                  attributeName="opacity"
                  values="0.35;0.25;0.35"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </path>
              {/* Pendant 2 — over center */}
              <line
                x1="700"
                y1="0"
                x2="700"
                y2="80"
                stroke="#505560"
                strokeWidth="1.5"
              />
              <path d="M 682 80 L 688 95 L 712 95 L 718 80 Z" fill="#5a5545" />
              <ellipse
                cx="700"
                cy="96"
                rx="14"
                ry="4"
                fill="#f5c878"
                opacity="0.85"
              >
                <animate
                  attributeName="opacity"
                  values="0.85;0.65;0.85"
                  dur="5s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <path
                d="M 685 98 L 610 430 L 790 430 Z"
                fill="url(#pendantCone)"
                opacity="0.3"
              >
                <animate
                  attributeName="opacity"
                  values="0.3;0.2;0.3"
                  dur="5s"
                  repeatCount="indefinite"
                />
              </path>
              {/* Pendant 3 — over right desks */}
              <line
                x1="1100"
                y1="0"
                x2="1100"
                y2="75"
                stroke="#505560"
                strokeWidth="1.5"
              />
              <path
                d="M 1082 75 L 1088 90 L 1112 90 L 1118 75 Z"
                fill="#5a5545"
              />
              <ellipse
                cx="1100"
                cy="91"
                rx="14"
                ry="4"
                fill="#f5c878"
                opacity="0.8"
              >
                <animate
                  attributeName="opacity"
                  values="0.8;0.6;0.8"
                  dur="4.5s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <path
                d="M 1085 93 L 1010 430 L 1190 430 Z"
                fill="url(#pendantCone)"
                opacity="0.25"
              >
                <animate
                  attributeName="opacity"
                  values="0.25;0.15;0.25"
                  dur="4.5s"
                  repeatCount="indefinite"
                />
              </path>
              {/* ══════════════════════════════════════════════════
                  GLASS MEETING ROOM (right-center background)
                  ══════════════════════════════════════════════════ */}
              {/* Glass left wall */}
              <rect
                x="850"
                y="240"
                width="4"
                height="190"
                fill="#6080a0"
                opacity="0.2"
              />
              <rect
                x="848"
                y="240"
                width="8"
                height="190"
                fill="#8ab0d0"
                opacity="0.04"
              />
              {/* Glass right wall */}
              <rect
                x="990"
                y="240"
                width="4"
                height="190"
                fill="#6080a0"
                opacity="0.15"
              />
              {/* Glass fill (frosted) */}
              <rect
                x="854"
                y="240"
                width="136"
                height="190"
                fill="#8ab8e8"
                opacity="0.02"
              />
              {/* Glass horizontal divider */}
              <line
                x1="850"
                y1="330"
                x2="994"
                y2="330"
                stroke="#6080a0"
                strokeWidth="0.8"
                opacity="0.12"
              />
              {/* Glass door gap */}
              <rect
                x="900"
                y="240"
                width="40"
                height="190"
                fill="none"
                stroke="#6080a0"
                strokeWidth="0.5"
                opacity="0.1"
                strokeDasharray="4 3"
              />
              {/* Room label (frosted on glass) */}
              <rect
                x="870"
                y="252"
                width="60"
                height="12"
                rx="2"
                fill="#8ab8e8"
                opacity="0.04"
              />
              {/* Meeting table */}
              <rect
                x="880"
                y="340"
                width="80"
                height="40"
                rx="5"
                fill="#3a3228"
              />
              <rect
                x="880"
                y="338"
                width="80"
                height="5"
                rx="3"
                fill="#4a4038"
              />
              {/* Meeting chairs */}
              <ellipse cx="895" cy="330" rx="11" ry="7" fill="#2e3035" />
              <ellipse cx="940" cy="330" rx="11" ry="7" fill="#2e3035" />
              <ellipse cx="895" cy="395" rx="11" ry="7" fill="#2e3035" />
              <ellipse cx="940" cy="395" rx="11" ry="7" fill="#2e3035" />
              {/* Meeting room screen on back wall */}
              <rect
                x="888"
                y="255"
                width="64"
                height="40"
                rx="3"
                fill="#1a1c24"
              />
              <rect
                x="891"
                y="258"
                width="58"
                height="34"
                rx="2"
                fill="#141820"
                opacity="0.6"
              />
              <rect
                x="896"
                y="264"
                width="28"
                height="2"
                rx="1"
                fill="#38bdf8"
                opacity="0.15"
              />
              <rect
                x="896"
                y="270"
                width="40"
                height="2"
                rx="1"
                fill="#fff"
                opacity="0.05"
              />
              <rect
                x="896"
                y="276"
                width="20"
                height="2"
                rx="1"
                fill="#f5a623"
                opacity="0.1"
              />
              {/* ══════════════════════════════════════════════════
                  LARGE PLANTS
                  ══════════════════════════════════════════════════ */}
              {/* Floor plant 1 — near pillar */}
              <rect
                x="640"
                y="380"
                width="22"
                height="50"
                rx="4"
                fill="#4a4038"
              />
              <ellipse cx="651" cy="365" rx="20" ry="24" fill="#2d5a2a" />
              <ellipse cx="645" cy="352" rx="14" ry="20" fill="#357830" />
              <ellipse cx="658" cy="356" rx="12" ry="18" fill="#2a4a26" />
              <ellipse cx="651" cy="342" rx="10" ry="16" fill="#408838" />
              <ellipse cx="643" cy="348" rx="8" ry="12" fill="#4a9040" />
              {/* Floor plant 2 — right side near windows */}
              <rect
                x="1480"
                y="370"
                width="24"
                height="60"
                rx="5"
                fill="#4a4038"
              />
              <ellipse cx="1492" cy="352" rx="22" ry="28" fill="#2d5a2a" />
              <ellipse cx="1486" cy="338" rx="16" ry="22" fill="#357830" />
              <ellipse cx="1498" cy="342" rx="14" ry="20" fill="#2a4a26" />
              <ellipse cx="1492" cy="328" rx="12" ry="18" fill="#408838" />
              {/* Small desk plant (on Sarah's desk) */}
              <rect
                x="817"
                y="440"
                width="8"
                height="12"
                rx="2"
                fill="#504838"
              />
              <ellipse cx="821" cy="435" rx="7" ry="8" fill="#3a7040" />
              <ellipse cx="818" cy="431" rx="5" ry="6" fill="#458848" />
              {/* ══════════════════════════════════════════════════
                  LOUNGE AREA (far right background)
                  ══════════════════════════════════════════════════ */}
              {/* Rug */}
              <ellipse
                cx="1440"
                cy="510"
                rx="110"
                ry="45"
                fill="#4a4038"
                opacity="0.15"
              />
              <ellipse
                cx="1440"
                cy="510"
                rx="100"
                ry="38"
                fill="#504838"
                opacity="0.1"
              />
              {/* Couch */}
              <rect
                x="1390"
                y="470"
                width="120"
                height="35"
                rx="10"
                fill="#3a3228"
              />
              <rect
                x="1395"
                y="465"
                width="110"
                height="12"
                rx="6"
                fill="#443e34"
              />
              {/* Couch cushions */}
              <rect
                x="1400"
                y="468"
                width="45"
                height="8"
                rx="4"
                fill="#4a4438"
              />
              <rect
                x="1450"
                y="468"
                width="45"
                height="8"
                rx="4"
                fill="#4a4438"
              />
              {/* Couch arm rests */}
              <rect
                x="1385"
                y="460"
                width="14"
                height="48"
                rx="6"
                fill="#3e3830"
              />
              <rect
                x="1501"
                y="460"
                width="14"
                height="48"
                rx="6"
                fill="#3e3830"
              />
              {/* Coffee table */}
              <rect
                x="1410"
                y="520"
                width="70"
                height="28"
                rx="4"
                fill="#2a2620"
              />
              <rect
                x="1410"
                y="518"
                width="70"
                height="5"
                rx="2"
                fill="#353025"
              />
              {/* Items on coffee table */}
              <rect
                x="1420"
                y="512"
                width="16"
                height="8"
                rx="2"
                fill="#585048"
              />{" "}
              {/* Book */}
              <ellipse cx="1460" cy="515" rx="5" ry="5" fill="#3a3d45" />{" "}
              {/* Coaster */}
              {/* ══════════════════════════════════════════════════
                  DESK 1 — FOREGROUND LEFT (Krish + Claude)
                  ══════════════════════════════════════════════════ */}
              {/* Desk surface */}
              <rect
                x="120"
                y="555"
                width="260"
                height="16"
                rx="3"
                fill="#4a4038"
              />
              <rect
                x="120"
                y="550"
                width="260"
                height="8"
                rx="2"
                fill="#5a5048"
              />
              {/* Desk legs */}
              <rect x="130" y="571" width="8" height="70" fill="#3a3228" />
              <rect x="365" y="571" width="8" height="70" fill="#3a3228" />
              {/* Under-desk cable tray */}
              <rect
                x="180"
                y="600"
                width="120"
                height="4"
                rx="1"
                fill="#2e2a24"
              />
              {/* Monitor */}
              <rect
                x="200"
                y="480"
                width="100"
                height="68"
                rx="5"
                fill="#1e2028"
              />
              <rect
                x="204"
                y="484"
                width="92"
                height="56"
                rx="3"
                fill="#0e1018"
              >
                <animate
                  attributeName="opacity"
                  values="0.95;1;0.95"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </rect>
              {/* Screen content — code editor */}
              <rect
                x="208"
                y="488"
                width="18"
                height="48"
                rx="1"
                fill="#151820"
              />{" "}
              {/* File tree sidebar */}
              <rect
                x="210"
                y="492"
                width="12"
                height="2"
                rx="0.5"
                fill="#666"
                opacity="0.3"
              />
              <rect
                x="212"
                y="497"
                width="10"
                height="2"
                rx="0.5"
                fill="#f5a623"
                opacity="0.2"
              />
              <rect
                x="212"
                y="502"
                width="8"
                height="2"
                rx="0.5"
                fill="#666"
                opacity="0.2"
              />
              <rect
                x="212"
                y="507"
                width="11"
                height="2"
                rx="0.5"
                fill="#666"
                opacity="0.2"
              />
              <rect
                x="212"
                y="512"
                width="9"
                height="2"
                rx="0.5"
                fill="#38bdf8"
                opacity="0.15"
              />
              {/* Main editor area */}
              <rect
                x="230"
                y="490"
                width="45"
                height="2.5"
                rx="0.5"
                fill="#c084fc"
                opacity="0.25"
              />
              <rect
                x="230"
                y="495"
                width="58"
                height="2.5"
                rx="0.5"
                fill="#f5a623"
                opacity="0.3"
              />
              <rect
                x="234"
                y="500"
                width="40"
                height="2.5"
                rx="0.5"
                fill="#8ab8e8"
                opacity="0.25"
              />
              <rect
                x="234"
                y="505"
                width="52"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.2"
              />
              <rect
                x="238"
                y="510"
                width="35"
                height="2.5"
                rx="0.5"
                fill="#f5a623"
                opacity="0.2"
              />
              <rect
                x="234"
                y="515"
                width="48"
                height="2.5"
                rx="0.5"
                fill="#8ab8e8"
                opacity="0.15"
              />
              <rect
                x="230"
                y="520"
                width="55"
                height="2.5"
                rx="0.5"
                fill="#c084fc"
                opacity="0.15"
              />
              <rect
                x="234"
                y="525"
                width="30"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.15"
              />
              <rect
                x="230"
                y="530"
                width="45"
                height="2.5"
                rx="0.5"
                fill="#f5a623"
                opacity="0.1"
              />
              {/* Monitor stand */}
              <rect x="240" y="544" width="20" height="10" fill="#1e2028" />
              <rect
                x="235"
                y="553"
                width="30"
                height="4"
                rx="1"
                fill="#25282f"
              />
              {/* Screen glow on desk */}
              <ellipse
                cx="250"
                cy="555"
                rx="70"
                ry="18"
                fill="url(#screenGlow)"
                opacity="0.7"
              />
              {/* Keyboard */}
              <rect
                x="220"
                y="560"
                width="60"
                height="10"
                rx="2"
                fill="#25282f"
              />
              <rect
                x="222"
                y="562"
                width="56"
                height="6"
                rx="1"
                fill="#2a2d35"
              />
              {/* Key rows */}
              {[0, 1, 2, 3].map((row) => (
                <g key={`kb1-${row}`}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <rect
                      key={`k1-${row}-${i}`}
                      x={224 + i * 4.5}
                      y={563 + row * 1.5}
                      width="3.5"
                      height="1"
                      rx="0.3"
                      fill="#35383f"
                      opacity="0.6"
                    />
                  ))}
                </g>
              ))}
              {/* Mouse */}
              <ellipse cx="295" cy="564" rx="6" ry="8" fill="#2a2d35" />
              {/* Mouse pad */}
              <rect
                x="286"
                y="556"
                width="20"
                height="18"
                rx="3"
                fill="#2e2a24"
                opacity="0.6"
              />
              {/* Desk lamp */}
              <rect
                x="350"
                y="510"
                width="5"
                height="42"
                rx="2"
                fill="#5a5545"
              />
              <path
                d="M 340 508 L 345 498 L 362 498 L 367 508 Z"
                fill="#6a6555"
              />
              <ellipse
                cx="353"
                cy="509"
                rx="10"
                ry="4"
                fill="#f5c878"
                opacity="0.8"
              >
                <animate
                  attributeName="opacity"
                  values="0.8;0.6;0.8"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse
                cx="353"
                cy="545"
                rx="40"
                ry="45"
                fill="url(#deskLampGlow)"
                opacity="0.6"
              />
              {/* Coffee mug */}
              <rect
                x="180"
                y="548"
                width="12"
                height="14"
                rx="3"
                fill="#5a5048"
              />
              <path
                d="M 192 552 Q 198 555 192 560"
                fill="none"
                stroke="#5a5048"
                strokeWidth="2"
              />
              {/* Steam */}
              <path
                d="M 184 546 Q 186 540 188 546"
                fill="none"
                stroke="#888"
                strokeWidth="0.5"
                opacity="0.3"
              >
                <animate
                  attributeName="opacity"
                  values="0.3;0.1;0.3"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </path>
              {/* Headphones on desk */}
              <path
                d="M 155 555 Q 155 545 165 545 Q 175 545 175 555"
                fill="none"
                stroke="#3a3d45"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <rect
                x="151"
                y="553"
                width="6"
                height="10"
                rx="2"
                fill="#3a3d45"
              />
              <rect
                x="173"
                y="553"
                width="6"
                height="10"
                rx="2"
                fill="#3a3d45"
              />
              {/* ═══ CHAIR (Krish) ═══ */}
              <ellipse cx="250" cy="615" rx="28" ry="10" fill="#2e3035" />
              <rect
                x="226"
                y="592"
                width="48"
                height="24"
                rx="10"
                fill="#35383f"
              />
              {/* Chair back */}
              <rect
                x="232"
                y="575"
                width="36"
                height="20"
                rx="6"
                fill="#3a3d45"
              />
              {/* ═══ KRISH (Developer — sitting) ═══ */}
              {/* Torso */}
              <rect
                x="234"
                y="555"
                width="32"
                height="34"
                rx="7"
                fill="#3a5a8a"
              />
              {/* T-shirt collar */}
              <path
                d="M 244 555 Q 250 550 256 555"
                fill="#3a5a8a"
                stroke="#4a6a9a"
                strokeWidth="0.5"
              />
              {/* Head */}
              <circle cx="250" cy="544" r="16" fill="#d4a882" />
              {/* Hair */}
              <path
                d="M 236 540 Q 240 524 250 522 Q 260 524 264 540"
                fill="#2a2218"
              />
              <path
                d="M 236 540 L 236 536 Q 250 530 264 536 L 264 540"
                fill="#2a2218"
              />
              {/* Eyes */}
              <ellipse cx="245" cy="544" rx="2" ry="1.5" fill="#1a1a1a" />
              <ellipse cx="255" cy="544" rx="2" ry="1.5" fill="#1a1a1a" />
              {/* Subtle smile */}
              <path
                d="M 246 549 Q 250 552 254 549"
                fill="none"
                stroke="#b08060"
                strokeWidth="0.8"
              />
              {/* Arms reaching to keyboard */}
              <rect
                x="226"
                y="565"
                width="12"
                height="5"
                rx="2"
                fill="#d4a882"
              />
              <rect
                x="262"
                y="565"
                width="12"
                height="5"
                rx="2"
                fill="#d4a882"
              />
              {/* Hands */}
              <ellipse cx="225" cy="567" rx="4" ry="3" fill="#d4a882" />
              <ellipse cx="275" cy="567" rx="4" ry="3" fill="#d4a882" />
              {/* ═══ CLAUDE (AI Robot — beside desk 1) ═══ */}
              {/* Shadow */}
              <ellipse
                cx="400"
                cy="620"
                rx="18"
                ry="5"
                fill="rgba(0,0,0,0.15)"
              />
              {/* Robot body */}
              <rect
                x="388"
                y="578"
                width="26"
                height="34"
                rx="7"
                fill="#45484f"
              />
              {/* Body panel detail */}
              <rect
                x="393"
                y="586"
                width="16"
                height="6"
                rx="2"
                fill="#3a3d45"
              />
              <circle cx="401" cy="601" r="2" fill="#f5a623" opacity="0.3" />
              {/* Robot head */}
              <rect
                x="391"
                y="560"
                width="20"
                height="20"
                rx="5"
                fill="#55585f"
              />
              {/* Visor / face */}
              <rect
                x="394"
                y="565"
                width="14"
                height="8"
                rx="3"
                fill="#2a2d35"
              />
              {/* Eyes */}
              <circle cx="398" cy="569" r="3" fill="#f5a623" opacity="0.9">
                <animate
                  attributeName="opacity"
                  values="0.9;0.4;0.9"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="406" cy="569" r="3" fill="#f5a623" opacity="0.9">
                <animate
                  attributeName="opacity"
                  values="0.9;0.4;0.9"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Antenna */}
              <line
                x1="401"
                y1="560"
                x2="401"
                y2="548"
                stroke="#55585f"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="401" cy="545" r="4" fill="#f5a623" opacity="0.7">
                <animate
                  attributeName="opacity"
                  values="0.7;0.3;0.7"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Agent amber glow */}
              <ellipse
                cx="401"
                cy="545"
                rx="16"
                ry="16"
                fill="url(#agentAmber)"
                opacity="0.5"
              >
                <animate
                  attributeName="opacity"
                  values="0.5;0.2;0.5"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </ellipse>
              {/* Arms */}
              <rect
                x="382"
                y="585"
                width="8"
                height="18"
                rx="3"
                fill="#45484f"
              />
              <rect
                x="412"
                y="585"
                width="8"
                height="18"
                rx="3"
                fill="#45484f"
              />
              {/* Legs */}
              <rect
                x="393"
                y="612"
                width="6"
                height="12"
                rx="2"
                fill="#45484f"
              />
              <rect
                x="403"
                y="612"
                width="6"
                height="12"
                rx="2"
                fill="#45484f"
              />
              {/* Feet */}
              <rect
                x="391"
                y="622"
                width="10"
                height="4"
                rx="2"
                fill="#3a3d45"
              />
              <rect
                x="401"
                y="622"
                width="10"
                height="4"
                rx="2"
                fill="#3a3d45"
              />
              {/* ══════════════════════════════════════════════════
                  DESK 2 — MID-GROUND CENTER (Sarah)
                  ══════════════════════════════════════════════════ */}
              <rect
                x="660"
                y="470"
                width="220"
                height="14"
                rx="3"
                fill="#4a4038"
              />
              <rect
                x="660"
                y="466"
                width="220"
                height="7"
                rx="2"
                fill="#5a5048"
              />
              {/* Desk legs */}
              <rect x="668" y="484" width="7" height="58" fill="#3a3228" />
              <rect x="868" y="484" width="7" height="58" fill="#3a3228" />
              {/* Monitor */}
              <rect
                x="725"
                y="405"
                width="85"
                height="58"
                rx="4"
                fill="#1e2028"
              />
              <rect
                x="729"
                y="409"
                width="77"
                height="48"
                rx="3"
                fill="#0e1018"
              >
                <animate
                  attributeName="opacity"
                  values="0.92;1;0.92"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </rect>
              {/* Screen — diff view */}
              <rect
                x="733"
                y="413"
                width="16"
                height="40"
                rx="1"
                fill="#151820"
              />
              <rect
                x="735"
                y="417"
                width="10"
                height="2"
                rx="0.5"
                fill="#666"
                opacity="0.25"
              />
              <rect
                x="735"
                y="422"
                width="8"
                height="2"
                rx="0.5"
                fill="#38bdf8"
                opacity="0.15"
              />
              <rect
                x="735"
                y="427"
                width="11"
                height="2"
                rx="0.5"
                fill="#666"
                opacity="0.2"
              />
              <rect
                x="752"
                y="415"
                width="38"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.25"
              />
              <rect
                x="752"
                y="420"
                width="50"
                height="2.5"
                rx="0.5"
                fill="#f87171"
                opacity="0.2"
              />
              <rect
                x="752"
                y="425"
                width="42"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.2"
              />
              <rect
                x="752"
                y="430"
                width="30"
                height="2.5"
                rx="0.5"
                fill="#8ab8e8"
                opacity="0.2"
              />
              <rect
                x="752"
                y="435"
                width="48"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.15"
              />
              <rect
                x="752"
                y="440"
                width="35"
                height="2.5"
                rx="0.5"
                fill="#f87171"
                opacity="0.15"
              />
              <rect
                x="752"
                y="445"
                width="45"
                height="2.5"
                rx="0.5"
                fill="#8ab8e8"
                opacity="0.1"
              />
              {/* Monitor stand */}
              <rect x="758" y="459" width="18" height="10" fill="#1e2028" />
              <rect
                x="752"
                y="468"
                width="30"
                height="4"
                rx="1"
                fill="#25282f"
              />
              <ellipse
                cx="767"
                cy="472"
                rx="60"
                ry="16"
                fill="url(#screenGlow)"
                opacity="0.5"
              />
              {/* Keyboard & mouse */}
              <rect
                x="730"
                y="478"
                width="55"
                height="9"
                rx="2"
                fill="#25282f"
              />
              <ellipse cx="800" cy="482" rx="5" ry="7" fill="#2a2d35" />
              {/* Notebook / notepad */}
              <rect
                x="840"
                y="472"
                width="25"
                height="18"
                rx="2"
                fill="#e8e0d0"
                opacity="0.08"
              />
              <rect
                x="843"
                y="476"
                width="16"
                height="2"
                rx="0.5"
                fill="#666"
                opacity="0.1"
              />
              <rect
                x="843"
                y="480"
                width="12"
                height="2"
                rx="0.5"
                fill="#666"
                opacity="0.08"
              />
              {/* Pen */}
              <rect
                x="868"
                y="474"
                width="2"
                height="16"
                rx="0.5"
                fill="#5a5048"
                transform="rotate(15 869 482)"
              />
              {/* Water bottle */}
              <rect
                x="675"
                y="456"
                width="10"
                height="18"
                rx="3"
                fill="#38bdf8"
                opacity="0.12"
              />
              <rect
                x="675"
                y="454"
                width="10"
                height="4"
                rx="2"
                fill="#45484f"
              />
              {/* ═══ CHAIR (Sarah) ═══ */}
              <ellipse cx="767" cy="530" rx="24" ry="9" fill="#2e3035" />
              <rect
                x="747"
                y="510"
                width="40"
                height="22"
                rx="8"
                fill="#35383f"
              />
              <rect
                x="752"
                y="494"
                width="30"
                height="18"
                rx="6"
                fill="#3a3d45"
              />
              {/* ═══ SARAH (Developer) ═══ */}
              <rect
                x="752"
                y="472"
                width="30"
                height="30"
                rx="6"
                fill="#8a3a5a"
              />
              <circle cx="767" cy="462" r="14" fill="#e0b898" />
              {/* Hair — longer */}
              <path
                d="M 755 456 Q 760 442 767 440 Q 774 442 779 456"
                fill="#6a3828"
              />
              <path
                d="M 755 456 L 753 468 Q 760 462 774 462 Q 780 465 781 456"
                fill="#6a3828"
              />
              {/* Eyes */}
              <ellipse cx="763" cy="462" rx="1.8" ry="1.3" fill="#1a1a1a" />
              <ellipse cx="771" cy="462" rx="1.8" ry="1.3" fill="#1a1a1a" />
              <path
                d="M 763 467 Q 767 469 771 467"
                fill="none"
                stroke="#c08868"
                strokeWidth="0.7"
              />
              {/* Arms */}
              <rect
                x="745"
                y="480"
                width="10"
                height="4"
                rx="2"
                fill="#e0b898"
              />
              <rect
                x="780"
                y="480"
                width="10"
                height="4"
                rx="2"
                fill="#e0b898"
              />
              {/* ══════════════════════════════════════════════════
                  DESK 3 — MID-RIGHT (Alex + Copilot)
                  ══════════════════════════════════════════════════ */}
              <rect
                x="1040"
                y="500"
                width="240"
                height="15"
                rx="3"
                fill="#4a4038"
              />
              <rect
                x="1040"
                y="496"
                width="240"
                height="7"
                rx="2"
                fill="#5a5048"
              />
              <rect x="1050" y="515" width="7" height="62" fill="#3a3228" />
              <rect x="1268" y="515" width="7" height="62" fill="#3a3228" />
              {/* Dual monitors */}
              <rect
                x="1100"
                y="440"
                width="80"
                height="55"
                rx="4"
                fill="#1e2028"
              />
              <rect
                x="1104"
                y="444"
                width="72"
                height="44"
                rx="3"
                fill="#0e1018"
              >
                <animate
                  attributeName="opacity"
                  values="0.9;1;0.9"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
              </rect>
              {/* Screen — terminal */}
              <rect
                x="1108"
                y="448"
                width="40"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.3"
              />
              <rect
                x="1108"
                y="453"
                width="55"
                height="2.5"
                rx="0.5"
                fill="#f5a623"
                opacity="0.25"
              />
              <rect
                x="1108"
                y="458"
                width="35"
                height="2.5"
                rx="0.5"
                fill="#8ab8e8"
                opacity="0.2"
              />
              <rect
                x="1108"
                y="463"
                width="50"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.2"
              />
              <rect
                x="1108"
                y="468"
                width="28"
                height="2.5"
                rx="0.5"
                fill="#c084fc"
                opacity="0.15"
              />
              <rect
                x="1108"
                y="473"
                width="45"
                height="2.5"
                rx="0.5"
                fill="#f5a623"
                opacity="0.15"
              />
              <rect
                x="1108"
                y="478"
                width="60"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.1"
              />
              {/* Blinking cursor */}
              <rect
                x="1108"
                y="483"
                width="4"
                height="2.5"
                rx="0.5"
                fill="#4ade80"
                opacity="0.5"
              >
                <animate
                  attributeName="opacity"
                  values="0.5;0;0.5"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </rect>
              {/* Second monitor */}
              <rect
                x="1186"
                y="442"
                width="70"
                height="50"
                rx="4"
                fill="#1e2028"
              />
              <rect
                x="1190"
                y="446"
                width="62"
                height="40"
                rx="3"
                fill="#0e1018"
                opacity="0.8"
              />
              {/* Screen — browser/preview */}
              <rect
                x="1194"
                y="450"
                width="54"
                height="4"
                rx="1"
                fill="#2a2d35"
              />
              <rect
                x="1196"
                y="451"
                width="4"
                height="2"
                rx="0.5"
                fill="#f87171"
                opacity="0.3"
              />
              <rect
                x="1202"
                y="451"
                width="4"
                height="2"
                rx="0.5"
                fill="#f5a623"
                opacity="0.3"
              />
              <rect
                x="1208"
                y="451"
                width="4"
                height="2"
                rx="0.5"
                fill="#4ade80"
                opacity="0.3"
              />
              <rect
                x="1194"
                y="456"
                width="54"
                height="28"
                rx="1"
                fill="#1a1c22"
              />
              <rect
                x="1198"
                y="460"
                width="30"
                height="3"
                rx="0.5"
                fill="#fff"
                opacity="0.06"
              />
              <rect
                x="1198"
                y="466"
                width="46"
                height="12"
                rx="1"
                fill="#38bdf8"
                opacity="0.04"
              />
              {/* Monitor stands */}
              <rect x="1132" y="491" width="16" height="8" fill="#1e2028" />
              <rect
                x="1127"
                y="498"
                width="26"
                height="3"
                rx="1"
                fill="#25282f"
              />
              <rect x="1214" y="488" width="14" height="8" fill="#1e2028" />
              <rect
                x="1209"
                y="495"
                width="24"
                height="3"
                rx="1"
                fill="#25282f"
              />
              <ellipse
                cx="1160"
                cy="502"
                rx="80"
                ry="20"
                fill="url(#screenGlow)"
                opacity="0.5"
              />
              {/* Keyboard */}
              <rect
                x="1110"
                y="507"
                width="58"
                height="9"
                rx="2"
                fill="#25282f"
              />
              {/* Mouse */}
              <ellipse cx="1182" cy="511" rx="5" ry="7" fill="#2a2d35" />
              {/* Desk lamp */}
              <rect
                x="1245"
                y="462"
                width="5"
                height="38"
                rx="2"
                fill="#5a5545"
              />
              <path
                d="M 1235 460 L 1240 450 L 1257 450 L 1262 460 Z"
                fill="#6a6555"
              />
              <ellipse
                cx="1248"
                cy="461"
                rx="10"
                ry="4"
                fill="#f5c878"
                opacity="0.7"
              >
                <animate
                  attributeName="opacity"
                  values="0.7;0.5;0.7"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse
                cx="1248"
                cy="495"
                rx="38"
                ry="42"
                fill="url(#deskLampGlow)"
                opacity="0.5"
              />
              {/* ═══ CHAIR (Alex) ═══ */}
              <ellipse cx="1160" cy="560" rx="26" ry="10" fill="#2e3035" />
              <rect
                x="1138"
                y="540"
                width="44"
                height="22"
                rx="9"
                fill="#35383f"
              />
              <rect
                x="1143"
                y="524"
                width="34"
                height="18"
                rx="6"
                fill="#3a3d45"
              />
              {/* ═══ ALEX (Developer) ═══ */}
              <rect
                x="1145"
                y="504"
                width="30"
                height="30"
                rx="6"
                fill="#3a6a5a"
              />
              <circle cx="1160" cy="494" r="14" fill="#d4b898" />
              <path
                d="M 1148 490 Q 1155 476 1160 474 Q 1165 476 1172 490"
                fill="#4a3218"
              />
              <path
                d="M 1148 490 L 1148 486 Q 1160 480 1172 486 L 1172 490"
                fill="#4a3218"
              />
              <ellipse cx="1156" cy="494" rx="1.8" ry="1.3" fill="#1a1a1a" />
              <ellipse cx="1164" cy="494" rx="1.8" ry="1.3" fill="#1a1a1a" />
              <path
                d="M 1156 499 Q 1160 501 1164 499"
                fill="none"
                stroke="#b89070"
                strokeWidth="0.7"
              />
              <rect
                x="1138"
                y="512"
                width="10"
                height="4"
                rx="2"
                fill="#d4b898"
              />
              <rect
                x="1173"
                y="512"
                width="10"
                height="4"
                rx="2"
                fill="#d4b898"
              />
              {/* ═══ COPILOT (AI Robot — beside desk 3) ═══ */}
              <ellipse
                cx="1302"
                cy="570"
                rx="16"
                ry="4"
                fill="rgba(0,0,0,0.12)"
              />
              <rect
                x="1290"
                y="530"
                width="24"
                height="32"
                rx="6"
                fill="#45484f"
              />
              <rect
                x="1295"
                y="538"
                width="14"
                height="5"
                rx="1.5"
                fill="#3a3d45"
              />
              <circle cx="1302" cy="553" r="1.8" fill="#38bdf8" opacity="0.3" />
              <rect
                x="1293"
                y="514"
                width="18"
                height="18"
                rx="5"
                fill="#55585f"
              />
              <rect
                x="1296"
                y="519"
                width="12"
                height="7"
                rx="3"
                fill="#2a2d35"
              />
              <circle cx="1299" cy="522" r="2.5" fill="#38bdf8" opacity="0.9">
                <animate
                  attributeName="opacity"
                  values="0.9;0.3;0.9"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="1306" cy="522" r="2.5" fill="#38bdf8" opacity="0.9">
                <animate
                  attributeName="opacity"
                  values="0.9;0.3;0.9"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              <line
                x1="1302"
                y1="514"
                x2="1302"
                y2="503"
                stroke="#55585f"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="1302" cy="500" r="3.5" fill="#38bdf8" opacity="0.6">
                <animate
                  attributeName="opacity"
                  values="0.6;0.2;0.6"
                  dur="2.2s"
                  repeatCount="indefinite"
                />
              </circle>
              <ellipse
                cx="1302"
                cy="500"
                rx="14"
                ry="14"
                fill="url(#agentCyan)"
                opacity="0.4"
              >
                <animate
                  attributeName="opacity"
                  values="0.4;0.15;0.4"
                  dur="2.2s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <rect
                x="1284"
                y="538"
                width="7"
                height="16"
                rx="3"
                fill="#45484f"
              />
              <rect
                x="1313"
                y="538"
                width="7"
                height="16"
                rx="3"
                fill="#45484f"
              />
              <rect
                x="1295"
                y="562"
                width="5"
                height="10"
                rx="2"
                fill="#45484f"
              />
              <rect
                x="1304"
                y="562"
                width="5"
                height="10"
                rx="2"
                fill="#45484f"
              />
              <rect
                x="1293"
                y="570"
                width="8"
                height="3"
                rx="1.5"
                fill="#3a3d45"
              />
              <rect
                x="1303"
                y="570"
                width="8"
                height="3"
                rx="1.5"
                fill="#3a3d45"
              />
              {/* ══════════════════════════════════════════════════
                  WALKING DEVELOPER (heading to meeting room)
                  ══════════════════════════════════════════════════ */}
              {/* Floor shadow */}
              <ellipse
                cx="830"
                cy="590"
                rx="16"
                ry="5"
                fill="rgba(0,0,0,0.12)"
              />
              {/* Legs (walking) */}
              <rect
                x="822"
                y="575"
                width="7"
                height="16"
                rx="2"
                fill="#2e3045"
                transform="rotate(-10 826 583)"
              />
              <rect
                x="835"
                y="575"
                width="7"
                height="16"
                rx="2"
                fill="#2e3045"
                transform="rotate(10 839 583)"
              />
              {/* Body */}
              <rect
                x="820"
                y="548"
                width="24"
                height="30"
                rx="6"
                fill="#6a5040"
              />
              {/* Head */}
              <circle cx="832" cy="538" r="13" fill="#c8a078" />
              {/* Hair */}
              <path
                d="M 821 534 Q 828 520 832 518 Q 836 520 843 534"
                fill="#584028"
              />
              <path
                d="M 821 534 L 821 530 Q 832 524 843 530 L 843 534"
                fill="#584028"
              />
              <ellipse cx="828" cy="538" rx="1.5" ry="1.2" fill="#1a1a1a" />
              <ellipse cx="836" cy="538" rx="1.5" ry="1.2" fill="#1a1a1a" />
              {/* Arms in walking motion */}
              <rect
                x="813"
                y="555"
                width="9"
                height="4"
                rx="2"
                fill="#c8a078"
                transform="rotate(10 817 557)"
              />
              <rect
                x="842"
                y="555"
                width="9"
                height="4"
                rx="2"
                fill="#c8a078"
                transform="rotate(-10 846 557)"
              />
              {/* Laptop in hand */}
              <rect
                x="845"
                y="553"
                width="14"
                height="10"
                rx="2"
                fill="#2a2d35"
              />
              {/* ══════════════════════════════════════════════════
                  ADDITIONAL ENVIRONMENTAL DETAILS
                  ══════════════════════════════════════════════════ */}
              {/* Power strip on floor (desk 1) */}
              <rect
                x="240"
                y="636"
                width="30"
                height="5"
                rx="1.5"
                fill="#2e2a24"
              />
              <circle cx="250" cy="638" r="1" fill="#4ade80" opacity="0.3" />
              {/* Cables */}
              <path
                d="M 250 636 Q 248 620 250 600"
                fill="none"
                stroke="#2e2a24"
                strokeWidth="1"
                opacity="0.3"
              />
              <path
                d="M 260"
                y="636"
                fill="none"
                stroke="#2e2a24"
                strokeWidth="1"
                opacity="0.2"
              />
              {/* Trash can near desk 2 */}
              <rect
                x="890"
                y="530"
                width="16"
                height="20"
                rx="2"
                fill="#2a2d35"
              />
              <rect
                x="888"
                y="528"
                width="20"
                height="4"
                rx="1"
                fill="#35383f"
              />
              {/* Coat hook area on far left wall */}
              <rect x="30" y="280" width="4" height="8" fill="#4a4d55" />
              <path
                d="M 32 288 Q 38 292 38 286"
                fill="none"
                stroke="#4a4d55"
                strokeWidth="2"
              />
              {/* Jacket hanging */}
              <path
                d="M 35 288 L 30 310 Q 32 318 40 318 L 45 310 Z"
                fill="#3a5a8a"
                opacity="0.4"
              />
              {/* Second coat hook */}
              <rect x="55" y="280" width="4" height="8" fill="#4a4d55" />
              <path
                d="M 57 288 Q 63 292 63 286"
                fill="none"
                stroke="#4a4d55"
                strokeWidth="2"
              />
              {/* ══════════════════════════════════════════════════
                  ATMOSPHERIC OVERLAYS
                  ══════════════════════════════════════════════════ */}
              {/* Ambient warm wash from lamps */}
              <rect
                x="0"
                y="430"
                width="1600"
                height="470"
                fill="#f5a623"
                opacity="0.015"
              />
              {/* Window light spill on floor */}
              <rect
                x="1000"
                y="430"
                width="480"
                height="200"
                fill="#8ab8e8"
                opacity="0.01"
              />
              {/* Subtle shadow under furniture */}
              <ellipse
                cx="250"
                cy="640"
                rx="120"
                ry="8"
                fill="rgba(0,0,0,0.08)"
              />
              <ellipse
                cx="767"
                cy="542"
                rx="100"
                ry="6"
                fill="rgba(0,0,0,0.06)"
              />
              <ellipse
                cx="1160"
                cy="578"
                rx="110"
                ry="7"
                fill="rgba(0,0,0,0.06)"
              />
            </svg>

            {/* ── INTERACTIVE HOVER TARGETS ── */}
            {inhabitants.map((person) => (
              <div
                key={person.id}
                className="absolute z-20"
                style={{
                  left: `${person.x}%`,
                  top: `${person.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: person.type === "agent" ? "44px" : "56px",
                  height: person.type === "agent" ? "56px" : "68px",
                  cursor: "default",
                }}
                onMouseEnter={() => setHoveredId(person.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
            ))}

            {/* ── HOVER TOOLTIPS ── */}
            <AnimatePresence>
              {hoveredId &&
                (() => {
                  const person = inhabitants.find((p) => p.id === hoveredId);
                  if (!person) return null;
                  return (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute z-30 pointer-events-none"
                      style={{
                        left: `${person.x}%`,
                        top: `calc(${person.y}% - ${person.type === "agent" ? 44 : 52}px)`,
                        transform: "translate(-50%, -100%)",
                      }}
                    >
                      <div
                        className="flex items-center gap-2 rounded-xl px-3.5 py-2"
                        style={{
                          background: "rgba(18, 20, 26, 0.8)",
                          backdropFilter: "blur(20px)",
                          WebkitBackdropFilter: "blur(20px)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          boxShadow:
                            "0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
                        }}
                      >
                        {person.type === "agent" && (
                          <span
                            className="inline-block size-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                person.id === "claude" ? "#f59e0b" : "#38bdf8",
                              boxShadow: `0 0 8px ${person.id === "claude" ? "rgba(245,158,11,0.6)" : "rgba(56,189,248,0.6)"}`,
                            }}
                          />
                        )}
                        <span className="text-[12px] font-semibold text-white whitespace-nowrap">
                          {person.name}
                        </span>
                        <span className="text-[11px] text-neutral-400 whitespace-nowrap">
                          {person.task}
                        </span>
                      </div>
                    </motion.div>
                  );
                })()}
            </AnimatePresence>

            {/* ── CINEMATIC VIGNETTE ── */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: "inset 0 0 150px 60px rgba(0,0,0,0.4)" }}
            />
            <div
              className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(28,30,36,0.5) 0%, transparent 100%)",
              }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, rgba(14,16,22,0.7) 0%, transparent 100%)",
              }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
