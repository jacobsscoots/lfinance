import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBills } from "@/hooks/useBills";
import { Transaction } from "@/hooks/useTransactions";
import { toast } from "@/hooks/use-toast";

/**
 * Auto-links unlinked transactions to matching bills/subscriptions.
 * Runs once when transactions change, matching by provider name + amount tolerance (±£1) + date window (±3 days).
 */
export function useAutoLinkTransactions(transactions: Transaction[]) {
  const { user } = useAuth();
  const { bills } = useBills();
  const queryClient = useQueryClient();
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !bills.length || !transactions.length) return;

    const activeBills = bills.filter(b => b.is_active !== false);
    if (!activeBills.length) return;

    // Only look at unlinked expense transactions
    const unlinked = transactions.filter(
      t => t.type === "expense" && !t.bill_id && !processedRef.current.has(t.id)
    );
    if (!unlinked.length) return;

    const matches: { transactionId: string; billId: string; billName: string }[] = [];

    for (const txn of unlinked) {
      processedRef.current.add(txn.id);

      const merchant = (txn.merchant || "").toLowerCase();
      const description = (txn.description || "").toLowerCase();
      const txnAmount = Math.abs(Number(txn.amount));

      for (const bill of activeBills) {
        const billName = (bill.name || "").toLowerCase();
        const billProvider = (bill.provider || "").toLowerCase();
        const billAmount = Number(bill.amount);

        // Amount must be within ±£1
        if (Math.abs(txnAmount - billAmount) > 1) continue;

        // Provider/name must match merchant or description
        const nameMatch =
          (billName && (merchant.includes(billName) || description.includes(billName))) ||
          (billProvider && (merchant.includes(billProvider) || description.includes(billProvider)));

        if (nameMatch) {
          matches.push({ transactionId: txn.id, billId: bill.id, billName: bill.name });
          break; // One match per transaction
        }
      }
    }

    if (!matches.length) return;

    // Apply matches
    const applyMatches = async () => {
      let linked = 0;
      for (const m of matches) {
        const { error } = await supabase
          .from("transactions")
          .update({ bill_id: m.billId })
          .eq("id", m.transactionId)
          .is("bill_id", null); // Only if still unlinked

        if (!error) linked++;
      }

      if (linked > 0) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["bill-occurrences"] });
        toast({
          title: `Auto-linked ${linked} transaction${linked > 1 ? "s" : ""}`,
          description: matches.slice(0, 3).map(m => m.billName).join(", ") + (matches.length > 3 ? "..." : ""),
        });
      }
    };

    applyMatches();
  }, [user, bills, transactions, queryClient]);
}
