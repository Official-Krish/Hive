import { useEffect, useState } from "react";
import { type UseVendingResult } from "@/hooks/useVending";
import type { VendingAssignedKey, VendingAvailability } from "@hive/types";
import { DCard, DError, DLoading, DModal, EYEBROW } from "./chrome";
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

/** An admin-assigned key — masked until tapped, copyable. */
function AssignedKeyRow({ entry }: { entry: VendingAssignedKey }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const meta = PROVIDER_META[entry.provider];
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(entry.secret);
      setCopied(true);
      setCopyBlocked(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions/headdless) — reveal + select manually.
      setCopyBlocked(true);
      setShown(true);
    }
  };
  return (
    <div className="rounded-xl bg-neutral-900/[0.03] px-3 py-2 ring-1 ring-black/[0.07]">
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full", meta.dot)} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-neutral-900">
          {meta.label} · {entry.label}
        </span>
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="rounded-lg px-2 py-1 text-[12px] font-semibold text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-900"
        >
          {shown ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          aria-live="polite"
          className="rounded-lg px-2 py-1 text-[12px] font-semibold text-neutral-500 hover:bg-black/[0.05] hover:text-neutral-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {copyBlocked && (
        <p className="mt-1 text-[11px] text-neutral-500">
          Copy blocked — the key is shown above, select it manually.
        </p>
      )}
      {shown && (
        <div className="mt-1.5 break-all rounded-lg bg-neutral-900 px-2 py-1.5 font-mono text-[11.5px] text-emerald-300">
          {entry.secret}
        </div>
      )}
      <div className="mt-1 text-[10.5px] text-neutral-500">
        from {entry.assignedByName}
      </div>
    </div>
  );
}

export function VendingModal({ vending, onClose }: VendingModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);

  useEffect(() => {
    void vending.refresh();
  }, [vending.refresh]);

  useEffect(() => {
    setCopied(false);
  }, [vending.revealed?.poolId]);

  const copy = async (): Promise<void> => {
    if (!vending.revealed) return;
    try {
      await navigator.clipboard.writeText(vending.revealed.secret);
      setCopied(true);
      setCopyBlocked(false);
    } catch {
      // Clipboard blocked — the secret above is selectable, call it out.
      setCopyBlocked(true);
    }
  };

  return (
    <DModal
      eyebrow="Vending machine"
      title="API keys"
      onClose={onClose}
      closeLabel="Close vending machine"
      className="w-[min(440px,96vw)]"
    >
      <div className="flex-1 overflow-y-auto p-4">
        {vending.error && (
          <DError retry={() => void vending.refresh()}>{vending.error}</DError>
        )}

        {vending.revealed ? (
          <DCard className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <div className={EYEBROW}>{vending.revealed.label} · shown once</div>
            <div className="w-full break-all rounded-xl bg-neutral-900 px-3 py-3 font-mono text-[12.5px] text-emerald-300 select-all">
              {vending.revealed.secret}
            </div>
            <button
              type="button"
              onClick={() => void copy()}
              aria-live="polite"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40"
            >
              {copied ? "Copied" : "Copy key"}
            </button>
            <p className="max-w-[300px] text-[12px] text-neutral-500">
              Copy it now — this key won't be shown again. Store it in your
              local env, never in chat.
              {copyBlocked &&
                " Copy was blocked: select the key above manually."}
            </p>
            <button
              type="button"
              onClick={() => {
                vending.dismissReveal();
                onClose();
              }}
              className="rounded-xl bg-black/[0.05] px-3.5 py-1.5 text-[12px] font-semibold text-neutral-600 ring-1 ring-black/[0.07] hover:bg-black/[0.08]"
            >
              Done
            </button>
          </DCard>
        ) : (
          <div className="flex flex-col gap-2">
            {vending.loading && vending.providers.length === 0 && (
              <DLoading>Contacting the machine…</DLoading>
            )}
            {vending.assigned.length > 0 && (
              <DCard className="px-3.5 py-3">
                <div className={`${EYEBROW} mb-2`}>Assigned to you</div>
                <div className="flex flex-col gap-1.5">
                  {vending.assigned.map((k) => (
                    <AssignedKeyRow key={k.poolId} entry={k} />
                  ))}
                </div>
              </DCard>
            )}
            {vending.providers.map((p) => {
              const meta = PROVIDER_META[p.provider];
              const wait = retryLabel(p.retryAfterSecs);
              return (
                <DCard
                  key={p.provider}
                  className="flex items-center gap-3 px-3.5 py-3"
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
                    title={
                      !p.canCheckout && p.reason ? p.reason : "Check out a key"
                    }
                    className="shrink-0 rounded-xl bg-neutral-900 px-3.5 py-2 text-[12.5px] font-bold text-white transition-all hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/40"
                  >
                    Get key
                  </button>
                </DCard>
              );
            })}
            <p className="px-1 text-[11.5px] leading-relaxed text-neutral-500">
              Checkouts are rate-limited by your workspace admin and logged.
              Keys are revealed once — keep them local.
            </p>
          </div>
        )}
      </div>
    </DModal>
  );
}
