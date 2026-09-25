import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http, type AlertSummary } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";

const POLL_MS = 30_000;

function severityRank(s: string): number {
  if (s === "critical") return 0;
  if (s === "warning") return 1;
  return 2;
}

export function useWatchdogAlerts(
  workspaceId: string,
  client: RealtimeClient | null = null,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const key = ["alerts", workspaceId, "open"];

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      http.reads.alerts(workspaceId, { status: "open", pageSize: 50 }),
    enabled: enabled && workspaceId.length > 0,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    if (!client) return;
    const off = client.on("alert.created", (event) => {
      if (event.workspaceId === workspaceId) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    });
    return off;
  }, [client, workspaceId, queryClient]);

  const resolve = useMutation({
    mutationFn: (alertId: string) =>
      http.reads.resolveAlert(workspaceId, alertId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const items: AlertSummary[] = [...(query.data?.items ?? [])].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      (a.createdAt < b.createdAt ? 1 : -1),
  );

  return { ...query, items, resolve };
}

/** Human label for watchdog alert types; unknown backend types pass through. */
export function alertLabel(type: string): string {
  switch (type) {
    case "agent.stuck":
      return "Stuck agent";
    case "token.burn":
      return "Token burn";
    case "test.failing_streak":
      return "Failing tests";
    case "budget.risk":
      return "Budget risk";
    case "budget.enforced":
      return "Collectors stopped";
    case "vending.low_stock":
      return "Low API keys";
    default:
      return type;
  }
}
