import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays } from "date-fns";

export interface RepeatPurchase {
  merchant: string;
  occurrences: Array<{
    id: string;
    amount: number;
    date: string;
  }>;
  averageAmount: number;
  averageIntervalDays: number;
  predictedNextDate: string;
  isLinkedToBill: boolean;
  isLinkedToToiletry: boolean;
}

/**
 * Detects repeat purchases from the same merchant over the last 180 days.
 * Returns merchants with 2+ purchases and a predicted next purchase date.
 */
export function useRepeatPurchases() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["repeat-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const since = new Date();
      since.setDate(since.getDate() - 180);
      const sinceStr = since.toISOString().split("T")[0];

      // Get expenses from the last 180 days
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: transactions, error } = await (supabase as any)
        .from("transactions")
        .select("id, description, amount, transaction_date, bill_id")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("transaction_date", sinceStr)
        .order("transaction_date", { ascending: true }) as { data: Array<{ id: string; description: string; amount: number; transaction_date: string; bill_id: string | null }> | null; error: any };

      if (error) throw error;
      if (!transactions) return [];

      // Get existing bills to check for linked merchants
      const { data: bills } = await supabase
        .from("bills")
        .select("name")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const billNames = new Set(
        (bills || []).map((b) => b.name.toLowerCase())
      );

      // Get existing toiletry items
      const { data: toiletries } = await supabase
        .from("toiletry_items")
        .select("name, brand")
        .eq("user_id", user.id);

      const toiletryNames = new Set(
        (toiletries || []).flatMap((t) => [
          t.name?.toLowerCase(),
          t.brand?.toLowerCase(),
        ].filter(Boolean))
      );

      // Group by normalised merchant name
      const groups = new Map<string, typeof transactions>();
      for (const tx of transactions) {
        // Skip already-linked-to-bill transactions
        if (tx.bill_id) continue;

        const key = tx.description.trim().toLowerCase().replace(/\s+/g, " ");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(tx);
      }

      const results: RepeatPurchase[] = [];

      for (const [merchant, txs] of groups) {
        if (txs.length < 2) continue;

        // Calculate average interval
        const dates = txs.map((t) => new Date(t.transaction_date)).sort((a, b) => a.getTime() - b.getTime());
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push(differenceInDays(dates[i], dates[i - 1]));
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        
        // Skip if interval is too short (daily purchases like coffee) or too long
        if (avgInterval < 7 || avgInterval > 120) continue;

        const avgAmount = txs.reduce((s, t) => s + Number(t.amount), 0) / txs.length;
        const lastDate = dates[dates.length - 1];
        const predictedNext = new Date(lastDate);
        predictedNext.setDate(predictedNext.getDate() + Math.round(avgInterval));

        const displayName = txs[0].description; // Use original casing

        results.push({
          merchant: displayName,
          occurrences: txs.map((t) => ({
            id: t.id,
            amount: Number(t.amount),
            date: t.transaction_date,
          })),
          averageAmount: Math.round(avgAmount * 100) / 100,
          averageIntervalDays: Math.round(avgInterval),
          predictedNextDate: predictedNext.toISOString().split("T")[0],
          isLinkedToBill: billNames.has(merchant),
          isLinkedToToiletry: toiletryNames.has(merchant),
        });
      }

      // Sort by next predicted date (soonest first)
      results.sort(
        (a, b) => new Date(a.predictedNextDate).getTime() - new Date(b.predictedNextDate).getTime()
      );

      return results;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
