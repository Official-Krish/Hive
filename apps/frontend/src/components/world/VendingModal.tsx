import { useEffect, useState } from "react";
import { FiCheck, FiCopy, FiX, FiZap } from "react-icons/fi";
import { type UseVendingResult } from "@/hooks/useVending";
import type { VendingAvailability } from "@hive/types";
import { cn } from "@/lib/utils";

interface VendingModalProps {
  vending: UseVendingResult;
  onClose: () => void;
}

const PROVIDER_META: Record<
  VendingAvailability["provider"],
  { label: string; dot: string; hint: string }
> = {
  claude: { label: "Claude", dot: "bg-orange-500", hint: "Anthropic API key" },
  opencode: { label: "OpenCode", dot: "bg-violet-500", hint: "OpenCode key" },
  codex: { label: "Codex", dot: "bg-emerald-500", hint: "OpenAI Codex key" },
};

function retryLabel(secs: number | null): string | null {
  if (secs === null) return null;
  if (secs < 3600) return `retry in ${Math.ceil(secs / 60)}m`;
  return `retry in ${(secs / 3600).toFixed(1)}h`;
}

export function VendingModal({ vending, onClose }: VendingModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void vending.refresh();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, vending.refresh]);

  useEffect(() => {
    setCopied(false);
  }, [vending.revealed?.poolId]);

  const copy = async (): Promise<void> => {
    if (!vending.revealed) return;
    try {
      await navigator.clipboard.writeText(vending.revealed.secret);
      setCopied(true);
    } catch {
      /* clipboard blocked — select manually */
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[min(86vh,620px)] w-[min(440px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.09]">
        <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Vending machine
            </div>
            <div className="text-[15px] font-semibold tracking-tight text-neutral-900">
              API keys
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close vending machine"
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
          >
            <FiX className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {vending.error && (
            <div
              role="alert"
              className="mb-3 rounded-xl bg-rose-50 px-3.5 py-2 text-[12px] font-medium text-rose-700 ring-1 ring-rose-500/30"
            >
              {vending.error}
            </div>
          )}

          {vending.revealed ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-neutral-950 px-4 py-8 text-center text-white shadow-md">
              <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40">
                <FiZap className="size-5" />
              </span>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
                {vending.revealed.label} · shown once
              </div>
              <button
                type="button"
                onClick={() => void copy()}
                title="Copy to clipboard"
                className="w-full break-all rounded-xl bg-white/[0.07] px-3 py-3 font-mono text-[12.5px] text-emerald-200 ring-1 ring-white/15 transition-colors hover:bg-white/[0.12]"
              >
                {vending.revealed.secret}
              </button>
              <button
                type="button"
                onClick={() => void copy()}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-[13px] font-bold text-neutral-950 transition-colors hover:bg-emerald-400"
              >
                {copied ? (
                  <>
                    <FiCheck className="size-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <FiCopy className="size-3.5" /> Copy key
                  </>
                )}
              </button>
              <p className="max-w-[300px] text-[12px] text-white/55">
                Copy it now — this key won't be shown again. Store it in your
                local env, never in chat.
              </p>
              <button
                type="button"
                onClick={() => {
                  vending.dismissReveal();
                  onClose();
                }}
                className="rounded-xl bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold text-white/70 ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {vending.loading && vending.providers.length === 0 && (
                <div className="py-6 text-center text-[13px] text-neutral-500">
                  Contacting the machine…
                </div>
              )}
              {vending.providers.map((p) => {
                const meta = PROVIDER_META[p.provider];
                const wait = retryLabel(p.retryAfterSecs);
                return (
                  <div
                    key={p.provider}
                    className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-black/[0.07]"
                  >
                    <span
                      className={cn("size-3 shrink-0 rounded-full", meta.dot)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-neutral-900">
                        {meta.label}
                      </span>
                      <span className="block text-[11.5px] font-medium text-neutral-500">
                        {meta.hint} ·{" "}
                        {p.available > 0
                          ? `${p.available} in stock`
                          : "out of stock"}
                        {!p.canCheckout && p.reason && p.available > 0
                          ? ` · ${p.reason}${wait ? ` (${wait})` : ""}`
                          : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={!p.canCheckout}
                      onClick={() => void vending.checkout(p.provider)}
                      className="shrink-0 rounded-xl bg-neutral-950 px-3.5 py-2 text-[12.5px] font-bold text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Get key
                    </button>
                  </div>
                );
              })}
              <p className="px-1 text-[11.5px] leading-relaxed text-neutral-500">
                Checkouts are rate-limited by your workspace admin and logged.
                Keys are revealed once — keep them local.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
