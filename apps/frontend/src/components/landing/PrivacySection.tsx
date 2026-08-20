import { useState } from "react";
import { Reveal } from "@/components/motion";
import {
  FiShield,
  FiLock,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiKey,
  FiServer,
} from "react-icons/fi";
import { SiGithub } from "react-icons/si";

const privacyPillars = [
  {
    icon: FiKey,
    title: "Client-Side Token Stripping",
    desc: "API secrets, env variables, and private keys are redacted at the Mach/Linux kernel hook before any network packet is dispatched.",
  },
  {
    icon: FiServer,
    title: "Zero-Knowledge Architecture",
    desc: "Hive processes AST structural metrics, session durations, and error rates — never persisting raw prompt strings or intellectual property.",
  },
  {
    icon: FiLock,
    title: "SOC2 Type II Gating",
    desc: "Granular workspace-level read policies allow compliance teams to gate file path exposure, commit author visibility, and telemetry feeds.",
  },
];

export function PrivacySection() {
  const [isMasked, setIsMasked] = useState(true);

  return (
    <section id="privacy" className="relative py-28 md:py-36 overflow-hidden">
      {/* Glow background */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-600/5 blur-[180px] rounded-full -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 mb-4">
              <FiShield /> Privacy-First Architecture
            </span>
            <h2 className="font-sans font-extrabold text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.08] tracking-[-0.03em] text-white">
              Telemetry without the{" "}
              <span className="text-gradient-cyan">
                intellectual property risk
              </span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed">
              We know your code and prompts contain trade secrets. Hive is
              architected so telemetry stays strictly structural and
              confidential.
            </p>
          </div>
        </Reveal>

        {/* Interactive Redaction Sandbox */}
        <Reveal delay={0.1}>
          <div className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-[#0a0d15]/90 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] mb-16">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div>
                <span className="text-xs font-mono text-cyan-300 block mb-1">
                  LIVE REDACTION GATEWAY
                </span>
                <h4 className="font-sans font-bold text-white text-base">
                  Client-Side eBPF Sanitizer Preview
                </h4>
              </div>

              {/* Interactive Mask Toggle */}
              <button
                type="button"
                onClick={() => setIsMasked((prev) => !prev)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-medium transition-all ${
                  isMasked
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                }`}
              >
                {isMasked ? (
                  <FiEyeOff className="text-sm" />
                ) : (
                  <FiEye className="text-sm" />
                )}
                <span>
                  {isMasked
                    ? "Hive Shield: Active (Sanitized)"
                    : "Raw Stream: Unmasked"}
                </span>
              </button>
            </div>

            {/* Code Output Sample */}
            <div className="mt-6 rounded-2xl bg-[#06080e] p-4 sm:p-6 border border-white/[0.06] font-mono text-xs overflow-x-auto leading-relaxed">
              <div className="text-slate-500 mb-2">
                // Outgoing Ingest Payload
              </div>
              <div className="text-slate-300">
                <span className="text-purple-400">{"{"}</span>
                <div className="pl-4">
                  <div>
                    <span className="text-cyan-300">
                      &quot;event_type&quot;
                    </span>
                    :{" "}
                    <span className="text-emerald-400">
                      &quot;agent.session.diff&quot;
                    </span>
                    ,
                  </div>
                  <div>
                    <span className="text-cyan-300">&quot;agent&quot;</span>:{" "}
                    <span className="text-emerald-400">
                      &quot;claude-3-7-sonnet&quot;
                    </span>
                    ,
                  </div>
                  <div>
                    <span className="text-cyan-300">
                      &quot;secret_payload&quot;
                    </span>
                    :{" "}
                    {isMasked ? (
                      <span className="bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                        &quot;[REDACTED_STRIPE_KEY_SHA256:e3b0c442]&quot;
                      </span>
                    ) : (
                      <span className="bg-red-950/80 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                        &quot;sk_live_51Msz810291abc99401...&quot;
                      </span>
                    )}
                    ,
                  </div>
                  <div>
                    <span className="text-cyan-300">
                      &quot;prompt_context&quot;
                    </span>
                    :{" "}
                    {isMasked ? (
                      <span className="bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                        &quot;[AST_STRUCTURAL_NODE:
                        PaymentRefactorHandler]&quot;
                      </span>
                    ) : (
                      <span className="bg-red-950/80 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                        &quot;Fix customer credit card validation on production
                        DB&quot;
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-purple-400">{"}"}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400 pt-2">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <FiCheckCircle /> 100% Client-Side Masking (No raw secret
                transmission)
              </span>
              <span>AES-256-GCM Wire Encryption</span>
            </div>
          </div>
        </Reveal>

        {/* 3 Pillar Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {privacyPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="group rounded-3xl border border-white/10 bg-[#0e121c]/70 p-8 backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]"
              >
                <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 w-fit mb-6">
                  <Icon className="text-2xl" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* GitHub Integration Box */}
        <Reveal delay={0.2}>
          <div className="mt-12 rounded-3xl border border-white/10 bg-gradient-to-r from-[#0e121c] via-[#111624] to-[#0e121c] p-8 sm:p-10 text-center flex flex-col items-center justify-center gap-4">
            <SiGithub className="text-4xl text-slate-200" />
            <h3 className="text-xl font-bold text-white">
              Seamless GitHub & GitLab OAuth
            </h3>
            <p className="text-sm text-slate-400 max-w-md">
              Secure OAuth2 token handshakes, per-repository webhooks, and zero
              read access to private repository codebases.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
