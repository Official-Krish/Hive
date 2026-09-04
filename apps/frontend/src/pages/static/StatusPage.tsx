import { useEffect, useState } from "react";
import { StaticPage } from "@/components/layout/StaticPage";
import { API_BASE_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

interface Health {
  status: string;
  uptime: number;
  timestamp: string;
  db: string;
  redis: string;
  wsPort: number;
}

function fmtUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ServiceRow({
  name,
  state,
  detail,
}: {
  name: string;
  state: "ok" | "down" | "unknown";
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="relative flex size-2">
          {state === "ok" && (
            <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/60" />
          )}
          <span
            className={cn(
              "relative size-2 rounded-full",
              state === "ok" && "bg-emerald-400",
              state === "down" && "bg-rose-400",
              state === "unknown" && "bg-white/25",
            )}
          />
        </span>
        <span className="text-sm font-medium text-white">{name}</span>
      </div>
      <div className="text-right">
        <div
          className={cn(
            "font-mono text-[11px] uppercase tracking-[0.14em]",
            state === "ok" && "text-emerald-300",
            state === "down" && "text-rose-300",
            state === "unknown" && "text-white/35",
          )}
        >
          {state === "ok" ? "Operational" : state === "down" ? "Down" : "…"}
        </div>
        {detail && (
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-white/35">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/health`);
        if (!res.ok) throw new Error("bad status");
        const json = (await res.json()) as { data: Health };
        if (alive) {
          setHealth(json.data);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    }
    void check();
    const t = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const overall =
    failed || !health ? "unknown" : health.status === "ok" ? "ok" : "down";

  return (
    <StaticPage
      eyebrow="Trust · Status"
      title="System status"
      description="Live health of the Hive platform — API, realtime, and storage. Refreshes every 30 seconds."
      cta={false}
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <span className="text-sm font-semibold text-white">
            {overall === "ok"
              ? "All systems operational"
              : overall === "down"
                ? "Partial outage"
                : "Checking…"}
          </span>
          {health && (
            <span className="font-mono text-[11px] tabular-nums text-white/35">
              uptime {fmtUptime(health.uptime)}
            </span>
          )}
        </div>
        <ServiceRow
          name="API"
          state={failed || !health ? "unknown" : "ok"}
          detail={
            health ? new Date(health.timestamp).toLocaleTimeString() : undefined
          }
        />
        <ServiceRow
          name="Realtime hub"
          state={failed || !health ? "unknown" : "ok"}
          detail={health ? `ws :${health.wsPort}` : undefined}
        />
        <ServiceRow
          name="Postgres"
          state={
            failed || !health ? "unknown" : health.db === "ok" ? "ok" : "down"
          }
        />
        <ServiceRow
          name="Redis"
          state={
            failed || !health
              ? "unknown"
              : health.redis === "ok"
                ? "ok"
                : "down"
          }
        />
      </div>
      <p className="mt-6 text-sm text-neutral-500">
        Seeing red? <a href="/contact">Tell us</a> — and check back shortly.
      </p>
    </StaticPage>
  );
}

export default StatusPage;
