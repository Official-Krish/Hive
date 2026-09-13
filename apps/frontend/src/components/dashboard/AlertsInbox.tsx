import { FiAlertTriangle, FiCheck, FiXOctagon } from "react-icons/fi";
import { useWatchdogAlerts, alertLabel } from "@/hooks/useWatchdogAlerts";
import { Btn, Spinner } from "@/components/dashboard/kit";

const WATCHDOG_TYPES = new Set([
  "agent.stuck",
  "token.burn",
  "test.failing_streak",
  "budget.risk",
  "vending.low_stock",
]);

function age(createdAt: string): string {
  const mins = Math.max(
    1,
    Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000),
  );
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function AlertsInbox({
  workspaceId,
  canResolve,
}: {
  workspaceId: string;
  canResolve: boolean;
}) {
  const { items, isLoading, isError, resolve } = useWatchdogAlerts(workspaceId);
  const open = items.filter((a) => WATCHDOG_TYPES.has(a.type));
  const critical = open.filter((a) => a.severity === "critical").length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-neutral-500">
        <Spinner /> Checking for stuck agents, burn, failing tests…
      </div>
    );
  }
  if (isError || open.length === 0) return null;

  return (
    <section aria-label="Needs attention" className="mt-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
          Needs attention
          <span className="ml-2 tabular-nums text-neutral-500">
            {open.length} open{critical > 0 && ` · ${critical} critical`}
          </span>
        </p>
      </div>
      <ul className="mt-2 divide-y divide-neutral-900/[0.08] rounded-xl border border-neutral-900/[0.08] bg-white/[0.6]">
        {open.slice(0, 8).map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                a.severity === "critical"
                  ? "bg-rose-600/10 text-rose-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
              aria-hidden
            >
              {a.severity === "critical" ? (
                <FiXOctagon className="size-3.5" />
              ) : (
                <FiAlertTriangle className="size-3.5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-neutral-800">
                {a.message}
              </p>
              <p className="mt-0.5 font-mono text-[11px] leading-tight text-neutral-400">
                {alertLabel(a.type)} · {age(a.createdAt)} ago
              </p>
            </div>
            {canResolve && (
              <Btn
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                onClick={() => resolve.mutate(a.id)}
                disabled={resolve.isPending}
              >
                <FiCheck className="size-3.5" aria-hidden />
                Resolve
              </Btn>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AlertsInbox;
