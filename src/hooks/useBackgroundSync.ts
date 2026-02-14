import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Background sync hook that periodically syncs:
 * - Smart meter readings (Bright)
 * - Gmail receipts
 * - Bank accounts (handled by useBankConnections, but we ensure it runs)
 *
 * Runs every 5 minutes while the app is open.
 */
export function useBackgroundSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  const runSync = useCallback(async () => {
    if (syncingRef.current || !user) return;
    syncingRef.current = true;

    try {
      // Run all syncs in parallel
      const results = await Promise.allSettled([
        // 1. Smart meter sync
        supabase.functions.invoke("bright-sync-readings", {
          body: { action: "sync" },
        }),
        // 2. Gmail receipt sync
        supabase.functions.invoke("gmail-sync-receipts", {
          body: { action: "sync" },
        }),
        // 3. Gmail tracking sync
        supabase.functions.invoke("gmail-tracking-sync", {
          body: {},
        }),
      ]);

      // Silently invalidate relevant queries so UI updates
      queryClient.invalidateQueries({ queryKey: ["energy-readings"] });
      queryClient.invalidateQueries({ queryKey: ["bright-connection"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-receipt-matches"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      queryClient.invalidateQueries({ queryKey: ["email-tracking-extractions"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

      // Log for debugging (silent to user)
      const summary = results.map((r, i) => {
        const names = ["bright", "gmail-receipts", "gmail-tracking"];
        return `${names[i]}: ${r.status}`;
      });
      console.log("[background-sync]", summary.join(", "));
    } catch {
      // Background sync failures are silent
    } finally {
      syncingRef.current = false;
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (!user) return;

    // Run once on mount (app load / login)
    const initialTimeout = setTimeout(runSync, 5000); // small delay after load

    // Then every 5 minutes
    const intervalId = setInterval(runSync, SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [user, runSync]);
}
