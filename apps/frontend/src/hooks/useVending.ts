import { useCallback, useState } from "react";
import { ApiError, http } from "@/lib/http";
import type { VendingAvailability, VendingCheckout } from "@hive/types";

export interface UseVendingResult {
  providers: VendingAvailability[];
  loading: boolean;
  /** Last checkout error (rule reason), cleared on next attempt. */
  error: string | null;
  /** The one-time revealed secret (client memory only). */
  revealed: VendingCheckout | null;
  refresh: () => Promise<void>;
  checkout: (provider: VendingAvailability["provider"]) => Promise<void>;
  dismissReveal: () => void;
}

/**
 * Vending machine client: availability list + one-time checkout. The secret
 * lives only in `revealed` until dismissed — never persisted client-side.
 */
export function useVending(workspaceId: string): UseVendingResult {
  const [providers, setProviders] = useState<VendingAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<VendingCheckout | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { providers } = await http.vending.availability(workspaceId);
      setProviders(providers);
    } catch {
      /* transient — retry on open */
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const checkout = useCallback(
    async (provider: VendingAvailability["provider"]) => {
      setError(null);
      try {
        const result = await http.vending.checkout(workspaceId, provider);
        setRevealed(result);
        await refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Checkout failed");
      }
    },
    [workspaceId, refresh],
  );

  const dismissReveal = useCallback(() => setRevealed(null), []);

  return {
    providers,
    loading,
    error,
    revealed,
    refresh,
    checkout,
    dismissReveal,
  };
}
